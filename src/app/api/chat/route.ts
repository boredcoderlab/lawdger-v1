import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { llm } from "@/lib/llm";
import type { LLMMessage, LLMTool } from "@/lib/llm/types";

// ── Server actions used as tools ──────────────────────────────────────────────
import { getDashboardData } from "@/actions/dashboardActions";
import {
  getCases,
  getCaseById,
  createCase,
  updateCaseStatus,
  createNote,
  type NoteCategory,
} from "@/actions/caseActions";
import {
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
} from "@/actions/taskActions";
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/actions/calendarActions";
import {
  getFinancesData,
  createPayment,
  updateCaseAgreedFee,
} from "@/actions/financeActions";

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: LLMTool[] = [
  // READ
  {
    name: "get_dashboard",
    description:
      "Get today's hearings, upcoming events, pending tasks, and a summary of all cases. Use when user asks about their day, schedule, or overall workload.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_cases",
    description: "List all cases for the user with task/note/event counts.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "inactive", "closed"],
          description: "Filter by case status (optional).",
        },
      },
      required: [],
    },
  },
  {
    name: "get_case_detail",
    description:
      "Get full details of a single case including its tasks, notes, and hearings. Requires the case ID.",
    parameters: {
      type: "object",
      properties: {
        caseId: { type: "string", description: "The case ID." },
      },
      required: ["caseId"],
    },
  },
  {
    name: "get_tasks",
    description:
      "List all tasks for the user. Each task includes description, status, due date, and linked case (if any).",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_calendar_events",
    description:
      "List all hearing/calendar events for the user ordered by date.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_finances",
    description:
      "Get financial data: all cases with their agreed fees and payment records. Use when asked about outstanding amounts, receivables, or payments.",
    parameters: { type: "object", properties: {}, required: [] },
  },

  // WRITE — CREATE
  {
    name: "create_case",
    description:
      "Create a new legal case/matter. Status is always set to active.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Case title, e.g. 'Sharma v. State'." },
        clientName: { type: "string", description: "Name of the client (optional)." },
        courtName: { type: "string", description: "Name of the court or forum (optional)." },
        agreedFee: { type: "number", description: "Agreed professional fee in INR (optional)." },
      },
      required: ["title"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task. Can be linked to a case or independent. Use get_cases to find caseId if needed.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "What needs to be done." },
        caseId: { type: "string", description: "Case ID to link the task to (optional)." },
        dueDate: {
          type: "string",
          description: "ISO 8601 due date, e.g. '2026-06-15T00:00:00Z' (optional).",
        },
      },
      required: ["description"],
    },
  },
  {
    name: "create_hearing",
    description:
      "Create a new hearing / calendar event. Must be linked to an existing case. Use get_cases to find caseId.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title for the hearing." },
        caseId: { type: "string", description: "Case ID this hearing belongs to." },
        hearingDate: {
          type: "string",
          description: "ISO 8601 date-time for the hearing, e.g. '2026-06-15T10:00:00Z'.",
        },
        description: { type: "string", description: "Optional notes about the hearing." },
      },
      required: ["title", "caseId", "hearingDate"],
    },
  },
  {
    name: "create_note",
    description:
      "Add a note to a case. Categories: General Note, Client Update, Next Date, Task.",
    parameters: {
      type: "object",
      properties: {
        caseId: { type: "string", description: "Case ID." },
        cleanContent: { type: "string", description: "The note content." },
        category: {
          type: "string",
          enum: ["General Note", "Client Update", "Next Date", "Task"],
          description: "Note category.",
        },
      },
      required: ["caseId", "cleanContent", "category"],
    },
  },
  {
    name: "create_payment",
    description:
      "Record a payment received for a case. Use get_finances or get_cases to find the caseId.",
    parameters: {
      type: "object",
      properties: {
        caseId: { type: "string", description: "Case ID." },
        amount: { type: "number", description: "Amount in INR." },
        status: {
          type: "string",
          enum: ["paid", "pending"],
          description: "Payment status — defaults to 'paid'.",
        },
        dueDate: {
          type: "string",
          description: "Due date for pending payments (ISO 8601, optional).",
        },
      },
      required: ["caseId", "amount"],
    },
  },

  // WRITE — UPDATE
  {
    name: "update_task_status",
    description: "Mark a task as completed or pending.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID." },
        status: { type: "string", enum: ["pending", "completed"] },
      },
      required: ["taskId", "status"],
    },
  },
  {
    name: "update_task",
    description:
      "Update a task's description, due date, or linked case. Use get_tasks to find taskId.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID." },
        description: { type: "string", description: "New description (optional)." },
        dueDate: {
          type: "string",
          description: "New due date ISO 8601, or null to clear (optional).",
        },
        caseId: {
          type: "string",
          description: "New case ID to link, or null to unlink (optional).",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "update_hearing",
    description:
      "Reschedule or update details of an existing hearing. Use get_calendar_events to find hearingId.",
    parameters: {
      type: "object",
      properties: {
        hearingId: { type: "string", description: "CalendarEvent ID." },
        title: { type: "string", description: "New title (optional)." },
        hearingDate: {
          type: "string",
          description: "New date-time ISO 8601 (optional).",
        },
        description: { type: "string", description: "Updated notes (optional)." },
      },
      required: ["hearingId"],
    },
  },
  {
    name: "update_case_status",
    description: "Change the status of a case to active, inactive, or closed.",
    parameters: {
      type: "object",
      properties: {
        caseId: { type: "string", description: "Case ID." },
        status: { type: "string", enum: ["active", "inactive", "closed"] },
      },
      required: ["caseId", "status"],
    },
  },
  {
    name: "update_case_fee",
    description: "Update the agreed professional fee for a case.",
    parameters: {
      type: "object",
      properties: {
        caseId: { type: "string", description: "Case ID." },
        agreedFee: { type: "number", description: "New agreed fee in INR." },
      },
      required: ["caseId", "agreedFee"],
    },
  },

  // WRITE — DELETE
  {
    name: "delete_task",
    description:
      "Permanently delete a task. Only call this after explicitly confirming with the user what will be deleted.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID to delete." },
      },
      required: ["taskId"],
    },
  },
  {
    name: "delete_hearing",
    description:
      "Permanently delete / cancel a hearing. Only call this after explicitly confirming with the user what will be deleted.",
    parameters: {
      type: "object",
      properties: {
        hearingId: { type: "string", description: "CalendarEvent ID to delete." },
      },
      required: ["hearingId"],
    },
  },
];

