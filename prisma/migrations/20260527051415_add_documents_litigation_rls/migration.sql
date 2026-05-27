-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "actsSections" TEXT,
ADD COLUMN     "filingDate" TIMESTAMP(3),
ADD COLUMN     "firNumber" TEXT,
ADD COLUMN     "policeStation" TEXT;

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT,
    "size" INTEGER,
    "mimeType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unsorted',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_caseId_idx" ON "Document"("caseId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- Row-Level Security: per-user isolation on every matter table.
-- Uses a runtime GUC `app.current_user_id` set by the app before every query.
-- NULLIF guards the empty-string-not-null quirk: unset context = NULL = zero
-- rows, never a leak. User table is NOT covered (login must work pre-context).
-- ──────────────────────────────────────────────────────────────────────────────

-- Case
ALTER TABLE "Case" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Case_isolation" ON "Case"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

-- Note
ALTER TABLE "Note" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Note_isolation" ON "Note"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

-- Task
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Task_isolation" ON "Task"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

-- CalendarEvent
ALTER TABLE "CalendarEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CalendarEvent_isolation" ON "CalendarEvent"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

-- Payment
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payment_isolation" ON "Payment"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

-- Document
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Document_isolation" ON "Document"
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

