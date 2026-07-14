export const ERROR_CODES = [
  "validation",
  "not_found",
  "credential",
  "system",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; code: ErrorCode; error: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(code: ErrorCode, error: string): Result<never> {
  return { ok: false, code, error };
}
