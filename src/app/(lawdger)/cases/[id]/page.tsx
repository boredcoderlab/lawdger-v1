import { notFound } from "next/navigation";
import { getCaseWithChildren } from "@/actions/caseActions";
import CaseDetailClient from "@/components/CaseDetailClient";

export default async function CaseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getCaseWithChildren(id);
  if (!result.ok) throw new Error(result.error);
  const caseData = result.data;
  if (!caseData) notFound();

  return (
    <CaseDetailClient
      caseId={caseData.id}
      initialTitle={caseData.title}
      initialClientName={caseData.clientName}
      initialCourtName={caseData.court}
      initialAgreedFee={caseData.agreedFee}
      initialStatus={caseData.status}
      initialTasks={caseData.tasks}
      upcomingHearings={caseData.calendarEvents}
      caseData={caseData}
    />
  );
}
