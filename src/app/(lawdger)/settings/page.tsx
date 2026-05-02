import { getFullProfile } from "@/actions/settingsActions";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const profile = await getFullProfile();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="relative border-b border-white/5 bg-card/60 backdrop-blur-xl px-10 py-8 shrink-0 z-10 shadow-sm">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-foreground mb-2">
          Settings & Preferences
        </h1>
        <p className="text-muted-foreground text-lg font-light">
          Manage your personal profile, AI workspace, and account security.
        </p>
      </div>

      <div className="p-8 relative z-10">
        <div className="max-w-5xl mx-auto">
          <SettingsClient
            name={profile?.name ?? null}
            email={profile?.email ?? ""}
            preferences={profile?.preferences ?? {
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
            }}
          />
        </div>
      </div>
    </div>
  );
}
