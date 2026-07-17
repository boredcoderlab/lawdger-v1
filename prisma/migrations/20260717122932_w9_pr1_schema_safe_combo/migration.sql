-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'pending');

-- AlterTable: convert Payment.status TEXT -> PaymentStatus enum, preserving data via USING.
-- Domain is exactly ('paid','pending') per createPaymentSchema (financeActions.ts) and the
-- LLM tool schemas. Existing rows are 3/3 'paid' — cast is a no-op on data.
-- Default stays 'pending' (unchanged); app layer overrides to 'paid' at the createPayment site.
ALTER TABLE "Payment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PaymentStatus" USING ("status"::"PaymentStatus"),
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- DropForeignKey / AddForeignKey: Note -> Case, RESTRICT -> CASCADE (operational cleanup)
ALTER TABLE "Note" DROP CONSTRAINT "Note_caseId_fkey";
ALTER TABLE "Note" ADD CONSTRAINT "Note_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey / AddForeignKey: CalendarEvent -> Case, RESTRICT -> CASCADE (operational cleanup)
ALTER TABLE "CalendarEvent" DROP CONSTRAINT "CalendarEvent_caseId_fkey";
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey / AddForeignKey: Task -> Case, RESTRICT -> SET NULL (N86 — optional-relation intent)
ALTER TABLE "Task" DROP CONSTRAINT "Task_caseId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment_caseId_fkey intentionally left at ON DELETE RESTRICT — financial audit boundary.
-- deleteCase's app-side payment.deleteMany is load-bearing, not belt-and-suspenders.

-- CreateIndex: N61 opportunistic indexes (7).
-- userId indexes back the RLS isolation predicate ("userId" = current_setting('app.current_user_id'))
-- carried by every query against these tables. caseId indexes back the parent-include reads and
-- the FK actions above (CASCADE/SET NULL scan the child by caseId on every Case delete).
CREATE INDEX "Note_userId_idx" ON "Note"("userId");
CREATE INDEX "Note_caseId_idx" ON "Note"("caseId");
CREATE INDEX "Task_caseId_idx" ON "Task"("caseId");
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_caseId_idx" ON "Payment"("caseId");
CREATE INDEX "CalendarEvent_userId_idx" ON "CalendarEvent"("userId");
