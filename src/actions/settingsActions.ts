"use server";

/**
 * Phase 3.2.5b-ii — settings actions on the full 3.2 contract.
 *
 * Contract for every migrated action in this module:
 *   1. "use server"
 *   2. Zod-validate FormData input.
 *   3. Acquire user via getServerUser() (redirects if unauth) — fetched
 *      inside getServerScopedPrisma() / withServerUserContext().
 *   4. Acquire RLS-scoped Prisma via getServerScopedPrisma() for SINGLE
 *      queries, OR withServerUserContext((tx) => ...) for MULTI-query
 *      actions / actions needing atomicity (e.g. read-modify-write of
 *      the preferences JSON column).
 *   5. Include `where: { id: session.id }` as defence-in-depth on every
 *      User-table query. RLS is the primary isolation guarantee; the
 *      app-layer filter is a seatbelt against the current
 *      `relforcerowsecurity = false` posture (where the `postgres`
 *      superuser owner bypasses policies at runtime — see 3.0.1).
 *   6. Return Result<T>:
 *        { ok: true, data: T } | { ok: false, error: string }
 *      Validation errors return Result.error. System errors (Prisma
 *      throws, etc.) propagate as exceptions — DO NOT catch and wrap.
 *
 * BANNED in this module:
 *   db.$transaction([a, b, c])                  // array form
 *   Promise.all([db.x.findMany(), db.y.count()]) // parallel scoped ops
 *
 * NOTE on User table access: 3.2.5a enabled RLS on User with
 * symmetric USING + WITH CHECK policies keyed off
 * current_setting('app.current_user_id', true). Until 3.0.1's FORCE
 * RLS lands, the `postgres` runtime user bypasses these — so the
 * `where: { id: session.id }` defence-in-depth is load-bearing.
 *
 */

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  getServerScopedPrisma,
  getServerUser,
  withServerUserContext,
} from "@/lib/session";
import type { Result } from "@/lib/result";

// ── Preferences shape + helpers ───────────────────────────────────────────────

export type Preferences = {
  barNumber: string;
  firmName: string;
  officeAddress: string;
  jurisdiction: string;
  autoSummarise: boolean;
  voiceLanguage: string;
  notifications: {
    hearingReminders: boolean;
    taskDueReminders: boolean;
    weeklySummary: boolean;
  };
};

const DEFAULT_PREFERENCES: Preferences = {
  barNumber: "",
  firmName: "",
  officeAddress: "",
  jurisdiction: "India (Federal & State)",
  autoSummarise: true,
  voiceLanguage: "English (India)",
  notifications: {
    hearingReminders: true,
    taskDueReminders: true,
    weeklySummary: false,
  },
};

function parsePreferences(raw: string | null): Preferences {
  try {
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const formDataToObject = (formData: FormData): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
};

const formBoolean = z.preprocess(
  (v) => (typeof v === "string" ? v === "true" : Boolean(v)),
  z.boolean(),
);

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty."),
  barNumber: z.string().trim().optional().default(""),
  firmName: z.string().trim().optional().default(""),
  officeAddress: z.string().trim().optional().default(""),
});

const workspaceSchema = z.object({
  jurisdiction: z.string().trim().optional().default(""),
  voiceLanguage: z.string().trim().optional().default(""),
  autoSummarise: formBoolean,
});

const notificationsSchema = z.object({
  hearingReminders: formBoolean,
  taskDueReminders: formBoolean,
  weeklySummary: formBoolean,
});

// ── Queries ───────────────────────────────────────────────────────────────────

export type FullProfile = {
  name: string | null;
  email: string;
  preferences: Preferences;
};

export async function getFullProfile(): Promise<Result<FullProfile | null>> {
  const session = await getServerUser();
  const scoped = await getServerScopedPrisma();
  const user = await scoped.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true, preferences: true },
  });
  if (!user) return { ok: true, data: null };
  return {
    ok: true,
    data: {
      name: user.name,
      email: user.email,
      preferences: parsePreferences(user.preferences),
    },
  };
}

// ── Action result shape (shared by all useActionState mutations) ──────────────

export type ActionResult = Result<{ message: string }>;
export type ActionState = ActionResult | null;

// ── Actions ───────────────────────────────────────────────────────────────────

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { name, barNumber, firmName, officeAddress } = parsed.data;
  const session = await getServerUser();

  await withServerUserContext(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: session.id },
      select: { preferences: true },
    });
    const prefs = parsePreferences(existing?.preferences ?? null);
    prefs.barNumber = barNumber;
    prefs.firmName = firmName;
    prefs.officeAddress = officeAddress;

    await tx.user.update({
      where: { id: session.id },
      data: { name, preferences: JSON.stringify(prefs) },
    });
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, data: { message: "Profile updated successfully." } };
}

export async function updateWorkspacePreferences(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = workspaceSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { jurisdiction, voiceLanguage, autoSummarise } = parsed.data;
  const session = await getServerUser();

  await withServerUserContext(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: session.id },
      select: { preferences: true },
    });
    const prefs = parsePreferences(existing?.preferences ?? null);
    prefs.jurisdiction = jurisdiction || prefs.jurisdiction;
    prefs.voiceLanguage = voiceLanguage || prefs.voiceLanguage;
    prefs.autoSummarise = autoSummarise;

    await tx.user.update({
      where: { id: session.id },
      data: { preferences: JSON.stringify(prefs) },
    });
  });

  revalidatePath("/settings");
  return { ok: true, data: { message: "AI workspace preferences saved." } };
}

export async function updateNotificationPreferences(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = notificationsSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { hearingReminders, taskDueReminders, weeklySummary } = parsed.data;
  const session = await getServerUser();

  await withServerUserContext(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: session.id },
      select: { preferences: true },
    });
    const prefs = parsePreferences(existing?.preferences ?? null);
    prefs.notifications = { hearingReminders, taskDueReminders, weeklySummary };

    await tx.user.update({
      where: { id: session.id },
      data: { preferences: JSON.stringify(prefs) },
    });
  });

  revalidatePath("/settings");
  return { ok: true, data: { message: "Notification preferences saved." } };
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Please confirm your new password."),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"],
});

export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getServerUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { currentPassword, newPassword } = parsed.data;

  if (!session.email) return { ok: false, error: "Session missing email." };

  type AuthUserRow = { id: string; email: string; name: string | null; password: string }

  const userRows = await prisma.$queryRaw<AuthUserRow[]>`
    SELECT id, email, name, password
    FROM public.auth_find_user_by_email(${session.email})
  `
  const user = userRows[0] ?? null

  if (!user?.password) return { ok: false, error: "Account has no password set." };

  const valid = await compare(currentPassword, user.password);
  if (!valid) return { ok: false, error: "Current password is incorrect." };

  const hashed = await hash(newPassword, 12);

  const rows = await prisma.$queryRaw<{ id: string; email: string; updatedAt: Date }[]>`
    SELECT id, email, "updatedAt"
    FROM public.auth_update_password(${user.email}, ${hashed})
  `;

  if (rows.length === 0) return { ok: false, error: "User not found." };

  return { ok: true, data: { message: "Password changed successfully." } };
}
