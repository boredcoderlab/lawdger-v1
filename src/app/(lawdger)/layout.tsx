import Sidebar from "@/components/Sidebar";
import VoiceFAB from "@/components/VoiceFAB";

export default function LawdgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {children}
      </main>
      <VoiceFAB />
    </div>
  );
}
