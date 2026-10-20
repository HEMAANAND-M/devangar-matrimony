import type { Instrumentation } from "next";

export function register() {}

/**
 * Logs every unhandled server error as one structured line and, when SENTRY_DSN is set, sends a
 * minimal event to Sentry. Only the route, method, error type, message and stack are sent: no
 * headers, cookies, query strings or member data.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const path = request.path.split("?")[0];
  console.error(
    JSON.stringify({
      level: "error",
      msg: err.message,
      name: err.name,
      digest: (err as { digest?: string }).digest,
      method: request.method,
      path,
      routePath: context.routePath,
      routeType: context.routeType,
    }),
  );

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    const eventId = crypto.randomUUID().replace(/-/g, "");
    const event = {
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "error",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      transaction: `${request.method} ${context.routePath}`,
      tags: { routeType: context.routeType, router: context.routerKind },
      exception: { values: [{ type: err.name, value: err.message.slice(0, 500) }] },
      extra: { stack: err.stack?.slice(0, 4000) },
    };
    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(event),
    ].join("\n");
    // Fire and forget: reporting must never slow down or break the response.
    void fetch(`${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${url.username}&sentry_version=7`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: envelope,
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  } catch {
    // Malformed DSN: nothing to report to.
  }
};
