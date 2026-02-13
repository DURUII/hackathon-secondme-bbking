import { db } from "@/lib/db";
import { SecondMePollEngine } from "@/lib/secondme-poll-engine";

const SEATS = ["PRO_1", "CON_1", "PRO_2", "CON_2", "PRO_3", "CON_3"] as const;
type Seat = (typeof SEATS)[number];
type Side = "PRO" | "CON";

const CROSS_EXAM_ROUNDS = 5;
const DEFAULT_TURN_DELAY_MS = 5000;

const DEFAULT_SYSTEM_PROMPT = [
  "你是一名参加辩论赛的辩手。",
  "要求：中文输出，观点鲜明，像奇葩说，尽量口语化但不骂人、不做人身攻击。",
  "必须有冲突感：要么直接反驳对方一个具体观点/逻辑漏洞，要么预判对方会怎么说并提前拆解。",
  "尽量用短句输出（2-5句为宜），每句尽量以「。」「！」「？」收尾，避免长段落，方便逐句字幕与语音。",
  "不要自我介绍，不要列清单。",
].join("\n");

const DEFAULT_ACT_CONTROL = [
  "你将输出结构化 JSON。",
  "请严格只输出一个 JSON 对象，不要输出任何额外文本。",
  'JSON Schema: {"content": "string"}',
  "要求：content 为中文辩词，像奇葩说，观点鲜明，有冲突感（要反驳/拆对方），不骂人、不做人身攻击。",
  "尽量用短句输出（2-5句为宜），每句尽量以「。」「！」「？」收尾，避免长段落。",
  "不要自我介绍，不要列清单。",
  "示例：{\"content\":\"我支持...因为...\"}",
].join("\n");

function seatToSide(seat: Seat): Side {
  return seat.startsWith("PRO") ? "PRO" : "CON";
}

function otherSide(side: Side): Side {
  return side === "PRO" ? "CON" : "PRO";
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clampInt(n: unknown, fallback: number): number {
  const v = typeof n === "string" ? Number(n) : typeof n === "number" ? n : NaN;
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function normalizeSide(s: unknown): Side | null {
  if (s === "PRO" || s === "CON") return s;
  return null;
}

function getTurnDelayMs(): number {
  const v = clampInt(process.env.DEBATE_TURN_DELAY_MS, DEFAULT_TURN_DELAY_MS);
  return Math.max(0, v);
}

function getCrossExamForce(): "on" | "off" | "random" {
  const v = String(process.env.CROSS_EXAM_FORCE ?? "random").toLowerCase();
  if (v === "on" || v === "off" || v === "random") return v;
  return "random";
}

function pickCrossExamEnabled(): boolean {
  const force = getCrossExamForce();
  if (force === "on") return true;
  if (force === "off") return false;
  return Math.random() < 0.5;
}

type StreamOptions = {
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
};

async function fetchChatCompletion(
  token: string,
  prompt: string,
  systemPrompt?: string | null,
  stream?: StreamOptions
): Promise<string> {
  const SECONDME_API_BASE_URL = process.env.SECONDME_API_BASE_URL ?? "https://app.mindos.com/gate/lab";

  const sys = String(systemPrompt ?? process.env.DEBATE_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT).trim();

  const res = await fetch(`${SECONDME_API_BASE_URL}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: stream?.signal,
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: sys,
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`SecondMe chat stream error: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    if (typeof data?.code === "number" && data.code !== 0) {
      throw new Error(`SecondMe chat error: code=${data.code} message=${data.message ?? ""} subCode=${data.subCode ?? ""}`);
    }
    const text =
      data?.choices?.[0]?.message?.content ??
      data?.resp?.content ??
      data?.data?.content ??
      data?.content ??
      "";
    const out = String(text ?? "").trim();
    if (out) stream?.onToken?.(out);
    return out;
  }

  const reader = res.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let buffered = "";
  let aggregate = "";
  let upstreamErr: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffered += decoder.decode(value, { stream: !done });
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      try {
        const json = JSON.parse(dataStr);
        if (typeof json?.code === "number" && json.code !== 0) {
          upstreamErr = `code=${json.code} message=${json.message ?? ""} subCode=${json.subCode ?? ""}`;
        }
        const chunk =
          json?.choices?.[0]?.delta?.content ??
          json?.choices?.[0]?.message?.content ??
          json?.resp?.content ??
          json?.data?.content ??
          json?.content;
        if (typeof chunk === "string" && chunk.length > 0) {
          aggregate += chunk;
          stream?.onToken?.(chunk);
        }
      } catch {
        // Some SSE providers stream plain text in `data:` lines.
        if (dataStr && !dataStr.startsWith("{")) {
          aggregate += dataStr;
          stream?.onToken?.(dataStr);
        }
      }
    }

    if (done) break;
  }

  const out = aggregate.trim();
  if (!out && upstreamErr) {
    throw new Error(`SecondMe chat upstream error: ${upstreamErr}`);
  }
  return out;
}

