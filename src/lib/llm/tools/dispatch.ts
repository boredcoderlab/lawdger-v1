import { z } from "zod";
import { formatINR } from "@/lib/format";
import { toolSchemas, isToolName, type ToolName } from "./schemas";

// ── Server actions used as tools ──────────────────────────────────────────────
import { getDashboardData } from "@/actions/dashboardActions";
import {
  listCases,
  getCase,
  createCase,
  updateCaseStatus,
} from "@/actions/caseActions";
import { createNote } from "@/actions/noteActions";
import type { CaseStatus } from "@prisma/client";
import {
  updateTask,
  updateCaseTask,
  listAllTasks,
  createTask,
  createCaseTask,
  updateTaskStatus,
  toggleCaseTaskStatus,
  deleteTask,
  deleteCaseTask,
} from "@/actions/taskActions";
import { getServerScopedPrisma } from "@/lib/session";
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

// ── Per-tool schema-bound dispatch helper ────────────────────────────────────

type ToolResult = { result: string; action?: string };

/**
 * Validate rawArgs against the named tool's zod schema before invoking the
 * handler. On parse failure, returns a tool-error message — never throws.
 */
async function withSchema<K extends ToolName>(
  name: K,
  rawArgs: unknown,
  handler: (args: z.infer<(typeof toolSchemas)[K]>) => Promise<ToolResult>,
): Promise<ToolResult> {
  const parsed = toolSchemas[name].safeParse(rawArgs);
  if (!parsed.success) {
    return {
      result: `Error: invalid args for ${name} — ${parsed.error.message}`,
    };
  }
  return handler(parsed.data as z.infer<(typeof toolSchemas)[K]>);
}

