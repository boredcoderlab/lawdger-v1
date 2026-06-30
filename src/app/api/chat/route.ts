import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { llm } from "@/lib/llm";
import type { LLMMessage } from "@/lib/llm/types";
import { TOOLS, executeTool } from "@/lib/llm/tools";

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(userName?: string | null): string {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `You are Lawdger, an AI legal assistant for Indian advocates.
Today is ${today}.${userName ? ` The user's name is ${userName}.` : ""}

You have access to tools to read and write legal data (cases, tasks, hearings, notes, payments).

Guidelines:
- When the user asks to log, add, create, or record something, use the appropriate write tool.
- When the user asks a question about their data, use the appropriate read tool first.
- For DELETE operations: always state exactly what you are about to delete and ask the user to confirm before calling the delete tool. If the user's message already contains an explicit confirmation ("yes, delete it", "confirm delete", etc.), you may proceed.
- After writing data, always tell the user what was done in plain language.
- Dates and fees should use Indian format (DD/MM/YYYY, ₹ symbol).
- Respond in the same language the user writes in (English or Hindi). Keep responses concise.
- If you need an ID (caseId, taskId, etc.) that the user did not provide, call the appropriate get_ tool first to find it.

DEDUPLICATION (CRITICAL):
- BEFORE calling create_case, you MUST first call get_cases and check whether any existing case matches the user's intent — including phonetic and abbreviation variants ("Tejubai" ≈ "Tejubhai", "vs" ≈ "versus" ≈ "v.", "MP" ≈ "Madhya Pradesh"). If a similar case exists, do NOT call create_case — instead use the existing caseId with create_hearing, create_task, create_note, or update_case_status as appropriate.
- When resolving relative dates ("Tuesday", "tomorrow", "next week"), always compute the next future occurrence from today's date stated above and pass it to tools in ISO 8601 format.`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const incomingMessages: LLMMessage[] = body.messages ?? [];

  if (incomingMessages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const systemMsg: LLMMessage = {
    role: "system",
    content: buildSystemPrompt(session.user.name),
  };

  const messages: LLMMessage[] = [systemMsg, ...incomingMessages];
  const actions: string[] = [];

  const MAX_ITERATIONS = 6;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await llm.chat(messages, TOOLS);

    if (!response.toolCalls || response.toolCalls.length === 0) {
      // Final text response — done
      return NextResponse.json({
        content: response.content,
        actions,
      });
    }

    // There are tool calls — execute them and continue the loop
    // Append assistant message with tool calls
    messages.push({
      role: "assistant",
      content: response.content ?? "",
      tool_calls: response.toolCalls,
    });

    // Execute each tool call and append results
    for (const tc of response.toolCalls) {
      let toolResult: string;
      try {
        const { result, action } = await executeTool(tc.name, tc.args);
        toolResult = result;
        if (action) actions.push(action);
      } catch (err) {
        toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
      }

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: toolResult,
      });
    }
  }

  // Hit iteration limit — return whatever the LLM says
  const fallback = await llm.chat(messages, []);
  return NextResponse.json({ content: fallback.content, actions });
}