async function fetchActCompletion(
  token: string,
  prompt: string,
  actControl?: string | null,
  stream?: StreamOptions
): Promise<string> {
  const SECONDME_API_BASE_URL = process.env.SECONDME_API_BASE_URL ?? "https://app.mindos.com/gate/lab";

  const actionControl = String(actControl ?? process.env.DEBATE_ACT_CONTROL ?? DEFAULT_ACT_CONTROL).trim();

  const res = await fetch(`${SECONDME_API_BASE_URL}/api/secondme/act/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: stream?.signal,
    body: JSON.stringify({
      message: prompt,
      actionControl,
    }),
  });

  if (!res.ok) {
    throw new Error(`SecondMe act stream error: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    if (typeof data?.code === "number" && data.code !== 0) {
      throw new Error(`SecondMe act error: code=${data.code} message=${data.message ?? ""} subCode=${data.subCode ?? ""}`);
    }
    const text =
      data?.data?.content ??
      data?.resp?.content ??
      data?.content ??
      data?.choices?.[0]?.message?.content ??
      "";
    const out = String(text ?? "").trim();
    if (out) stream?.onToken?.(out);
    return out;
  }

  const reader = res.body?.getReader();
  if (!reader) return "";

  const decoder = new TextDecoder();
  let buffered = "";
  let aggregate = "";
  let upstreamErr: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffered += decoder.decode(value, { stream: !done });
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      try {
        const json = JSON.parse(dataStr);
        if (typeof json?.code === "number" && json.code !== 0) {
          upstreamErr = `code=${json.code} message=${json.message ?? ""} subCode=${json.subCode ?? ""}`;
        }
        const chunk =
          json?.data?.content ??
          json?.data?.resp?.content ??
          json?.resp?.content ??
          json?.choices?.[0]?.delta?.content ??
          json?.choices?.[0]?.message?.content ??
          json?.content;
        if (typeof chunk === "string" && chunk.length > 0) {
          aggregate += chunk;
          stream?.onToken?.(chunk);
        }
      } catch {
        if (dataStr && !dataStr.startsWith("{")) {
          aggregate += dataStr;
          stream?.onToken?.(dataStr);
        }
      }
    }

    if (done) break;
  }

  const out = aggregate.trim();
  if (!out && upstreamErr) {
    throw new Error(`SecondMe act upstream error: ${upstreamErr}`);
  }
  // Act is intended to return JSON; try to parse `content`.
  const jsonMatch = out.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const content = typeof parsed?.content === "string" ? parsed.content.trim() : "";
      if (content) return content;
    } catch {
      // fallthrough
    }
  }
  return out;
}

function formatContext(turns: Array<{ speakerSeat: string | null; content: string }>, maxChars: number): string {
  const raw = turns
    .map((t) => `${t.speakerSeat ?? "UNKNOWN"}: ${t.content}`)
    .join("\n")
    .slice(-maxChars);
  return raw;
}

