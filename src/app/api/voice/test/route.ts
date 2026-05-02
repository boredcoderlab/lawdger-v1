import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json({ status: "error", message: "No API key found in .env.local" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent("Reply with only the word: OK");
    const text = result.response.text().trim();
    return NextResponse.json({ status: "ok", response: text, keyPrefix: apiKey.slice(0, 8) + "..." });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", message });
  }
}
