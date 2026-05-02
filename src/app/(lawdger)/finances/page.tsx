import { getFinancesData } from "@/actions/financeActions";
import FinancesClient from "@/components/FinancesClient";

export default async function Finances() {
  const cases = await getFinancesData();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden">
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />
      <FinancesClient cases={cases} />
    </div>
  );
}
