"use client";

import { useActionState, useState } from "react";
import {
  User, Lock, Sliders, Bell, Check, AlertCircle, Shield, Settings, Mail, MapPin, Scale, MonitorPlay, Zap
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
        ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400"
        : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
    } mb-6`}>
      {state.success
        ? <Check className="h-4 w-4 shrink-0" />
        : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span className="font-medium">{state.success ?? state.error}</span>
    </div>
  );
}

function Card({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/60 dark:border-white/10 bg-white/70 dark:bg-card/80 overflow-hidden shadow-sm backdrop-blur-xl mb-8">
      <div className="flex items-center gap-3 border-b border-white/60 dark:border-white/10 px-6 py-5 bg-white/95 dark:bg-white/5">
        <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h2 className="font-serif text-[1.2rem] font-bold text-gray-900 dark:text-white">{title}</h2>
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
        className={`w-full bg-white/95 dark:bg-black/30 border border-white/50 dark:border-white/10 rounded-xl px-4 py-3 text-[14px] text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50 shadow-sm ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
    </div>
  );
}

function SaveButton({ pending, label = "Save Changes" }: { pending: boolean; label?: string }) {
  return (
    <div className="pt-2">
        <button
        type="submit" disabled={pending}
        className="bg-primary text-primary-foreground px-8 py-3 rounded-xl text-[12px] uppercase tracking-widest font-bold hover:shadow-[0_0_20px_rgba(200,150,62,0.3)] hover:scale-[1.01] transition-all disabled:opacity-50"
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
    <div className="flex items-start justify-between gap-4 p-5 rounded-2xl border border-white/60 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-sm">
      <div>
        <p className="text-[14px] font-bold text-gray-900 dark:text-white">{label}</p>
        <p className="text-[12px] font-medium text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full shrink-0 transition-colors shadow-inner border border-black/5 dark:border-white/5 ${checked ? "bg-primary" : "bg-black/10 dark:bg-card/80"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${checked ? "translate-x-[22px]" : "translate-x-1"}`} />
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
    <div className="flex items-start justify-between gap-4 p-5 rounded-2xl border border-white/60 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-sm">
      <div className="flex-1">
        <p className="text-[14px] font-bold text-gray-900 dark:text-white">{label}</p>
        {sub && <p className="text-[12px] font-medium text-muted-foreground mt-0.5 pr-4">{sub}</p>}
      </div>
      <select
        name={name} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white dark:bg-black/60 border border-white/50 dark:border-white/10 rounded-xl px-4 py-2.5 text-[13px] font-medium text-gray-900 dark:text-white focus:outline-none focus:border-primary transition-all shrink-0 min-w-[200px] shadow-sm appearance-none cursor-pointer"
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

  const [profileState, profileAction, profilePending] = useActionState<SettingsState, FormData>(updateProfile, {});
  const [pwState, pwAction, pwPending] = useActionState<SettingsState, FormData>(changePassword, {});
  const [wsState, wsAction, wsPending] = useActionState<SettingsState, FormData>(updateWorkspacePreferences, {});
  const [notifState, notifAction, notifPending] = useActionState<SettingsState, FormData>(updateNotificationPreferences, {});

  return (
    <div className="flex flex-col min-h-screen bg-background  text-foreground relative selection:bg-primary/30 p-8 lg:p-12 overflow-x-hidden">
      
      {/* Background Ambience */}
      <div className="fixed top-0 right-0 w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px] pointer-events-none z-0"></div>
      
      {/* ── OVERLAPPING PANES LAYOUT ────────────────────────────────────────── */}
      <div className="relative lg:w-[98%] xl:w-[95%] flex z-20 mx-auto">
        
        {/* Left: Dark Navigator (Settings Menu) */}
        <div className="w-[42%] rounded-[2.5rem] bg-gradient-to-b from-[#3a2c23] to-[#291e16] p-10 pr-20 shadow-[0_30px_60px_rgba(0,0,0,0.4)] min-h-[700px] flex flex-col z-10 border border-white/5 shrink-0">
          
          {/* Header */}
          <div className="flex items-center gap-4 mb-10">
             <div className="w-12 h-12 bg-white/40 rounded-2xl flex items-center justify-center text-white shadow-inner">
                <Settings className="w-6 h-6" />
             </div>
             <div>
                <h1 className="font-serif text-[1.5rem] font-serif font-bold text-[#f4efe8] dark:text-white leading-none">Settings</h1>
                <p className="text-[10px] uppercase tracking-widest font-bold text-primary/80 mt-1.5">Workspace Preferences</p>
             </div>
          </div>

          {/* Profile Overview Card (Dark Theme Variant) */}
          <div className="bg-[#291e16]/80 rounded-[1.5rem] p-5 mb-10 border border-white/10 shadow-inner">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-serif text-xl font-bold">
                      {name ? name.charAt(0) : "U"}
                  </div>
                  <div>
                      <h3 className="font-bold text-[15px] text-[#f4efe8] dark:text-white">{name || "User Name"}</h3>
                      <p className="text-[12px] font-medium text-white/50">{email}</p>
                  </div>
              </div>
          </div>

          {/* Vertical Navigation Menu */}
          <div className="flex flex-col gap-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold uppercase tracking-widest text-[11px] ${
                    activeTab === id 
                        ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(200,150,62,0.2)]' 
                        : 'text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${activeTab === id ? 'text-primary-foreground' : 'text-white/40'}`} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-auto pt-10">
             <div className="flex items-center gap-2 text-white/30">
                 <Shield className="w-3 h-3" />
                 <span className="text-[9px] font-bold uppercase tracking-widest">End-to-End Encrypted Workspace</span>
             </div>
          </div>

        </div>

        {/* Right: Frosted Glass Form Area overlapping ON TOP of the navigator */}
        <div className="w-[64%] -ml-[6%] mt-8 rounded-[2.5rem] bg-white/95 dark:bg-card/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.1)] p-0 min-h-[750px] flex flex-col z-30 pl-[12%] overflow-hidden">
           
           {/* Dynamic Header */}
           <div className="flex items-center justify-between border-b border-white/20 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-md px-10 py-8 shrink-0 rounded-tr-[2.5rem]">
              <div>
                  <h2 className="font-serif text-[1.6rem] font-bold text-foreground dark:text-white leading-none">
                      {TABS.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-[12px] font-medium text-muted-foreground mt-2">
                      {activeTab === 'account' && "Manage your professional identity and contact details."}
                      {activeTab === 'ai-workspace' && "Configure how your Legal Second Brain behaves."}
                      {activeTab === 'notifications' && "Tailor your digest and reminder preferences."}
                      {activeTab === 'security' && "Update your password and security credentials."}
                  </p>
              </div>
           </div>

           {/* Scrollable Form Content */}
           <div className="flex-1 overflow-y-auto p-10 pb-20 scrollbar-hide">

             {/* Account Tab */}
             <div className={activeTab === "account" ? "block animate-in fade-in slide-in-from-right-4 duration-500" : "hidden"}>
               <Card title="Professional Profile" icon={User}>
                 <form action={profileAction} className="space-y-6">
                   <StatusBanner state={profileState} />
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
                       className="w-full bg-white/95 dark:bg-black/30 border border-white/50 dark:border-white/10 rounded-xl px-4 py-3 text-[14px] text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50 resize-none shadow-sm"
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
                   <StatusBanner state={pwState} />
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
                   <StatusBanner state={wsState} />
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
                   <StatusBanner state={notifState} />
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
        </div>
      </div>
    </div>
  );
}
