import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST() {
  // In a real implementation, we would extract the audio blob from the request, 
  // send it to Whisper for transcription, and then to an LLM.
  // For this MVP, we simulate a 2-second processing delay and return a mocked structured response.

  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Mocked AI output based on a sample input: "In Sharma v. State, the judge requested the final reply by tomorrow."
  const aiResponse = {
    caseName: "Sharma v. State",
    cleanNote: "The judge requested the final reply by tomorrow.",
    category: "Actionable Task",
    date: "Tomorrow"
  };

  try {
    // 1. Find the case
    let targetCase = await prisma.case.findFirst();
    const mockUserId = "user-123";

    if (!targetCase) {
      // Create dummy user and case if db is empty
      const user = await prisma.user.create({
        data: {
          id: mockUserId,
          email: "lawyer@lawdger.com",
          name: "Advocate"
        }
      });
      targetCase = await prisma.case.create({
        data: {
          userId: user.id,
          title: "Sharma v. State",
          clientName: "Rajeev Sharma",
          courtName: "High Court",
        }
      });
    }

    // 2. Insert the Note
    await prisma.note.create({
      data: {
        caseId: targetCase.id,
        userId: targetCase.userId, // Use the user id from the case
        rawTranscript: "In Sharma v. State, the judge requested the final reply by tomorrow.",
        cleanContent: aiResponse.cleanNote,
        category: aiResponse.category
      }
    });

    // 3. If Task, create Task
    if (aiResponse.category === "Actionable Task") {
      await prisma.task.create({
        data: {
          caseId: targetCase.id,
          userId: targetCase.userId,
          description: aiResponse.cleanNote,
          dueDate: new Date(Date.now() + 86400000) // Tomorrow
        }
      });
    }

    return NextResponse.json(aiResponse);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to process voice" }, { status: 500 });
  }
}
