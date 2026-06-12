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
 * NOTE on changePassword: retained on the legacy contract (requireUserId
 * + base prisma + thrown errors / SettingsState shape) pending the
 * 3.0.1 auth-role layer. See TODO marker below.
 */

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUserId } from "@/actions/requireUserId";
import { prisma } from "@/lib/prisma";
import {
  getServerScopedPrisma,
  getServerUser,
  withServerUserContext,
} from "@/lib/session";

// ── Result envelope (mirrors caseActions) ─────────────────────────────────────

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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

// ── Legacy contract (deferred to 3.0.1) ──────────────────────────────────────

/**
 * Legacy action shape preserved for changePassword only — returns
 * { success?, error? } via useActionState, uses requireUserId + base
 * prisma, throws on system errors. Will be migrated to the full 3.2
 * contract once 3.0.1 establishes the auth-role layer (lawdger_app
 * GRANTs + FORCE RLS) and authors the auth_update_password SECURITY
 * DEFINER RPC for password rotation.
 *
 * TODO(3.0.1): Migrate to auth_update_password RPC + Result contract.
 */
export type PasswordState = { success?: string; error?: string };

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const userId = await requireUserId();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !next || !confirm) return { error: "Please fill in all fields." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user?.password) return { error: "Account has no password set." };

  const valid = await compare(current, user.password);
  if (!valid) return { error: "Current password is incorrect." };

  const hashed = await hash(next, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return { success: "Password changed successfully." };
}
