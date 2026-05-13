import { auth } from "@/auth";
import { redirect } from "next/navigation";
import CasesClient from "@/components/CasesClient";
import { getCases, getCaseCounts } from "./actions";

export default async function CasesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [cases, counts] = await Promise.all([getCases(), getCaseCounts()]);

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col relative overflow-x-hidden">
      <CasesClient initialCases={cases} counts={counts} />
    </div>
  );
}