// ── Dedup helpers ─────────────────────────────────────────────────────────────

/**
 * Normalize a case title for fuzzy comparison:
 * lowercase, drop punctuation, collapse v./vs/versus → "v",
 * collapse whitespace, drop common stopwords ("the", "case", "of", "matter").
 */
function normalizeCaseTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(v\.?|vs\.?|versus)\b/g, "v")
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(the|case|of|matter|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein-distance-based similarity ratio in [0,1]. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>
): Promise<{ result: string; action?: string }> {
  const args = rawArgs as {
    title: string;
    clientName: string;
    courtName: string;
    agreedFee: number;
    description: string;
    caseId: string;
    dueDate: string | null;
    hearingDate: string;
    cleanContent: string;
    category: NoteCategory;
    amount: number;
    status: string;
    taskId: string;
    hearingId: string;
  };
  switch (name) {
    case "get_dashboard": {
      const data = await getDashboardData();
      return { result: JSON.stringify(data) };
    }
    case "get_cases": {
      const cases = await getCases();
      const filtered = args.status
        ? cases.filter((c) => c.status === args.status)
        : cases;
      return { result: JSON.stringify(filtered) };
    }
    case "get_case_detail": {
      const c = await getCaseById(args.caseId);
      return { result: JSON.stringify(c) };
    }
    case "get_tasks": {
      const tasks = await getTasks();
      return { result: JSON.stringify(tasks) };
    }
    case "get_calendar_events": {
      const events = await getCalendarEvents();
      return { result: JSON.stringify(events) };
    }
    case "get_finances": {
      const data = await getFinancesData();
      return { result: JSON.stringify(data) };
    }
    case "create_case": {
      // Server-side dedup guard — prevents the agent from creating a near-duplicate case.
      const existing = await getCases();
      const incomingNorm = normalizeCaseTitle(args.title);
      const match = existing.find((c) => {
        const existingNorm = normalizeCaseTitle(c.title);
        return existingNorm === incomingNorm || similarity(existingNorm, incomingNorm) >= 0.82;
      });
      if (match) {
        return {
          result: `A similar case already exists: title="${match.title}", id="${match.id}". Use this existing case ID instead — do NOT create a duplicate. If the user wanted a hearing, task, or note for this case, call create_hearing/create_task/create_note with caseId="${match.id}".`,
        };
      }
      await createCase({
        title: args.title,
        clientName: args.clientName,
        courtName: args.courtName,
        agreedFee: args.agreedFee,
      });
      return { result: "Case created.", action: `✅ Created case: ${args.title}` };
    }
    case "create_task": {
      await createTask({
        description: args.description,
        caseId: args.caseId,
        dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
      });
      return { result: "Task created.", action: `✅ Created task: ${args.description}` };
    }
    case "create_hearing": {
      await createCalendarEvent({
        title: args.title,
        caseId: args.caseId,
        hearingDate: new Date(args.hearingDate),
        description: args.description,
      });
      return {
        result: "Hearing created.",
        action: `✅ Scheduled hearing: ${args.title} on ${new Date(args.hearingDate).toLocaleDateString("en-IN")}`,
      };
    }
    case "create_note": {
      await createNote({
        caseId: args.caseId,
        cleanContent: args.cleanContent,
        category: args.category,
        source: "manual",
      });
      return { result: "Note created.", action: `✅ Added note (${args.category})` };
    }
    case "create_payment": {
      await createPayment({
        caseId: args.caseId,
        amount: args.amount,
        status: args.status,
        dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
      });
      return {
        result: "Payment recorded.",
        action: `✅ Recorded payment: ₹${args.amount.toLocaleString("en-IN")}`,
      };
    }
    case "update_task_status": {
      await updateTaskStatus(args.taskId, args.status as "pending" | "completed");
      return {
        result: "Task status updated.",
        action: `✅ Marked task as ${args.status}`,
      };
    }
    case "update_task": {
      await updateTask(args.taskId, {
        description: args.description,
        dueDate: args.dueDate === null ? null : args.dueDate ? new Date(args.dueDate) : undefined,
        caseId: args.caseId,
      });
      return { result: "Task updated.", action: `✅ Updated task` };
    }
    case "update_hearing": {
      await updateCalendarEvent(args.hearingId, {
        title: args.title,
        hearingDate: args.hearingDate ? new Date(args.hearingDate) : undefined,
        description: args.description,
      });
      return { result: "Hearing updated.", action: `✅ Updated hearing` };
    }
    case "update_case_status": {
      await updateCaseStatus(args.caseId, args.status);
      return {
        result: "Case status updated.",
        action: `✅ Case marked as ${args.status}`,
      };
    }
    case "update_case_fee": {
      await updateCaseAgreedFee(args.caseId, args.agreedFee);
      return {
        result: "Agreed fee updated.",
        action: `✅ Updated agreed fee to ₹${args.agreedFee.toLocaleString("en-IN")}`,
      };
    }
    case "delete_task": {
      await deleteTask(args.taskId);
      return { result: "Task deleted.", action: `🗑️ Deleted task` };
    }
    case "delete_hearing": {
      await deleteCalendarEvent(args.hearingId);
      return { result: "Hearing deleted.", action: `🗑️ Cancelled hearing` };
    }
    default:
      return { result: `Unknown tool: ${name}` };
  }
}

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
