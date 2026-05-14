// Shared error handling for Supabase Edge Functions.
// Provides consistent HTTP status codes, JSON error envelopes, and a
// `withErrorHandler` wrapper for any Deno serve handler.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class HttpError extends Error {
  status: number;
  code: ErrorCode;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown, status?: number) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = status ?? STATUS_BY_CODE[code];
    this.details = details;
  }
}

// Convenience constructors
export const BadRequest = (msg = "Bad request", details?: unknown) =>
  new HttpError("BAD_REQUEST", msg, details);
export const Unauthorized = (msg = "Unauthorized") =>
  new HttpError("UNAUTHORIZED", msg);
export const Forbidden = (msg = "Forbidden") => new HttpError("FORBIDDEN", msg);
export const NotFound = (msg = "Not found") => new HttpError("NOT_FOUND", msg);
export const MethodNotAllowed = (msg = "Method not allowed") =>
  new HttpError("METHOD_NOT_ALLOWED", msg);
export const Conflict = (msg = "Conflict", details?: unknown) =>
  new HttpError("CONFLICT", msg, details);
export const ValidationError = (msg = "Validation failed", details?: unknown) =>
  new HttpError("VALIDATION_ERROR", msg, details);
export const PayloadTooLarge = (msg = "Payload too large") =>
  new HttpError("PAYLOAD_TOO_LARGE", msg);
export const RateLimited = (msg = "Too many requests") =>
  new HttpError("RATE_LIMITED", msg);
export const UpstreamError = (msg = "Upstream service error", details?: unknown) =>
  new HttpError("UPSTREAM_ERROR", msg, details);

export interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  requestId: string;
}

const newRequestId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function jsonResponse<T>(
  data: T,
  init: { status?: number; requestId?: string; headers?: HeadersInit } = {},
): Response {
  const requestId = init.requestId ?? newRequestId();
  const body: SuccessEnvelope<T> = { success: true, data, requestId };
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export function errorResponse(
  err: unknown,
  init: { requestId?: string; headers?: HeadersInit } = {},
): Response {
  const requestId = init.requestId ?? newRequestId();
  let httpErr: HttpError;

  if (err instanceof HttpError) {
    httpErr = err;
  } else if (err instanceof SyntaxError) {
    httpErr = new HttpError("BAD_REQUEST", "Invalid JSON body");
  } else if (err instanceof Error) {
    // Map common Supabase / fetch errors heuristically
    const msg = err.message || "Internal server error";
    if (/unauthorized|jwt|auth/i.test(msg)) {
      httpErr = new HttpError("UNAUTHORIZED", "Unauthorized");
    } else if (/not found/i.test(msg)) {
      httpErr = new HttpError("NOT_FOUND", msg);
    } else {
      httpErr = new HttpError("INTERNAL_ERROR", "Internal server error");
    }
    console.error(`[${requestId}] Unhandled error:`, err);
  } else {
    httpErr = new HttpError("INTERNAL_ERROR", "Internal server error");
    console.error(`[${requestId}] Unknown thrown value:`, err);
  }

  const body: ErrorEnvelope = {
    success: false,
    error: {
      code: httpErr.code,
      message: httpErr.message,
      details: httpErr.details,
      requestId,
    },
  };

  return new Response(JSON.stringify(body), {
    status: httpErr.status,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

export type Handler = (req: Request, ctx: { requestId: string }) => Promise<Response> | Response;

/**
 * Wrap a Deno serve handler with:
 *  - automatic CORS preflight handling
 *  - per-request requestId
 *  - consistent JSON error envelope on any thrown error
 */
export function withErrorHandler(handler: Handler) {
  return async (req: Request): Promise<Response> => {
    const requestId =
      req.headers.get("x-request-id") ?? newRequestId();

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, "X-Request-Id": requestId },
      });
    }

    try {
      const res = await handler(req, { requestId });
      // Ensure CORS + request id are present on every response
      if (!res.headers.get("X-Request-Id")) {
        res.headers.set("X-Request-Id", requestId);
      }
      for (const [k, v] of Object.entries(corsHeaders)) {
        if (!res.headers.get(k)) res.headers.set(k, v);
      }
      return res;
    } catch (err) {
      return errorResponse(err, { requestId });
    }
  };
}
