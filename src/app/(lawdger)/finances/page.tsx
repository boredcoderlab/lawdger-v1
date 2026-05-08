import { getFinancesData } from "@/actions/financeActions";
import FinancesClient from "@/components/FinancesClient";

export default async function Finances() {
  const cases = await getFinancesData();
  return <FinancesClient cases={cases} />;
}
