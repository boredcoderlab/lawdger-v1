import { getFinancesData } from "@/actions/financeActions";
import FinancesClient from "@/components/FinancesClient";

export default async function Finances() {
  const result = await getFinancesData();
  if (!result.ok) {
    console.error("[FinancesPage] getFinancesData failed:", result.error);
  }
  const { totals, forgottenDues, caseRows } = result.ok
    ? result.data
    : {
        totals: { expected: 0, received: 0, balance: 0, collectionRate: 0 },
        forgottenDues: [],
        caseRows: [],
      };
  return <FinancesClient totals={totals} forgottenDues={forgottenDues} caseRows={caseRows} />;
}
