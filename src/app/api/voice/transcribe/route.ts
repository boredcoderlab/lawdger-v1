/**
 * Transcription-only voice endpoint for the Legal Brain chat interface.
 * Converts audio to text without any DB writes.
 * The chat UI uses this to get a transcript, then submits it as a user message
 * to /api/chat where the agent decides what actions to take.
 */
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { requireUserId } from "@/actions/requireUserId";

const TRANSCRIBE_PROMPT = `Transcribe this audio exactly as spoken.
The speaker may use English, Hindi, or a mix of both (Hinglish).
Return ONLY the verbatim transcript — no summaries, no formatting, no extra text.`;

export async function POST(req: NextRequest) {
  // Auth check
  await requireUserId();

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  let tempPath: string | null = null;

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Write audio to temp file
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    tempPath = join(tmpdir(), `lawdger_transcribe_${Date.now()}.webm`);
    writeFileSync(tempPath, buffer);

    const fileManager = new GoogleAIFileManager(apiKey);

    // Upload to Gemini File API
    const uploadResult = await fileManager.uploadFile(tempPath, {
      mimeType: "audio/webm",
      displayName: `transcribe_${Date.now()}`,
    });

    // Poll until processing is complete
    let uploadedFile = uploadResult.file;
    let attempts = 0;
    while (uploadedFile.state === "PROCESSING" && attempts < 15) {
      await new Promise((r) => setTimeout(r, 2000));
      const updated = await fileManager.getFile(uploadedFile.name);
      uploadedFile = updated;
      attempts++;
    }

    if (uploadedFile.state !== "ACTIVE") {
      throw new Error("File processing failed or timed out");
    }

    // Transcribe
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      {
        fileData: {
          mimeType: uploadedFile.mimeType,
          fileUri: uploadedFile.uri,
        },
      },
      { text: TRANSCRIBE_PROMPT },
    ]);

    const transcript = result.response.text().trim();

    // Clean up uploaded file (best-effort)
    try {
      await fileManager.deleteFile(uploadedFile.name);
    } catch {
      // ignore
    }

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[/api/voice/transcribe] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 }
    );
  } finally {
    // Clean up temp file
    if (tempPath) {
      try { unlinkSync(tempPath); } catch { /* ignore */ }
    }
  }
}