export class DebateEngine {
  static async createSession(params: { questionId: string; initiatorUserId: string }) {
    const question = await db.question.findFirst({
      where: { id: params.questionId, deletedAt: null },
      select: { id: true, content: true, arenaType: true },
    });
    if (!question) {
      throw new Error("Question not found");
    }

    const existing = await db.debateSession.findUnique({
      where: {
        questionId_initiatorUserId: {
          questionId: params.questionId,
          initiatorUserId: params.initiatorUserId,
        },
      },
      include: {
        seats: { include: { participant: true } },
        // Only need to know whether this session has started before.
        turns: { select: { id: true }, take: 1 },
      },
    });
    if (existing) {
      // UX: clicking "挺正方/挺反方" should always start from 一辩开始.
      // Because sessions are unique per (questionId, initiatorUserId), we reset any existing run that already has timeline.
      const shouldReset = existing.turns.length > 0 || existing.status === "CLOSED" || existing.status === "ABORTED";
      if (shouldReset) {
        // Avoid transaction usage here to reduce "Transaction not found" issues in dev/HMR.
        // Best-effort cleanup is good enough for UX: we just want to restart from opening.
        await db.debateTurn.deleteMany({ where: { sessionId: existing.id } });
        await db.audienceVoteEvent.deleteMany({ where: { sessionId: existing.id } });
        await db.audienceVoteSnapshot.deleteMany({ where: { sessionId: existing.id } });
        await db.debateSession.update({
          where: { id: existing.id },
          data: {
            status: "OPENING",
            winnerSide: null,
            closedAt: null,
            abortedAt: null,
            crossExamEnabled: null,
            crossExamFirstSide: null,
            seq: 1,
            nextTurnAt: new Date(),
          },
        });
      }

      const refreshed = await db.debateSession.findUnique({
        where: { id: existing.id },
        include: { seats: { include: { participant: true } } },
      });
      if (!refreshed) {
        throw new Error("Session not found after reset");
      }
      return { session: refreshed, created: false };
    }

    const initiator = await db.user.findUnique({
      where: { id: params.initiatorUserId },
      select: { id: true, secondmeUserId: true },
    });
    if (!initiator) {
      throw new Error("Initiator not found");
    }

    const initiatorParticipant = await db.participant.findUnique({
      where: { secondmeId: initiator.secondmeUserId },
      select: { id: true },
    });
    const initiatorParticipantId = initiatorParticipant?.id ?? null;

    const usersWithToken = await db.user.findMany({
      where: {
        accessToken: { not: "demo-token" },
      },
      select: { secondmeUserId: true },
      take: 200,
    });
    const secondmeIds = usersWithToken.map((u) => u.secondmeUserId);

    const candidates = await db.participant.findMany({
      where: {
        isActive: true,
        secondmeId: { in: secondmeIds },
        ...(initiatorParticipantId ? { id: { not: initiatorParticipantId } } : {}),
      },
      select: { id: true, name: true },
      take: 200,
    });

    if (candidates.length === 0) {
      throw new Error("No eligible participants (logged-in tokens) available");
    }

    const seats = shuffle(SEATS);
    const uniquePicks = shuffle(candidates).slice(0, Math.min(candidates.length, seats.length));
    const seatAssignments: Array<{ seat: Seat; participantId: string }> = [];

    for (let i = 0; i < seats.length; i++) {
      if (i < uniquePicks.length) {
        seatAssignments.push({ seat: seats[i], participantId: uniquePicks[i].id });
      } else {
        const picked = candidates[Math.floor(Math.random() * candidates.length)];
        seatAssignments.push({ seat: seats[i], participantId: picked.id });
      }
    }

    const now = new Date();
    const created = await db.debateSession.create({
      data: {
        questionId: params.questionId,
        initiatorUserId: params.initiatorUserId,
        status: "OPENING",
        nextTurnAt: now,
        systemPrompt: String(process.env.DEBATE_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT).trim(),
        actControl: String(process.env.DEBATE_ACT_CONTROL ?? DEFAULT_ACT_CONTROL).trim(),
        seats: {
          create: seatAssignments.map((s) => ({
            seat: s.seat,
            participantId: s.participantId,
          })),
        },
      },
      include: {
        question: true,
        seats: { include: { participant: true } },
      },
    });

    return { session: created, created: true };
  }

  static async processDueSessions(limit = 3) {
    const due = await db.debateSession.findMany({
      where: {
        status: { notIn: ["CLOSED", "ABORTED"] },
        nextTurnAt: { lte: new Date() },
      },
      select: { id: true },
      orderBy: { nextTurnAt: "asc" },
      take: limit,
    });

    let processed = 0;
    let advanced = 0;
    let closed = 0;

    for (const s of due) {
      const result = await this.processOneSession(s.id);
      processed++;
      if (result.advanced) advanced++;
      if (result.closed) closed++;
    }

    return { due: due.length, processed, advanced, closed };
  }

  static async tickSession(
    sessionId: string,
    stream?: { signal?: AbortSignal; onEvent?: (evt: { type: string; [k: string]: any }) => void; onToken?: (chunk: string) => void }
  ): Promise<{ advanced: boolean; closed: boolean }> {
    return this.processOneSession(sessionId, stream);
  }

