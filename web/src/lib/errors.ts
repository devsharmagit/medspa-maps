export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "INTERNAL";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  constructor(message: string, statusCode: number, code: ErrorCode) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }

  // ── Factory helpers ──────────────────────────────────────────────────────────

  static badRequest(message = "Bad request"): ApiError {
    return new ApiError(message, 400, "BAD_REQUEST");
  }

  static unauthorized(message = "Unauthorized"): ApiError {
    return new ApiError(message, 401, "UNAUTHORIZED");
  }

  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(message, 403, "FORBIDDEN");
  }

  static notFound(message = "Not found"): ApiError {
    return new ApiError(message, 404, "NOT_FOUND");
  }

  static conflict(message = "Conflict"): ApiError {
    return new ApiError(message, 409, "CONFLICT");
  }

  static unprocessable(message = "Unprocessable entity"): ApiError {
    return new ApiError(message, 422, "UNPROCESSABLE");
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(message, 500, "INTERNAL");
  }
}
