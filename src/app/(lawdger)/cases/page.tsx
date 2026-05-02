import CasesClient from "@/components/CasesClient";
import { getCases } from "@/actions/caseActions";

export default async function Cases() {
  const cases = await getCases();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">
      {/* Background Glows for Glassmorphism */}
      <div className="absolute top-[-100px] right-[-100px] h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-100px] h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      <CasesClient initialCases={cases} />
    </div>
  );
}
