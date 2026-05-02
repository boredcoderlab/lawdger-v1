"use server";

import { compare, hash } from "bcryptjs";
import { revalidatePath } from "next/cache";

import { requireUserId } from "@/actions/requireUserId";
import prisma from "@/lib/prisma";

export type SettingsState = { success?: string; error?: string };

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getFullProfile() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, preferences: true },
  });
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    preferences: parsePreferences(user.preferences),
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const userId = await requireUserId();

  const name = String(formData.get("name") ?? "").trim();
  const barNumber = String(formData.get("barNumber") ?? "").trim();
  const firmName = String(formData.get("firmName") ?? "").trim();
  const officeAddress = String(formData.get("officeAddress") ?? "").trim();

  if (!name) return { error: "Name cannot be empty." };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = parsePreferences(user?.preferences ?? null);
  prefs.barNumber = barNumber;
  prefs.firmName = firmName;
  prefs.officeAddress = officeAddress;

  await prisma.user.update({
    where: { id: userId },
    data: { name, preferences: JSON.stringify(prefs) },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: "Profile updated successfully." };
}

export async function changePassword(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
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

export async function updateWorkspacePreferences(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const userId = await requireUserId();

  const jurisdiction = String(formData.get("jurisdiction") ?? "").trim();
  const voiceLanguage = String(formData.get("voiceLanguage") ?? "").trim();
  const autoSummarise = formData.get("autoSummarise") === "true";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = parsePreferences(user?.preferences ?? null);
  prefs.jurisdiction = jurisdiction || prefs.jurisdiction;
  prefs.voiceLanguage = voiceLanguage || prefs.voiceLanguage;
  prefs.autoSummarise = autoSummarise;

  await prisma.user.update({
    where: { id: userId },
    data: { preferences: JSON.stringify(prefs) },
  });

  revalidatePath("/settings");
  return { success: "AI workspace preferences saved." };
}

export async function updateNotificationPreferences(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const userId = await requireUserId();

  const hearingReminders = formData.get("hearingReminders") === "true";
  const taskDueReminders = formData.get("taskDueReminders") === "true";
  const weeklySummary = formData.get("weeklySummary") === "true";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = parsePreferences(user?.preferences ?? null);
  prefs.notifications = { hearingReminders, taskDueReminders, weeklySummary };

  await prisma.user.update({
    where: { id: userId },
    data: { preferences: JSON.stringify(prefs) },
  });

  revalidatePath("/settings");
  return { success: "Notification preferences saved." };
}
