import { NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth-helper";
import { DebateEngine } from "@/lib/debate-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sseEncode(event: string, data: any) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = (await ctx.params).id;
  if (!sessionId) {
    return NextResponse.json({ success: false, error: "Missing session id" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: string, data: any) => {
        if (closed) return;
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      const keepAlive = setInterval(() => {
        // SSE comment to keep proxies from timing out.
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      request.signal.addEventListener("abort", () => {
        send("aborted", { at: Date.now() });
        close();
      });

      (async () => {
        try {
          send("start", { sessionId, at: Date.now() });

          const result = await DebateEngine.tickSession(sessionId, {
            signal: request.signal,
            onToken: (chunk) => send("token", { chunk }),
            onEvent: (evt) => send(evt.type, evt),
          });

          send("done", { ...result, at: Date.now() });
        } catch (err) {
          // Use a non-reserved event name to avoid clashing with EventSource's built-in `error` event.
          send("server_error", { message: String(err) });
        } finally {
          close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
