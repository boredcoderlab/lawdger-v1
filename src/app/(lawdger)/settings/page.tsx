import { getFullProfile } from "@/actions/settingsActions";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const profile = await getFullProfile();

  return (
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
  );
}
