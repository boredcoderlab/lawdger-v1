import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LayoutShell from "./LayoutShell";

export default async function LawdgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <LayoutShell>{children}</LayoutShell>;
}
