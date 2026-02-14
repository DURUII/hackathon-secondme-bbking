type LogLevel = "debug" | "info" | "warn" | "error";

export type ReqLogContext = {
  requestId: string;
  clientTraceId?: string | null;
  traceparent?: string | null;
  method?: string;
  url?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function safeSerializeError(err: unknown) {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      // Avoid huge stacks in hot paths; keep one line-ish.
      stack: (err.stack || "").split("\n").slice(0, 8).join("\n"),
    };
  }
  return { message: String(err) };
}

export function getReqLogContext(req: Request): ReqLogContext {
  const h = req.headers;
  const requestId = h.get("x-request-id") || crypto.randomUUID().slice(0, 8);
  return {
    requestId,
    clientTraceId: h.get("x-client-trace-id"),
    traceparent: h.get("traceparent"),
    method: (req as { method?: string }).method,
    url: req.url,
  };
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const base = {
    ts: nowIso(),
    level,
    event,
    vercelEnv: process.env.VERCEL_ENV,
    vercelRegion: process.env.VERCEL_REGION,
  };
  // JSON logs are easier to slice in Vercel / Axiom / Datadog etc.
  console.log(JSON.stringify({ ...base, ...fields }));
}

export function logApiBegin(ctx: ReqLogContext, api: string, fields: Record<string, unknown> = {}) {
  logEvent("info", `${api}.begin`, {
    requestId: ctx.requestId,
    clientTraceId: ctx.clientTraceId,
    traceparent: ctx.traceparent,
    method: ctx.method,
    url: ctx.url,
    ...fields,
  });
}

export function logApiEnd(
  ctx: ReqLogContext,
  api: string,
  fields: { status: number; dur_ms: number } & Record<string, unknown>
) {
  logEvent("info", `${api}.end`, {
    requestId: ctx.requestId,
    clientTraceId: ctx.clientTraceId,
    traceparent: ctx.traceparent,
    method: ctx.method,
    url: ctx.url,
    ...fields,
  });
}

export function logApiError(
  ctx: ReqLogContext,
  api: string,
  fields: { dur_ms?: number; status?: number } & Record<string, unknown>,
  err: unknown
) {
  logEvent("error", `${api}.error`, {
    requestId: ctx.requestId,
    clientTraceId: ctx.clientTraceId,
    traceparent: ctx.traceparent,
    method: ctx.method,
    url: ctx.url,
    ...fields,
    error: safeSerializeError(err),
  });
}

