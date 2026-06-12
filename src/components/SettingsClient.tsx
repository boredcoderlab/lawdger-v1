"use client";

import { useActionState, useState } from "react";
import {
  User, Lock, Bell, Check, AlertCircle, Shield, Settings, Zap
} from "lucide-react";
import {
  updateProfile,
  changePassword,
  updateWorkspacePreferences,
  updateNotificationPreferences,
  type ActionState,
  type PasswordState,
  type Preferences,
} from "@/actions/settingsActions";
import { PageLayout, DarkPaneHeaderTitle, ContentHeading } from "@/components/ui/LayoutShell";

// ── Shared UI ─────────────────────────────────────────────────────────────────

type BannerShape = { success?: string; error?: string };

function bannerFromResult(state: ActionState): BannerShape {
  if (!state) return {};
  if (state.ok) return { success: state.data.message };
  return { error: state.error };
}

function StatusBanner({ banner }: { banner: BannerShape }) {
  if (!banner.success && !banner.error) return null;
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm border ${
      banner.success
        ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
        : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
    } mb-6`}>
      {banner.success
        ? <Check className="h-4 w-4 shrink-0" />
        : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span className="font-medium">{banner.success ?? banner.error}</span>
    </div>
  );
}

function Card({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-card overflow-hidden backdrop-blur-xl mb-8">
      <div className="flex items-center gap-3 border-b border-white/60 dark:border-[var(--border)] px-6 py-5 bg-white/95 dark:bg-[var(--surface-2)]">
        <div className="h-9 w-9 rounded-xl bg-primary/10 dark:bg-[rgba(212,175,55,0.12)] border border-primary/20 dark:border-[rgba(212,175,55,0.28)] flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary dark:text-[var(--gold-text)]" />
        </div>
        <h2 className="font-serif text-[1.2rem] font-semibold text-lawdger-espresso dark:text-foreground">{title}</h2>
      </div>
      <div className="px-8 py-6 space-y-6">{children}</div>
    </div>
  );
}

function Field({ label, name, type = "text", defaultValue, placeholder, disabled }: {
  label: string; name: string; type?: string;
  defaultValue?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </label>
      <input
        type={type} name={name} defaultValue={defaultValue}
        placeholder={placeholder} disabled={disabled}
        className={`w-full bg-white/95 dark:bg-[var(--surface-inset)] border border-white/50 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-gray-900 dark:text-foreground focus:outline-none focus:border-primary dark:focus:border-[var(--gold-text)] focus:ring-1 focus:ring-primary dark:focus:ring-[var(--gold-text)]/30 transition-all placeholder:text-muted-foreground/60 shadow-sm ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
    </div>
  );
}

