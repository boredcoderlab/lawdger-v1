import { z } from "zod";
import { CASE_TYPES } from "@/lib/case-constants";

// One zod schema per tool. Structural mirror of the JSON Schema in
// definitions.ts. Validated at the dispatcher boundary before any handler call.

export const toolSchemas = {
  // ── READ ────────────────────────────────────────────────────────────────────
  get_dashboard: z.object({}),

  get_cases: z.object({
    status: z.enum(["ACTIVE", "CLOSED"]).optional(),
  }),

  get_case_detail: z.object({
    caseId: z.string(),
  }),

  get_tasks: z.object({}),

  get_calendar_events: z.object({}),

  get_finances: z.object({}),

  // ── WRITE — CREATE ──────────────────────────────────────────────────────────
  create_case: z.object({
    title: z.string(),
    caseType: z.enum(CASE_TYPES),
    clientName: z.string().optional(),
    court: z.string().optional(),
    agreedFee: z.number().optional(),
  }),

  create_task: z.object({
    description: z.string(),
    caseId: z.string(),
    dueDate: z.string().optional(),
  }),

  create_hearing: z.object({
    title: z.string(),
    caseId: z.string(),
    hearingDate: z.string(),
    description: z.string().optional(),
  }),

  create_note: z.object({
    caseId: z.string(),
    cleanContent: z.string(),
    category: z.enum(["General Note", "Client Update", "Next Date", "Task"]),
    nextDate: z.string().optional(),
  }),

  create_payment: z.object({
    caseId: z.string(),
    amount: z.number(),
    status: z.enum(["paid", "pending"]).optional(),
    dueDate: z.string().optional(),
  }),

  // ── WRITE — UPDATE ──────────────────────────────────────────────────────────
  update_task_status: z.object({
    taskId: z.string(),
    caseId: z.string(),
    status: z.enum(["pending", "completed"]),
  }),

  update_task: z.object({
    taskId: z.string(),
    description: z.string().optional(),
    dueDate: z.string().nullable().optional(),
    caseId: z.string().nullable().optional(),
  }),

  update_hearing: z.object({
    hearingId: z.string(),
    title: z.string().optional(),
    hearingDate: z.string().optional(),
    description: z.string().optional(),
  }),

  update_case_status: z.object({
    caseId: z.string(),
    status: z.enum(["ACTIVE", "CLOSED"]),
  }),

  update_case_fee: z.object({
    caseId: z.string(),
    agreedFee: z.number(),
  }),

  // ── WRITE — DELETE ──────────────────────────────────────────────────────────
  delete_task: z.object({
    taskId: z.string(),
    caseId: z.string(),
  }),

  delete_hearing: z.object({
    hearingId: z.string(),
  }),
} as const;

export type ToolName = keyof typeof toolSchemas;

export function isToolName(name: string): name is ToolName {
  return name in toolSchemas;
}
