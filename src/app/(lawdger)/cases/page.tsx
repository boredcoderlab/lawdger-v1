import CasesClient from "@/components/CasesClient";
import { getCases } from "@/actions/caseActions";

export default async function Cases() {
  const cases = await getCases();

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col relative overflow-x-hidden">
      <CasesClient initialCases={cases} />
    </div>
  );
}
