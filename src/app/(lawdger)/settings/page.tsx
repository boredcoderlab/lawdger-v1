import { getFullProfile } from "@/actions/settingsActions";
import SettingsClient from "@/components/SettingsClient";

const FALLBACK_PREFERENCES = {
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

export default async function SettingsPage() {
  const result = await getFullProfile();
  const profile = result.ok ? result.data : null;

  return (
    <SettingsClient
      name={profile?.name ?? null}
      email={profile?.email ?? ""}
      preferences={profile?.preferences ?? FALLBACK_PREFERENCES}
    />
  );
}