  private static async processOneSession(
    sessionId: string,
    stream?: { signal?: AbortSignal; onEvent?: (evt: { type: string; [k: string]: any }) => void; onToken?: (chunk: string) => void }
  ): Promise<{ advanced: boolean; closed: boolean }> {
    const session = await db.debateSession.findUnique({
      where: { id: sessionId },
      include: {
        question: { select: { id: true, content: true } },
        seats: { include: { participant: true } },
        turns: { orderBy: { seq: "asc" } },
      },
    });
    if (!session) return { advanced: false, closed: false };

    const seatMap = new Map<string, { participantId: string; participantName: string }>();
    for (const seat of session.seats) {
      seatMap.set(seat.seat, { participantId: seat.participantId, participantName: seat.participant.name });
    }

    const ensureSeat = (seat: Seat) => {
      const info = seatMap.get(seat);
      if (!info) throw new Error(`Missing seat assignment: ${seat}`);
      return info;
    };

    const now = new Date();
    const delayMs = getTurnDelayMs();
    const scheduleNext = async () => {
      await db.debateSession.update({
        where: { id: session.id },
        data: { nextTurnAt: new Date(Date.now() + delayMs) },
      });
    };

    const writeTurn = async (params: {
      type: string;
      speakerSeat: Seat;
      content: string;
      meta?: any;
    }) => {
      const speaker = ensureSeat(params.speakerSeat);

      // Use the session.seq field as "next seq" cursor.
      const seq = session.seq;
      const trimmed = String(params.content ?? "").trim();
      const content = trimmed.length > 0 ? trimmed : "(EMPTY)";

      await db.debateTurn.create({
        data: {
          sessionId: session.id,
          seq,
          type: params.type,
          speakerSeat: params.speakerSeat,
          speakerParticipantId: speaker.participantId,
          content,
          meta: params.meta ?? undefined,
        },
      });
      await db.debateSession.update({
        where: { id: session.id },
        data: { seq: { increment: 1 } },
      });
    };

    const hasSlot = (type: string, seat: Seat) =>
      session.turns.some((t) => t.type === type && t.speakerSeat === seat);

    const generateForSeat = async (args: {
      stageType: string;
      seat: Seat;
      prompt: string;
      maxChars: number;
      meta?: any;
    }) => {
      const info = ensureSeat(args.seat);
      const token = await SecondMePollEngine.getFreshToken(info.participantId);
      if (!token) {
        await writeTurn({
          type: args.stageType,
          speakerSeat: args.seat,
          content: `(SKIPPED) ${info.participantName} token missing`,
          meta: { ...(args.meta ?? {}), outcome: "SKIPPED" },
        });
        await scheduleNext();
        return;
      }

      try {
        stream?.onEvent?.({
          type: "turn_start",
          stageType: args.stageType,
          seat: args.seat,
          participantName: info.participantName,
        });

        // We want plain-text streaming for subtitles/TTS, so use chat stream for debate turns.
        const raw = await fetchChatCompletion(token, args.prompt, session.systemPrompt, {
          signal: stream?.signal,
          onToken: stream?.onToken,
        });
        if (!raw) {
          throw new Error("Empty completion");
        }
        const content = raw.slice(0, args.maxChars);
        await writeTurn({
          type: args.stageType,
          speakerSeat: args.seat,
          content,
          meta: { ...(args.meta ?? {}), outcome: "OK" },
        });
        stream?.onEvent?.({ type: "turn_done", outcome: "OK", stageType: args.stageType, seat: args.seat });
      } catch (err) {
        await writeTurn({
          type: args.stageType,
          speakerSeat: args.seat,
          content: "(ERROR) upstream generation failed",
          meta: { ...(args.meta ?? {}), outcome: "ERROR", error: String(err) },
        });
        stream?.onEvent?.({ type: "turn_done", outcome: "ERROR", stageType: args.stageType, seat: args.seat, error: String(err) });
      }
      await scheduleNext();
    };

    const topic = session.question.content;

    if (session.status === "OPENING") {
      if (!hasSlot("OPENING", "PRO_1")) {
        await generateForSeat({
          stageType: "OPENING",
          seat: "PRO_1",
          maxChars: 220,
          prompt: [
            `你在进行一场辩论。辩题：「${topic}」`,
            `你的席位：PRO_1（正方一辩，开篇立论）。`,
            `要求：200字以内，语言像奇葩说，观点明确；用2-4句短句输出，每句尽量以「。」「！」「？」结尾；最后一句给对方下战书。不要自我介绍，不要列清单。`,
          ].join("\n"),
          meta: { stage: "OPENING" },
        });
        return { advanced: true, closed: false };
      }
      if (!hasSlot("OPENING", "CON_1")) {
        await generateForSeat({
          stageType: "OPENING",
          seat: "CON_1",
          maxChars: 220,
          prompt: [
            `你在进行一场辩论。辩题：「${topic}」`,
            `你的席位：CON_1（反方一辩，开篇立论）。`,
            `要求：200字以内，语言像奇葩说，观点明确；用2-4句短句输出，每句尽量以「。」「！」「？」结尾；最后一句给对方下战书。不要自我介绍，不要列清单。`,
          ].join("\n"),
          meta: { stage: "OPENING" },
        });
        return { advanced: true, closed: false };
      }

      await db.debateSession.update({
        where: { id: session.id },
        data: { status: "REBUTTAL", nextTurnAt: now },
      });
      return { advanced: false, closed: false };
    }

    if (session.status === "REBUTTAL") {
      const openingTurns = session.turns.filter((t) => t.type === "OPENING");
      const openingContext = formatContext(
        openingTurns.map((t) => ({ speakerSeat: t.speakerSeat, content: t.content })),
        900
      );

      if (!hasSlot("REBUTTAL", "PRO_2")) {
        await generateForSeat({
          stageType: "REBUTTAL",
          seat: "PRO_2",
          maxChars: 220,
          prompt: [
            `你在进行一场辩论。辩题：「${topic}」`,
            `你的席位：PRO_2（正方二辩，驳论）。`,
            `你可以看到开篇立论：`,
            openingContext ? openingContext : "(无)",
            `要求：200字以内；必须点名引用对方一个具体论点（可用引号简短引用），然后拆穿漏洞并给出更强的解释；用2-4句短句输出，每句尽量以「。」结尾，像奇葩说。`,
          ].join("\n"),
          meta: { stage: "REBUTTAL" },
        });
        return { advanced: true, closed: false };
      }
      if (!hasSlot("REBUTTAL", "CON_2")) {
        await generateForSeat({
          stageType: "REBUTTAL",
          seat: "CON_2",
          maxChars: 220,
          prompt: [
            `你在进行一场辩论。辩题：「${topic}」`,
            `你的席位：CON_2（反方二辩，驳论）。`,
            `你可以看到开篇立论：`,
            openingContext ? openingContext : "(无)",
            `要求：200字以内；必须点名引用对方一个具体论点（可用引号简短引用），然后拆穿漏洞并给出更强的解释；用2-4句短句输出，每句尽量以「。」结尾，像奇葩说。`,
          ].join("\n"),
          meta: { stage: "REBUTTAL" },
        });
        return { advanced: true, closed: false };
      }

      const crossExamEnabled = session.crossExamEnabled ?? pickCrossExamEnabled();
      const crossExamFirstSide =
        crossExamEnabled && !normalizeSide(session.crossExamFirstSide)
          ? (Math.random() < 0.5 ? ("PRO" as const) : ("CON" as const))
          : normalizeSide(session.crossExamFirstSide);

      await db.debateSession.update({
        where: { id: session.id },
        data: {
          crossExamEnabled,
          crossExamFirstSide: crossExamFirstSide ?? undefined,
          status: crossExamEnabled ? "CROSS_EXAM" : "CLOSING",
          nextTurnAt: now,
        },
      });
      return { advanced: false, closed: false };
    }

    if (session.status === "CROSS_EXAM") {
      const crossTurns = session.turns.filter((t) => t.type === "CROSS_Q" || t.type === "CROSS_A");
      const totalNeeded = CROSS_EXAM_ROUNDS * 2;
      if (crossTurns.length >= totalNeeded) {
        await db.debateSession.update({
          where: { id: session.id },
          data: { status: "CLOSING", nextTurnAt: now },
        });
        return { advanced: false, closed: false };
      }

      const firstSide = normalizeSide(session.crossExamFirstSide) ?? "PRO";
      const round = Math.floor(crossTurns.length / 2) + 1;
      const isQ = crossTurns.length % 2 === 0;
      const questionerSide = round % 2 === 1 ? firstSide : otherSide(firstSide);
      const answererSide = otherSide(questionerSide);
      const questionerSeat: Seat = questionerSide === "PRO" ? "PRO_2" : "CON_2";
      const answererSeat: Seat = answererSide === "PRO" ? "PRO_2" : "CON_2";

      const historyContext = formatContext(
        session.turns.map((t) => ({ speakerSeat: t.speakerSeat, content: t.content })),
        1400
      );

      if (isQ) {
        await generateForSeat({
          stageType: "CROSS_Q",
          seat: questionerSeat,
          maxChars: 120,
          prompt: [
            `你在进行一场辩论的奇袭问答环节。辩题：「${topic}」`,
            `本轮：第${round}轮，你是提问方（${questionerSide} 二辩）。`,
            `历史上下文：`,
            historyContext ? historyContext : "(无)",
            `要求：只输出一个问题，80字以内；必须针对对方刚才的一个具体点发问（可用极短引述）；问题结尾用「？」；尖锐具体，不要总结。`,
          ].join("\n"),
          meta: { stage: "CROSS_EXAM", round, kind: "Q", questionerSide },
        });
        return { advanced: true, closed: false };
      }

      const lastQ = [...crossTurns].reverse().find((t) => t.type === "CROSS_Q")?.content ?? "";
      await generateForSeat({
        stageType: "CROSS_A",
        seat: answererSeat,
        maxChars: 180,
        prompt: [
          `你在进行一场辩论的奇袭问答环节。辩题：「${topic}」`,
          `本轮：第${round}轮，你是回答方（${answererSide} 二辩）。`,
          `对方问题：「${lastQ}」`,
          `历史上下文：`,
          historyContext ? historyContext : "(无)",
          `要求：只输出回答，150字以内；先用一句话拆掉对方问题的暗含前提，再直接回答；不要反问；尽量2-4句短句，每句尽量以「。」收尾。`,
        ].join("\n"),
        meta: { stage: "CROSS_EXAM", round, kind: "A", answererSide },
      });
      return { advanced: true, closed: false };
    }

    if (session.status === "CLOSING") {
      const prior = session.turns.filter((t) => t.type !== "CLOSING");
      const context = formatContext(
        prior.map((t) => ({ speakerSeat: t.speakerSeat, content: t.content })),
        1600
      );

      if (!hasSlot("CLOSING", "PRO_3")) {
        await generateForSeat({
          stageType: "CLOSING",
          seat: "PRO_3",
          maxChars: 220,
          prompt: [
            `你在进行一场辩论。辩题：「${topic}」`,
            `你的席位：PRO_3（正方三辩，结辩）。`,
            `你可以看到全局历史：`,
            context ? context : "(无)",
            `要求：200字以内；必须总结己方核心胜点并点名戳破对方一处漏洞；尽量3-5句短句输出，每句尽量以「。」结尾；最后一句给观众一个能记住的金句，像奇葩说。`,
          ].join("\n"),
          meta: { stage: "CLOSING" },
        });
        return { advanced: true, closed: false };
      }
      if (!hasSlot("CLOSING", "CON_3")) {
        await generateForSeat({
          stageType: "CLOSING",
          seat: "CON_3",
          maxChars: 220,
          prompt: [
            `你在进行一场辩论。辩题：「${topic}」`,
            `你的席位：CON_3（反方三辩，结辩）。`,
            `你可以看到全局历史：`,
            context ? context : "(无)",
            `要求：200字以内；必须总结己方核心胜点并点名戳破对方一处漏洞；尽量3-5句短句输出，每句尽量以「。」结尾；最后一句给观众一个能记住的金句，像奇葩说。`,
          ].join("\n"),
          meta: { stage: "CLOSING" },
        });
        return { advanced: true, closed: false };
      }

      // Settle winner by swing.
      const snapshots = await db.audienceVoteSnapshot.findMany({
        where: { sessionId: session.id },
        select: { openingPosition: true, currentPosition: true },
      });
      const openingPro = snapshots.filter((s) => s.openingPosition === "PRO").length;
      const finalPro = snapshots.filter((s) => s.currentPosition === "PRO").length;
      const netSwing = finalPro - openingPro;
      const winnerSide: "PRO" | "CON" | "DRAW" = netSwing > 0 ? "PRO" : netSwing < 0 ? "CON" : "DRAW";

      await db.debateSession.update({
        where: { id: session.id },
        data: {
          status: "CLOSED",
          closedAt: now,
          nextTurnAt: null,
          winnerSide,
        },
      });
      return { advanced: false, closed: true };
    }

    // Unknown status -> abort to avoid tight loops.
    await db.debateSession.update({
      where: { id: session.id },
      data: { status: "ABORTED", abortedAt: now, nextTurnAt: null },
    });
    return { advanced: false, closed: false };
  }
}
