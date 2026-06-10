export const CASE_TYPES = [
  "CIVIL",
  "CRIMINAL",
  "WRIT",
  "APPEAL",
  "COMMERCIAL",
  "FAMILY",
  "ARBITRATION",
  "OTHER",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

// Status domain now lives in Prisma enum (CaseStatus = ACTIVE | CLOSED).
// Re-exported so app-layer call sites have one canonical import.
export type { CaseStatus } from "@prisma/client";
import type { CaseStatus } from "@prisma/client";

export type CaseRecord = {
  id: string;
  userId: string;
  title: string;
  clientName: string | null;
  court: string | null;
  caseType: string | null;
  status: CaseStatus;
  nextHearingDate: Date | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateCaseInput = {
  title: string;
  clientName: string;
  matterId?: string;
  forum: string;
  court: string;
  caseType: CaseType;
  nextHearingDate?: string;
  description?: string;
};