function SaveButton({ pending, label = "Save Changes" }: { pending: boolean; label?: string }) {
  return (
    <div className="pt-2">
        <button
        type="submit" disabled={pending}
        className="btn-gold px-8 py-3 text-[12px] uppercase tracking-widest"
        >
        {pending ? "Saving..." : label}
        </button>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ name, checked, onChange, label, sub }: {
  name: string; checked: boolean;
  onChange: (v: boolean) => void;
  label: string; sub: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-5 rounded-2xl border border-white/60 dark:border-[var(--border)] surface-inner bg-white/90 dark:bg-[var(--surface-2)] shadow-sm">
      <div>
        <p className="text-[14px] font-bold text-gray-900 dark:text-foreground">{label}</p>
        <p className="text-[12px] font-medium text-muted-foreground dark:text-foreground-secondary mt-0.5">{sub}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full shrink-0 transition-colors shadow-inner border ${
          checked
            ? "bg-primary border-primary/40 dark:bg-[rgba(212,175,55,0.35)] dark:border-[rgba(212,175,55,0.55)]"
            : "bg-black/10 border-black/5 dark:bg-[var(--surface-inset)] dark:border-[var(--border)]"
        }`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-foreground transition-transform shadow-sm ${
          checked ? "translate-x-[22px] dark:ring-1 dark:ring-[var(--gold-text)]" : "translate-x-1"
        }`} />
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
    <div className="flex items-start justify-between gap-4 p-5 rounded-2xl border border-white/60 dark:border-[var(--border)] surface-inner bg-white/90 dark:bg-[var(--surface-2)] shadow-sm">
      <div className="flex-1">
        <p className="text-[14px] font-bold text-gray-900 dark:text-foreground">{label}</p>
        {sub && <p className="text-[12px] font-medium text-muted-foreground dark:text-foreground-secondary mt-0.5 pr-4">{sub}</p>}
      </div>
      <select
        name={name} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white dark:bg-[var(--surface-inset)] border border-white/50 dark:border-[var(--border)] rounded-xl px-4 py-2.5 text-[13px] font-medium text-gray-900 dark:text-foreground focus:outline-none focus:border-primary dark:focus:border-[var(--gold-text)] transition-all shrink-0 min-w-[200px] shadow-sm appearance-none cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "account",       label: "Profile Identity",       icon: User },
  { id: "ai-workspace",  label: "AI Configurations",      icon: Zap },
  { id: "notifications", label: "Digests & Alerts",       icon: Bell },
  { id: "security",      label: "Account Security",       icon: Shield },
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

  const [profileState, profileAction, profilePending] =
    useActionState<ActionState, FormData>(updateProfile, null);
  const [pwState, pwAction, pwPending] =
    useActionState<PasswordState, FormData>(changePassword, {});
  const [wsState, wsAction, wsPending] =
    useActionState<ActionState, FormData>(updateWorkspacePreferences, null);
  const [notifState, notifAction, notifPending] =
    useActionState<ActionState, FormData>(updateNotificationPreferences, null);

  return (
    <PageLayout
      pageTitle="Settings"
      darkPaneHeader={
        <DarkPaneHeaderTitle icon={Settings} title="Settings" subtitle="Workspace Preferences" />
      }
      darkPaneContent={
        <>
          {/* Profile Overview Card — raised cream-on-espresso tile (light) /
              step-up surface (dark). bg-lawdger-sidebar (#15110F both modes)
              was reading as a black blob on the espresso pane in light. */}
          <div className="bg-[var(--card)] dark:bg-[#3A322C] rounded-[1.5rem] p-5 mb-10 border border-lawdger-cream/30 dark:border-[rgba(255,240,220,0.06)] shadow-[0_4px_12px_-2px_rgba(20,14,10,0.18),inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,240,220,0.06)] shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[var(--gold)] border border-[var(--gold-deep)] flex items-center justify-center text-lawdger-espresso dark:text-[var(--gold-ink)] font-serif text-xl font-bold shadow-[0_2px_8px_rgba(212,175,55,0.35)]">
                {name ? name.charAt(0) : "U"}
              </div>
              <div>
                <h3 className="font-bold text-[15px] text-lawdger-espresso dark:text-foreground">{name || "User Name"}</h3>
                <p className="text-[12px] font-medium text-lawdger-espresso/60 dark:text-foreground-secondary">{email}</p>
              </div>
            </div>
          </div>

          {/* Vertical Navigation Menu */}
          <div className="flex flex-col gap-2 shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold uppercase tracking-widest text-[11px] overflow-hidden ${
                    isActive
                      ? "bg-[var(--surface-3)] text-[var(--gold-text)]"
                      : "text-lawdger-cream/50 dark:text-foreground-secondary hover:bg-lawdger-cream/5 dark:hover:bg-[var(--surface-2)] hover:text-lawdger-cream dark:hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-[var(--gold)]" />
                  )}
                  <Icon className={`w-4 h-4 ${isActive ? "text-[var(--gold-text)]" : "text-lawdger-cream/40 dark:text-foreground-secondary"}`} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-10 shrink-0">
            <div className="flex items-center gap-2 text-lawdger-cream/30 dark:text-muted-foreground">
              <Shield className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-widest">End-to-End Encrypted Workspace</span>
            </div>
          </div>
        </>
      }
      mainPaneHeader={
        <div>
          <ContentHeading>{TABS.find((t) => t.id === activeTab)?.label}</ContentHeading>
          <p className="text-[12px] font-medium text-muted-foreground mt-2">
            {activeTab === "account" && "Manage your professional identity and contact details."}
            {activeTab === "ai-workspace" && "Configure how your Legal Second Brain behaves."}
            {activeTab === "notifications" && "Tailor your digest and reminder preferences."}
            {activeTab === "security" && "Update your password and security credentials."}
          </p>
        </div>
      }
      mainPaneContent={
        <div className="h-full overflow-y-auto scrollbar-hide p-10 pb-20">
          {/* Account Tab */}
          <div className={activeTab === "account" ? "block animate-in fade-in slide-in-from-right-4 duration-500" : "hidden"}>
            <Card title="Professional Profile" icon={User}>
              <form action={profileAction} className="space-y-6">
                <StatusBanner banner={bannerFromResult(profileState)} />
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Full Name" name="name" defaultValue={name ?? ""} placeholder="Adv. Your Name" />
                  <Field label="Bar Registration No." name="barNumber" defaultValue={preferences.barNumber} placeholder="e.g. D/1425/2012" />
                </div>
                <Field label="Firm / Practice Name" name="firmName" defaultValue={preferences.firmName} placeholder="e.g. Sharma & Associates" />
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    Office Address
                  </label>
                  <textarea
                    name="officeAddress"
                    defaultValue={preferences.officeAddress}
                    rows={3}
                    placeholder="Chamber no., Court complex, City"
                    className="w-full bg-white/95 dark:bg-[var(--surface-inset)] border border-white/50 dark:border-[var(--border)] rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-primary dark:focus:border-[var(--gold-text)] focus:ring-1 focus:ring-primary dark:focus:ring-[var(--gold-text)]/30 transition-all placeholder:text-muted-foreground/60 resize-none shadow-sm"
                  />
                </div>
                <div className="opacity-70">
                  <Field label="Email Address (Locked)" name="email" defaultValue={email} disabled />
                </div>
                <SaveButton pending={profilePending} />
              </form>
            </Card>
          </div>

          {/* Security Tab */}
          <div className={activeTab === "security" ? "block animate-in fade-in slide-in-from-right-4 duration-500" : "hidden"}>
            <Card title="Access Credentials" icon={Lock}>
              <form action={pwAction} className="space-y-6">
                <StatusBanner banner={pwState} />
                <Field label="Current Password" name="currentPassword" type="password" placeholder="Enter current password" />
                <Field label="New Password" name="newPassword" type="password" placeholder="At least 8 characters" />
                <Field label="Confirm New Password" name="confirmPassword" type="password" placeholder="Repeat new password" />
                <SaveButton pending={pwPending} label="Update Credentials" />
              </form>
            </Card>
          </div>

          {/* AI Workspace Tab */}
          <div className={activeTab === "ai-workspace" ? "block animate-in fade-in slide-in-from-right-4 duration-500" : "hidden"}>
            <Card title="Brain Configuration" icon={Zap}>
              <form action={wsAction} className="space-y-6">
                <StatusBanner banner={bannerFromResult(wsState)} />
                <SelectField
                  label="Primary Jurisdiction"
                  name="jurisdiction"
                  value={jurisdiction}
                  onChange={setJurisdiction}
                  sub="Sets the context for citations and legal precedents."
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
                  label="Voice Dictation Engine"
                  name="voiceLanguage"
                  value={voiceLanguage}
                  onChange={setVoiceLanguage}
                  sub="Primary language model for transcriptions."
                  options={["English (India)", "Hindi", "Hinglish (Hindi + English)", "Marathi", "Tamil", "Telugu"]}
                />
                <Toggle
                  name="autoSummarise"
                  checked={autoSummarise}
                  onChange={setAutoSummarise}
                  label="Auto-summarise Case Logs"
                  sub="Generate brief summaries automatically when new logs are added."
                />
                <SaveButton pending={wsPending} />
              </form>
            </Card>
          </div>

          {/* Notifications Tab */}
          <div className={activeTab === "notifications" ? "block animate-in fade-in slide-in-from-right-4 duration-500" : "hidden"}>
            <Card title="Notification Matrix" icon={Bell}>
              <form action={notifAction} className="space-y-6">
                <StatusBanner banner={bannerFromResult(notifState)} />
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
                  label="Task Deadlines"
                  sub="Receive alerts when delegation tasks are due today or overdue."
                />
                <Toggle
                  name="weeklySummary"
                  checked={weeklySummary}
                  onChange={setWeeklySummary}
                  label="Weekly Master Digest"
                  sub="A Monday morning summary of upcoming hearings and open tasks."
                />
                <SaveButton pending={notifPending} />
              </form>
            </Card>
          </div>
        </div>
      }
    />
  );
}
