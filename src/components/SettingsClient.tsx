"use client";

import { useActionState, useState } from "react";
import {
  User, Lock, Sliders, Bell, Check, AlertCircle, Shield,
} from "lucide-react";
import {
  updateProfile, changePassword, updateWorkspacePreferences,
  updateNotificationPreferences, type SettingsState, type Preferences,
} from "@/actions/settingsActions";

// ── Shared UI ─────────────────────────────────────────────────────────────────

function StatusBanner({ state }: { state: SettingsState }) {
  if (!state.success && !state.error) return null;
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm border ${
      state.success
        ? "bg-green-500/10 border-green-500/20 text-green-400"
        : "bg-red-500/10 border-red-500/20 text-red-400"
    }`}>
      {state.success
        ? <Check className="h-4 w-4 shrink-0" />
        : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span>{state.success ?? state.error}</span>
    </div>
  );
}

function Card({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card overflow-hidden shadow-lg">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <div className="h-8 w-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-accent" />
        </div>
        <h2 className="font-serif text-xl font-medium text-foreground">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, name, type = "text", defaultValue, placeholder, disabled }: {
  label: string; name: string; type?: string;
  defaultValue?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </label>
      <input
        type={type} name={name} defaultValue={defaultValue}
        placeholder={placeholder} disabled={disabled}
        className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-muted-foreground/50 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
    </div>
  );
}

function SaveButton({ pending, label = "Save Changes" }: { pending: boolean; label?: string }) {
  return (
    <button
      type="submit" disabled={pending}
      className="flex items-center gap-2 bg-accent text-accent-foreground px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ name, checked, onChange, label, sub }: {
  name: string; checked: boolean;
  onChange: (v: boolean) => void;
  label: string; sub: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-white/5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs font-light text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full shrink-0 transition-colors ${checked ? "bg-accent" : "bg-white/20"}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-background transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
        <input type="hidden" name={name} value={String(checked)} />
      </button>
    </div>
  );
}

function SelectField({ label, name, value, onChange, options, sub }: {
  label: string; name: string; value: string;
  onChange: (v: string) => void; options: string[]; sub?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-white/5">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs font-light text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <select
        name={name} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-card border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent transition-all shrink-0"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "account",       label: "Account",       icon: Shield },
  { id: "ai-workspace",  label: "AI Workspace",   icon: Sliders },
  { id: "notifications", label: "Notifications",  icon: Bell },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsClient({
  name, email, preferences,
}: {
  name: string | null;
  email: string;
  preferences: Preferences;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("account");

  const [jurisdiction, setJurisdiction] = useState(preferences.jurisdiction);
  const [voiceLanguage, setVoiceLanguage] = useState(preferences.voiceLanguage);
  const [autoSummarise, setAutoSummarise] = useState(preferences.autoSummarise);

  const [hearingReminders, setHearingReminders] = useState(preferences.notifications.hearingReminders);
  const [taskDueReminders, setTaskDueReminders] = useState(preferences.notifications.taskDueReminders);
  const [weeklySummary, setWeeklySummary] = useState(preferences.notifications.weeklySummary);

  const [profileState, profileAction, profilePending] = useActionState<SettingsState, FormData>(updateProfile, {});
  const [pwState, pwAction, pwPending] = useActionState<SettingsState, FormData>(changePassword, {});
  const [wsState, wsAction, wsPending] = useActionState<SettingsState, FormData>(updateWorkspacePreferences, {});
  const [notifState, notifAction, notifPending] = useActionState<SettingsState, FormData>(updateNotificationPreferences, {});

  return (
    <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>

      {/* Tab Nav */}
      <div style={{ width: "200px", flexShrink: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              width: "100%",
              padding: "0.75rem 1rem",
              marginBottom: "0.375rem",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
              cursor: "pointer",
              border: activeTab === id ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
              background: activeTab === id ? "rgba(255,255,255,0.08)" : "transparent",
              color: activeTab === id ? "var(--foreground)" : "var(--muted-foreground)",
              fontWeight: activeTab === id ? 500 : 300,
              textAlign: "left",
            }}
          >
            <Icon style={{ width: "1rem", height: "1rem", flexShrink: 0, color: activeTab === id ? "var(--accent)" : "currentColor" }} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content — always rendered, toggled via display */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Account Tab */}
        <div style={{ display: activeTab === "account" ? "flex" : "none", flexDirection: "column", gap: "1.5rem" }}>
          <Card title="Personal Profile" icon={User}>
            <form action={profileAction} className="space-y-5">
              <StatusBanner state={profileState} />
              <div className="grid grid-cols-2 gap-5">
                <Field label="Full Name" name="name" defaultValue={name ?? ""} placeholder="Adv. Your Name" />
                <Field label="Bar Registration No." name="barNumber" defaultValue={preferences.barNumber} placeholder="e.g. D/1425/2012" />
              </div>
              <Field label="Firm / Practice Name" name="firmName" defaultValue={preferences.firmName} placeholder="e.g. Sharma & Associates" />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Office Address
                </label>
                <textarea
                  name="officeAddress"
                  defaultValue={preferences.officeAddress}
                  rows={3}
                  placeholder="Chamber no., Court complex, City"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-muted-foreground/50 resize-none"
                />
              </div>
              <Field label="Email Address" name="email" defaultValue={email} disabled />
              <p className="text-xs text-muted-foreground/60 -mt-3">Email cannot be changed.</p>
              <SaveButton pending={profilePending} />
            </form>
          </Card>

          <Card title="Change Password" icon={Lock}>
            <form action={pwAction} className="space-y-5">
              <StatusBanner state={pwState} />
              <Field label="Current Password" name="currentPassword" type="password" placeholder="Enter current password" />
              <Field label="New Password" name="newPassword" type="password" placeholder="At least 8 characters" />
              <Field label="Confirm New Password" name="confirmPassword" type="password" placeholder="Repeat new password" />
              <SaveButton pending={pwPending} label="Update Password" />
            </form>
          </Card>
        </div>

        {/* AI Workspace Tab */}
        <div style={{ display: activeTab === "ai-workspace" ? "block" : "none" }}>
          <Card title="AI Workspace" icon={Sliders}>
            <form action={wsAction} className="space-y-4">
              <StatusBanner state={wsState} />
              <p className="text-sm font-light text-muted-foreground pb-1">
                These settings shape how your Legal Brain processes notes and voice input.
              </p>
              <SelectField
                label="Primary Jurisdiction"
                name="jurisdiction"
                value={jurisdiction}
                onChange={setJurisdiction}
                sub="AI will default to this jurisdiction's laws and statutes."
                options={[
                  "India (Federal & State)",
                  "Delhi High Court",
                  "Bombay High Court",
                  "Madras High Court",
                  "Calcutta High Court",
                  "Supreme Court of India",
                ]}
              />
              <SelectField
                label="Voice Dictation Language"
                name="voiceLanguage"
                value={voiceLanguage}
                onChange={setVoiceLanguage}
                sub="Primary language for voice transcription."
                options={["English (India)", "Hindi", "Hinglish (Hindi + English)", "Marathi", "Tamil", "Telugu"]}
              />
              <Toggle
                name="autoSummarise"
                checked={autoSummarise}
                onChange={setAutoSummarise}
                label="Auto-summarise Case Logs"
                sub="Generate a brief summary each time a new note is added to a case."
              />
              <div className="pt-2">
                <SaveButton pending={wsPending} />
              </div>
            </form>
          </Card>
        </div>

        {/* Notifications Tab */}
        <div style={{ display: activeTab === "notifications" ? "block" : "none" }}>
          <Card title="Notifications" icon={Bell}>
            <form action={notifAction} className="space-y-4">
              <StatusBanner state={notifState} />
              <p className="text-sm font-light text-muted-foreground pb-1">
                Control which reminders and digests Lawdger sends you.
              </p>
              <Toggle
                name="hearingReminders"
                checked={hearingReminders}
                onChange={setHearingReminders}
                label="Hearing Reminders"
                sub="Get notified the day before a court hearing is scheduled."
              />
              <Toggle
                name="taskDueReminders"
                checked={taskDueReminders}
                onChange={setTaskDueReminders}
                label="Task Due Reminders"
                sub="Receive a reminder when a task is due today or overdue."
              />
              <Toggle
                name="weeklySummary"
                checked={weeklySummary}
                onChange={setWeeklySummary}
                label="Weekly Digest"
                sub="A Monday morning summary of upcoming hearings and open tasks."
              />
              <div className="pt-2">
                <SaveButton pending={notifPending} />
              </div>
            </form>
          </Card>
        </div>

      </div>
    </div>
  );
}
