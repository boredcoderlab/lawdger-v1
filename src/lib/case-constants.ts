/**
 * Shared between action-layer Zod schemas and UI label maps.
 * Single source of truth for case-type enum values.
 */

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
