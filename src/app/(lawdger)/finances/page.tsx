import { getFinancesData } from "@/actions/financeActions";
import FinancesClient from "@/components/FinancesClient";

export default async function Finances() {
  const { totals, forgottenDues, caseRows } = await getFinancesData();
  return <FinancesClient totals={totals} forgottenDues={forgottenDues} caseRows={caseRows} />;
}