// ── Tool executor ─────────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
): Promise<ToolResult> {
  if (!isToolName(name)) {
    return { result: `Unknown tool: ${name}` };
  }

  switch (name) {
    case "get_dashboard":
      return withSchema("get_dashboard", rawArgs, async () => {
        const result = await getDashboardData();
        if (!result.ok) return { result: result.error };
        return { result: JSON.stringify(result.data) };
      });

    case "get_cases":
      return withSchema("get_cases", rawArgs, async (args) => {
        const result = await listCases(
          args.status ? { status: args.status as CaseStatus } : undefined,
        );
        if (!result.ok) return { result: result.error };
        return { result: JSON.stringify(result.data.items) };
      });

    case "get_case_detail":
      return withSchema("get_case_detail", rawArgs, async (args) => {
        const result = await getCase(args.caseId);
        if (!result.ok) return { result: result.error };
        return { result: JSON.stringify(result.data) };
      });

    case "get_tasks":
      return withSchema("get_tasks", rawArgs, async () => {
        const result = await listAllTasks();
        if (!result.ok) return { result: result.error };
        return { result: JSON.stringify(result.data) };
      });

    case "get_calendar_events":
      return withSchema("get_calendar_events", rawArgs, async () => {
        const result = await getCalendarEvents();
        if (!result.ok) return { result: result.error };
        return { result: JSON.stringify(result.data) };
      });

    case "get_finances":
      return withSchema("get_finances", rawArgs, async () => {
        const result = await getFinancesData();
        if (!result.ok) return { result: result.error };
        return { result: JSON.stringify(result.data) };
      });

    case "create_case":
      return withSchema("create_case", rawArgs, async (args) => {
        // Server-side dedup guard — prevents the agent from creating a near-duplicate case.
        const existingResult = await listCases({ take: 200 });
        if (!existingResult.ok) return { result: existingResult.error };
        const incomingNorm = normalizeCaseTitle(args.title);
        const match = existingResult.data.items.find((c) => {
          const existingNorm = normalizeCaseTitle(c.title);
          return existingNorm === incomingNorm || similarity(existingNorm, incomingNorm) >= 0.82;
        });
        if (match) {
          return {
            result: `A similar case already exists: title="${match.title}", id="${match.id}". Use this existing case ID instead — do NOT create a duplicate. If the user wanted a hearing, task, or note for this case, call create_hearing/create_task/create_note with caseId="${match.id}".`,
          };
        }
        const created = await createCase({
          title: args.title,
          clientName: args.clientName,
          court: args.court,
          agreedFee: args.agreedFee,
          caseType: args.caseType,
        });
        if (!created.ok) return { result: created.error };
        return { result: "Case created.", action: `✅ Created case: ${args.title}` };
      });

    case "create_task":
      return withSchema("create_task", rawArgs, async (args) => {
        // Single-call path (mirrors CalendarClient): createTask accepts a UUID
        // or null caseId. null/omitted → independent task; UUID → case-linked.
        const result = await createTask({
          caseId: args.caseId ?? null,
          description: args.description,
          dueDate: args.dueDate ? new Date(args.dueDate) : null,
          assignee: null,
        });
        if (!result.ok) return { result: result.error };
        return { result: "Task created.", action: `✅ Created task: ${args.description}` };
      });

    case "create_hearing":
      return withSchema("create_hearing", rawArgs, async (args) => {
        const result = await createCalendarEvent({
          title: args.title,
          caseId: args.caseId,
          hearingDate: new Date(args.hearingDate),
          description: args.description,
        });
        if (!result.ok) return { result: result.error };
        return {
          result: "Hearing created.",
          action: `✅ Scheduled hearing: ${args.title} on ${new Date(args.hearingDate).toLocaleDateString("en-IN")}`,
        };
      });

    case "create_note":
      return withSchema("create_note", rawArgs, async (args) => {
        const result = await createNote({
          caseId: args.caseId,
          cleanContent: args.cleanContent,
          category: args.category,
          source: "manual",
          nextDate: args.nextDate,
        });
        if (!result.ok) return { result: result.error };
        return { result: "Note created.", action: `✅ Added note (${args.category})` };
      });

    case "create_payment":
      return withSchema("create_payment", rawArgs, async (args) => {
        const result = await createPayment({
          caseId: args.caseId,
          amount: args.amount,
          status: args.status,
          dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
        });
        if (!result.ok) return { result: result.error };
        return {
          result: "Payment recorded.",
          action: `✅ Recorded payment: ${formatINR(args.amount)}`,
        };
      });

    case "update_task_status":
      return withSchema("update_task_status", rawArgs, async (args) => {
        // Pre-flight (RLS-only, scoped — mirrors update_task) to discover the
        // task's real caseId; the DB is authoritative, args.caseId is ignored
        // for routing. Independent tasks (caseId null in DB) → updateTaskStatus
        // (idempotent set). Case-linked → toggleCaseTaskStatus adapter, which
        // is a TOGGLE, so read current status and no-op if already target.
        const db = await getServerScopedPrisma();
        const existing = await db.task.findFirst({
          where: { id: args.taskId },
          select: { status: true, caseId: true },
        });
        if (!existing) return { result: "Task not found." };
        if (existing.status === args.status) {
          return { result: `Task already ${args.status}.` };
        }
        const result = existing.caseId
          ? await toggleCaseTaskStatus(args.taskId, existing.status, existing.caseId)
          : await updateTaskStatus(args.taskId, args.status);
        if (!result.ok) return { result: result.error };
        return {
          result: "Task status updated.",
          action: `✅ Marked task as ${args.status}`,
        };
      });

    case "update_task":
      return withSchema("update_task", rawArgs, async (args) => {
        // Normalize dueDate: null → null (unlink), undefined → undefined
        // (unchanged), string → Date.
        const normalizedDueDate =
          args.dueDate === null
            ? null
            : args.dueDate
              ? new Date(args.dueDate)
              : undefined;

        // caseId provided (nullable): route to updateTask.
        // null → unlink from case; string → move/set to case.
        // Since Independent Tasks migration (#37), null is a real write, not a no-op.
        if (args.caseId !== undefined) {
          const result = await updateTask(args.taskId, {
            description: args.description,
            dueDate: normalizedDueDate,
            caseId: args.caseId,
          });
          if (!result.ok) return { result: result.error };
          return { result: "Task updated.", action: `✅ Updated task` };
        }

        // caseId omitted → pre-flight fetch (scoped, RLS-isolated) to route.
        const db = await getServerScopedPrisma();
        const existing = await db.task.findFirst({
          where: { id: args.taskId },
          select: { caseId: true },
        });
        if (!existing) {
          return { result: "Task not found or not yours" };
        }

        if (!existing.caseId) {
          // Independent task (caseId null in DB) — live path since the
          // Independent-Tasks migration (#37). updateCaseTask requires a
          // case, so route to updateTask for the field update.
          const result = await updateTask(args.taskId, {
            description: args.description,
            dueDate: normalizedDueDate,
          });
          if (!result.ok) return { result: result.error };
          return { result: "Task updated.", action: `✅ Updated task` };
        }

        // Case-linked task, no case change → updateCaseTask partial surface
        // (WS2). Only forward fields the LLM provided; omitted → unchanged.
        // The LLM tool schema has no assignee/isUrgent, so those stay
        // untouched by absence.
        const result = await updateCaseTask({
          taskId: args.taskId,
          ...(args.description !== undefined && { description: args.description }),
          ...(normalizedDueDate !== undefined && { dueDate: normalizedDueDate }),
        });
        if (!result.ok) return { result: result.error };
        return { result: "Task updated.", action: `✅ Updated task` };
      });

    case "update_hearing":
      return withSchema("update_hearing", rawArgs, async (args) => {
        const result = await updateCalendarEvent(args.hearingId, {
          title: args.title,
          hearingDate: args.hearingDate ? new Date(args.hearingDate) : undefined,
          description: args.description,
        });
        if (!result.ok) return { result: result.error };
        return { result: "Hearing updated.", action: `✅ Updated hearing` };
      });

    case "update_case_status":
      return withSchema("update_case_status", rawArgs, async (args) => {
        const result = await updateCaseStatus(args.caseId, args.status as CaseStatus);
        if (!result.ok) return { result: result.error };
        return {
          result: "Case status updated.",
          action: `✅ Case marked as ${args.status}`,
        };
      });

    case "update_case_fee":
      return withSchema("update_case_fee", rawArgs, async (args) => {
        const result = await updateCaseAgreedFee(args.caseId, args.agreedFee);
        if (!result.ok) return { result: result.error };
        return {
          result: "Agreed fee updated.",
          action: `✅ Updated agreed fee to ${formatINR(args.agreedFee)}`,
        };
      });

    case "delete_task":
      return withSchema("delete_task", rawArgs, async (args) => {
        // Pre-flight (RLS-only, scoped — mirrors update_task) to discover the
        // task's real caseId; DB authoritative. Independent (caseId null) →
        // deleteTask; case-linked → deleteCaseTask.
        const db = await getServerScopedPrisma();
        const existing = await db.task.findFirst({
          where: { id: args.taskId },
          select: { caseId: true },
        });
        if (!existing) return { result: "Task not found." };
        const result = existing.caseId
          ? await deleteCaseTask(args.taskId, existing.caseId)
          : await deleteTask(args.taskId);
        if (!result.ok) return { result: result.error };
        return { result: "Task deleted.", action: `🗑️ Deleted task` };
      });

    case "delete_hearing":
      return withSchema("delete_hearing", rawArgs, async (args) => {
        const result = await deleteCalendarEvent(args.hearingId);
        if (!result.ok) return { result: result.error };
        return { result: "Hearing deleted.", action: `🗑️ Cancelled hearing` };
      });
  }
}
