export type TaskBucket = "unassigned" | "my-plate" | "associates";

// Three-bucket grouping for /tasks Kanban. Pure — no Prisma / no session imports.
//
// Rules (per PHASE_4_PLAN §7 A3 + Pillar A locked decisions):
//   - assignee null / empty / "Unassigned" (schema default, case-insensitive) → "unassigned"
//   - normalized assignee equals normalized userName (when userName non-empty) → "my-plate"
//   - otherwise                                                                → "associates"
export function bucketTask(
  task: { assignee: string | null },
  userName: string | null,
): TaskBucket {
  const a = (task.assignee ?? "").trim().toLowerCase();
  if (!a || a === "unassigned") return "unassigned";
  const n = (userName ?? "").trim().toLowerCase();
  if (n && a === n) return "my-plate";
  return "associates";
}
