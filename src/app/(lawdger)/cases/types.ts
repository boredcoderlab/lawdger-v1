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

export const CASE_STATUSES = [
  "active",
  "pending",
  "closed",
  "urgent",
  "dormant",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export type CaseRecord = {
  id: string;
  userId: string;
  title: string;
  clientName: string | null;
  courtName: string | null;
  matterId: string | null;
  forum: string | null;
  court: string | null;
  caseType: string | null;
  status: string;
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
