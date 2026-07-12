import CasesClient from "@/components/CasesClient";
import { getCaseCounts, listCases } from "@/actions/caseActions";

export default async function CasesPage() {
  const casesResult = await listCases({ skip: 0, take: 50 });
  const countsResult = await getCaseCounts();

  if (!casesResult.ok) throw new Error(casesResult.error);
  if (!countsResult.ok) throw new Error(countsResult.error);

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col relative overflow-x-hidden">
      <CasesClient initialCases={casesResult.data.items} counts={countsResult.data} />
    </div>
  );
}
