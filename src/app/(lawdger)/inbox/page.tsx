import { auth } from "@/auth";
import { redirect } from "next/navigation";
import InboxClient from "@/components/InboxClient";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // In a real app, fetch unsorted documents from the DB here
  const unsortedDocuments = [
    { id: "1", title: "WhatsApp Image 2026-05-04.jpeg", size: "1.2 MB", time: "10 mins ago" },
    { id: "2", title: "Bail_Application_Draft_v2.pdf", size: "2.4 MB", time: "1 hour ago" },
    { id: "3", title: "Client_Aadhar_Card.png", size: "850 KB", time: "2 hours ago" },
  ];

  return <InboxClient initialDocuments={unsortedDocuments} userName={session.user.name || "User"} />;
}
