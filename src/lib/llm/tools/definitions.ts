import type { LLMTool } from "@/lib/llm/types";
import { CASE_TYPES } from "@/lib/case-constants";

// ── Tool definitions ──────────────────────────────────────────────────────────

export const TOOLS: LLMTool[] = [
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
          enum: ["ACTIVE", "CLOSED"],
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
      "List all tasks for the user. Each task is linked to a case and includes description, status, due date, urgency flag, assignee, and case info (id, title, caseNumber).",
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
      "Create a new legal case/matter. Status is always set to active. caseType is required — pick the closest match from the enum (use OTHER if none fit).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Case title, e.g. 'Sharma v. State'." },
        caseType: {
          type: "string",
          enum: [...CASE_TYPES],
          description: "Type of case. Use OTHER if no specific type fits.",
        },
        clientName: { type: "string", description: "Name of the client (optional)." },
        court: { type: "string", description: "Name of the court or forum (optional)." },
        agreedFee: { type: "number", description: "Agreed professional fee in INR (optional)." },
      },
      required: ["title", "caseType"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task. Link it to a case with caseId (use get_cases to find it), or omit caseId / pass null for an independent task.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "What needs to be done." },
        caseId: {
          type: "string",
          description: "Case ID to link, or null for an independent task (optional).",
        },
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
        nextDate: {
          type: "string",
          description:
            "ISO 8601 date (YYYY-MM-DD) extracted from user input. Include ONLY when category is 'Next Date' AND user mentioned a specific date. Omit otherwise.",
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
    description: "Mark a task as completed or pending. Use get_tasks to find taskId and caseId.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID." },
        caseId: {
          type: "string",
          description: "Case ID the task belongs to, or null for an independent task (optional).",
        },
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
        status: { type: "string", enum: ["ACTIVE", "CLOSED"] },
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
      "Permanently delete a task. Only call this after explicitly confirming with the user what will be deleted. Use get_tasks to find taskId and caseId.",
    parameters: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID to delete." },
        caseId: {
          type: "string",
          description: "Case ID the task belongs to, or null for an independent task (optional).",
        },
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
