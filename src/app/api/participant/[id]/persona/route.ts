import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromToken } from "@/lib/auth-helper";

export const dynamic = "force-dynamic";

type Shade = {
  title: string;
  description?: string;
  confidence?: number;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeShade(item: unknown): Shade | null {
  const obj = asObject(item);
  if (!Object.keys(obj).length) return null;

  const nestedTag = asObject(obj.tag);
  const title = pickString(
    obj.shadeName,
    obj.shadeNamePublic,
    obj.title,
    obj.name,
    obj.label,
    obj.tagName,
    obj.tag_name,
    obj.displayName,
    obj.display_name,
    obj.keyword,
    obj.value,
    nestedTag.title,
    nestedTag.name,
    nestedTag.label
  );
  if (!title) return null;

  const description = pickString(
    obj.shadeDescription,
    obj.shadeDescriptionPublic,
    obj.description,
    obj.desc,
    obj.brief,
    nestedTag.description,
    nestedTag.desc
  );

  const confidence = toNumber(obj.confidence ?? obj.score ?? obj.weight);

  return { title, description: description ?? undefined, confidence };
}

function extractShades(payload: unknown): Shade[] {
  const root = asObject(payload);
  const data = "data" in root ? (root.data as unknown) : payload;
  const dataObj = asObject(data);
  const nestedShades = asArray(dataObj.shades);
  const arr = nestedShades.length > 0 ? nestedShades : asArray(data);

  const out: Shade[] = [];
  for (const item of arr) {
    const normalized = normalizeShade(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

function extractBio(payload: unknown): string | null {
  const root = asObject(payload);
  const data = "data" in root ? (root.data as unknown) : payload;
  const source = asObject(data);
  const profile = asObject(source.profile);
  const user = asObject(source.user);
  return pickString(
    source.bio,
    source.description,
    source.intro,
    source.selfIntroduction,
    source.self_introduction,
    profile.bio,
    profile.description,
    profile.intro,
    user.bio,
    user.description
  );
}

function extractMbti(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\b([EI][NS][FT][JP])(?:[-\s]?(?:A|T))?\b/i);
  if (!match) return null;
  return match[1].toUpperCase();
}

async function fetchSecondMeJson(pathname: string, token: string) {
  const baseUrl = process.env.SECONDME_API_BASE_URL || "https://app.mindos.com/gate/lab";
  const endpoint = `${baseUrl.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const resp = await fetch(endpoint, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await resp.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    json = { code: resp.status, message: text.slice(0, 300), data: null };
  }
  return { ok: resp.ok, status: resp.status, json };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await getUserFromToken();
    if (!viewer) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const participantId = (await ctx.params).id;
    if (!participantId) {
      return NextResponse.json({ success: false, error: "Missing participant id" }, { status: 400 });
    }

    const participant = await db.participant.findUnique({
      where: { id: participantId },
      select: { id: true, secondmeId: true, name: true, avatarUrl: true, interests: true },
    });
    if (!participant) {
      return NextResponse.json({ success: false, error: "Participant not found" }, { status: 404 });
    }

    const user = await db.user.findFirst({
      where: { secondmeUserId: participant.secondmeId, accessToken: { not: "demo-token" } },
      select: { accessToken: true },
    });

    if (!user?.accessToken) {
      return NextResponse.json({
        success: true,
        data: {
          participantId: participant.id,
          name: participant.name,
          avatarUrl: participant.avatarUrl,
          interests: participant.interests ?? [],
          bio: null,
          mbti: null,
          shades: [],
          tokenStatus: "missing",
        },
      });
    }

    const token = user.accessToken;

    const [infoRes, shadesRes] = await Promise.allSettled([
      fetchSecondMeJson("/api/secondme/user/info", token),
      fetchSecondMeJson("/api/secondme/user/shades", token),
    ]);

    const info = infoRes.status === "fulfilled" ? infoRes.value : null;
    const shades = shadesRes.status === "fulfilled" ? shadesRes.value : null;

    const bio = info ? extractBio(info.json) : null;
    const mbti = extractMbti(bio);
    const shadesList = shades ? extractShades(shades.json) : [];

    const interests =
      Array.isArray(participant.interests) && participant.interests.length > 0
        ? participant.interests
        : shadesList.map((s) => s.title).filter(Boolean).slice(0, 12);

    return NextResponse.json({
      success: true,
      data: {
        participantId: participant.id,
        name: participant.name,
        avatarUrl: participant.avatarUrl,
        interests,
        bio,
        mbti,
        shades: shadesList.slice(0, 24),
        tokenStatus: "ok",
        upstream: {
          info: info ? { ok: info.ok, status: info.status } : { ok: false, status: 0 },
          shades: shades ? { ok: shades.ok, status: shades.status } : { ok: false, status: 0 },
        },
      },
    });
  } catch (err) {
    console.error("[PARTICIPANT_PERSONA_GET] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to fetch persona", details: String(err) }, { status: 500 });
  }
}

