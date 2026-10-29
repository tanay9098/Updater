/**
 * Result convention for domain operations (architecture.md §8.1, §14).
 * Operations that can fail return a Result instead of throwing, so callers
 * report the real outcome to the user.
 */

export type ErrorCode =
  | "validation_failed"
  | "invalid_transition"
  | "conflict_unacknowledged"
  | "not_found"
  | "storage_unavailable"
  | "storage_quota_exceeded"
  | "storage_corrupt"
  | "import_invalid"
  | "unexpected";

export type AppError = {
  code: ErrorCode;
  message: string;
  /** Dot-separated path of the field the error belongs to, when there is one. */
  field?: string;
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(code: ErrorCode, message: string, field?: string): Result<T> {
  return { ok: false, error: field === undefined ? { code, message } : { code, message, field } };
}
