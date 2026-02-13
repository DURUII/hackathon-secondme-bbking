"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./DebateStage.module.css";

type Side = "red" | "blue" | "host";

export type SessionSeatInfo = {
  seat: string;
  participantId: string;
  participant: {
    name: string;
    avatarUrl?: string | null;
    interests?: string[] | null;
  };
};

type Shade = {
  title: string;
  description?: string;
  confidence?: number;
};

type Persona = {
  participantId: string;
  name: string;
  avatarUrl?: string | null;
  interests: string[];
  bio: string | null;
  mbti: string | null;
  shades: Shade[];
};

type PersonaEnvelope = {
  success: boolean;
  data?: Persona;
  error?: string;
};

export type DebateStageProps = {
  seats: SessionSeatInfo[];
  activeSeat?: string | null;
  subtitle?: string | null;
  hostCue?: string | null;
  hostMuyu?: boolean;
  kaigangMode?: boolean;
  kaigangFlash?: boolean;
};

type PositionData = {
  bottom: string;
  left?: string;
  right?: string;
  zIndex: number;
  scale: number;
  transform?: string;
  rotateY?: string;
};

const SEAT_POSITIONS: Record<string, PositionData> = {
  PRO_3: { bottom: "50%", left: "15%", zIndex: 10, scale: 0.8 },
  PRO_2: { bottom: "35%", left: "10%", zIndex: 20, scale: 0.9 },
  PRO_1: { bottom: "15%", left: "5%", zIndex: 30, scale: 1.0 },

  CON_3: { bottom: "50%", right: "15%", zIndex: 10, scale: 0.8 },
  CON_2: { bottom: "35%", right: "10%", zIndex: 20, scale: 0.9 },
  CON_1: { bottom: "15%", right: "5%", zIndex: 30, scale: 1.0 },

  HOST: { bottom: "62%", left: "46%", zIndex: 6, scale: 0.85 },
};

const CENTER_STAGE: PositionData = {
  bottom: "18%",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 120,
  scale: 1.55,
};

const KAIGANG_LEFT: PositionData = {
  bottom: "18%",
  left: "35%",
  zIndex: 120,
  scale: 1.45,
  rotateY: "40deg",
};

const KAIGANG_RIGHT: PositionData = {
  bottom: "18%",
  left: "65%",
  zIndex: 120,
  scale: 1.45,
  rotateY: "-40deg",
};

const DEFAULT_FACES: Record<string, string> = {
  PRO_1: "😡",
  PRO_2: "🤖",
  PRO_3: "😭",
  CON_1: "😏",
  CON_2: "🤡",
  CON_3: "🧐",
  HOST: "🤓",
};

function seatSide(seat: string): Side {
  if (seat === "HOST") return "host";
  if (seat.startsWith("PRO")) return "red";
  if (seat.startsWith("CON")) return "blue";
  return "host";
}

function seatLabelZh(seat: string) {
  const map: Record<string, string> = {
    PRO_1: "正方一辩",
    PRO_2: "正方二辩",
    PRO_3: "正方三辩",
    CON_1: "反方一辩",
    CON_2: "反方二辩",
    CON_3: "反方三辩",
  };
  return map[seat] ?? seat;
}

function seatNumber(seat: string) {
  const m = seat.match(/_(\d)$/);
  return m ? m[1] : "";
}

function clampText(text: string, maxLen: number) {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}...`;
}

function VarietySubtitleBar({
  number,
  side,
  name,
  content,
  className = "",
}: {
  number: string;
  side: "red" | "blue";
  name: string;
  content: string;
  className?: string;
}) {
  const themes = {
    red: {
      primary: "bg-[#ea580c]",
      text: "text-[#ea580c]",
      light: "bg-white",
      shadow: "shadow-orange-900/20",
    },
    blue: {
      primary: "bg-[#2563eb]",
      text: "text-[#2563eb]",
      light: "bg-white",
      shadow: "shadow-blue-900/20",
    },
  } as const;

  const theme = themes[side] ?? themes.red;

  return (
    <div className={`flex items-stretch select-none ${className}`}>
      <div className="relative z-30 flex-shrink-0">
        <div
          className={`${theme.light} ${theme.text} w-12 h-12 flex items-center justify-center font-black text-3xl leading-none shadow-sm`}
          style={{
            fontFamily: '"Impact", "Arial Black", ui-sans-serif, system-ui, sans-serif',
            letterSpacing: "-2px",
          }}
        >
          {number}
        </div>
        <div className={`absolute top-0 left-0 w-1 h-full opacity-10 ${theme.primary}`} />
      </div>

      <div className="relative z-20 flex-shrink-0">
        <div className={`${theme.primary} ${theme.shadow} text-white h-12 px-5 flex items-center justify-center font-bold text-xl tracking-wide`}>
          {name}
        </div>
        <div className="absolute top-0 right-0 translate-x-1/2 w-4 h-full overflow-hidden pointer-events-none opacity-20">
          <div className="w-full h-full bg-black -skew-x-12 origin-bottom" />
        </div>
      </div>

      <div className="relative z-10 flex-grow min-w-0">
        <div className="bg-[#111111] min-h-12 flex items-center pl-6 pr-8 w-full text-white/95 text-lg font-medium tracking-wide shadow-lg">
          <div className={styles.varietyContent}>{content}</div>
        </div>
      </div>
    </div>
  );
}

function renderSubtitleRich(text: string) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  // Dramatic but safe: only highlight quoted parts / "AI" / numbers.
  const parts = raw.split(/(「[^」]{1,12}」|“[^”]{1,12}”|AI|\d+(?:\.\d+)?%?)/g);
  return parts.map((part, idx) => {
    if (!part) return null;
    const shouldHighlight =
      part === "AI" ||
      /^\d+(?:\.\d+)?%?$/.test(part) ||
      (part.startsWith("「") && part.endsWith("」")) ||
      (part.startsWith("“") && part.endsWith("”"));
    if (!shouldHighlight) return <span key={idx}>{part}</span>;
    return (
      <span key={idx} className={styles.highlightWord}>
        {part}
      </span>
    );
  });
}

type Debater = {
  seat: string;
  participantId: string | null;
  name: string;
  avatarUrl?: string | null;
  interests: string[];
  face: string;
  side: Side;
};

function TeamClass({ side }: { side: Side }) {
  if (side === "red") return styles.teamRed;
  if (side === "blue") return styles.teamBlue;
  return styles.teamHost;
}

function VoxelDebater({
  debater,
  isSpeaking,
  isDimmed,
  position,
  rotateY,
  hostCue,
  hostMuyu,
  persona,
  personaLoading,
  personaError,
  onHover,
}: {
  debater: Debater;
  isSpeaking: boolean;
  isDimmed: boolean;
  position: PositionData;
  rotateY: string;
  hostCue?: string | null;
  hostMuyu?: boolean;
  persona?: Persona | null;
  personaLoading?: boolean;
  personaError?: string | null;
  onHover?: (participantId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    bottom: position.bottom,
    zIndex: position.zIndex,
    transform: `${position.transform ? `${position.transform} ` : ""}scale(${position.scale})`,
  };
  if (position.left) style.left = position.left;
  if (position.right) style.right = position.right;

  const teamClass = TeamClass({ side: debater.side });

  const showPersonaCard = hovered && debater.participantId && debater.participantId !== "__host__";
  const effectivePersona = showPersonaCard ? persona : null;

  return (
    <div
      className={[
        styles.voxelDebater,
        teamClass,
        isSpeaking ? styles.speaking : "",
        isDimmed ? styles.debaterDimmed : "",
      ].join(" ")}
      style={style}
      onMouseEnter={() => {
        setHovered(true);
        if (debater.participantId && debater.participantId !== "__host__") onHover?.(debater.participantId);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={styles.headCube} style={{ transform: `rotateX(-10deg) rotateY(${rotateY})` }}>
        <div className={[styles.face, styles.faceFront].join(" ")}>
          {debater.avatarUrl ? <img src={debater.avatarUrl} alt="" /> : debater.face}
        </div>
        <div className={[styles.face, styles.faceBack].join(" ")} />
        <div className={[styles.face, styles.faceRight].join(" ")} />
        <div className={[styles.face, styles.faceLeft].join(" ")} />
        <div className={[styles.face, styles.faceTop].join(" ")} />
        <div className={[styles.face, styles.faceBottom].join(" ")} />
        <div className={styles.nameTagFloating}>
          {debater.name} <span className="opacity-60">· {seatLabelZh(debater.seat)}</span>
        </div>
      </div>

      <div className={styles.bodyBlock} style={{ transform: `rotateY(${rotateY})` }}>
        <div className={[styles.hand, styles.handLeft].join(" ")} />
        <div className={[styles.hand, styles.handRight].join(" ")} />
      </div>

      <div className={styles.shadow} />

      {isSpeaking ? (
        <div className={styles.talkBubble}>{debater.side === "host" ? "🎤" : "💬"}</div>
      ) : null}

      {debater.seat === "HOST" && hostCue ? <div className={styles.hostCue}>{hostCue}</div> : null}
      {debater.seat === "HOST" && hostMuyu ? <div className={styles.muyuEffect}>🐟</div> : null}

      {showPersonaCard ? (
        <div
          className={[
            styles.personaCard,
            debater.side === "red" ? styles.personaCardLeft : debater.side === "blue" ? styles.personaCardRight : "",
          ].join(" ")}
        >
          <div className={styles.personaHeader}>
            <div className={styles.personaAvatar}>
              {effectivePersona?.avatarUrl ? <img src={effectivePersona.avatarUrl} alt="" /> : null}
            </div>
            <div className="min-w-0">
              <div className={styles.personaName}>{effectivePersona?.name ?? debater.name}</div>
              <div className={styles.personaMeta}>
                {personaLoading ? "Loading..." : personaError ? "Upstream error" : seatLabelZh(debater.seat)}
              </div>
            </div>
            {effectivePersona?.mbti ? <div className={styles.personaBadge}>{effectivePersona.mbti}</div> : null}
          </div>

          <div className={styles.personaSectionTitle}>Shades</div>
          <div className={styles.pillRow}>
            {(effectivePersona?.shades ?? []).slice(0, 3).map((s) => (
              <div key={s.title} className={styles.pill} title={s.description ?? s.title}>
                {s.title}
              </div>
            ))}
            {personaLoading ? <div className={styles.pill}>...</div> : null}
            {personaError ? <div className={styles.pill}>fetch failed</div> : null}
            {!personaLoading && !personaError && (effectivePersona?.shades?.length ?? 0) === 0 ? (
              <div className={styles.pill}>none</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DebateStage({
  seats,
  activeSeat,
  subtitle,
  hostCue,
  hostMuyu,
  kaigangMode = false,
  kaigangFlash = false,
}: DebateStageProps) {
  const [subtitleKey, setSubtitleKey] = useState(0);
  const [personaByParticipantId, setPersonaByParticipantId] = useState<Record<string, Persona | null>>({});
  const [loadingPersona, setLoadingPersona] = useState<Record<string, boolean>>({});
  const [personaError, setPersonaError] = useState<Record<string, string>>({});

  useEffect(() => {
    setSubtitleKey((prev) => prev + 1);
  }, [subtitle, activeSeat]);

  const debaters: Debater[] = useMemo(() => {
    const fromSeats = seats.map((s) => ({
      seat: s.seat,
      participantId: s.participantId,
      name: s.participant?.name ?? s.participantId,
      avatarUrl: s.participant?.avatarUrl ?? null,
      interests: Array.isArray(s.participant?.interests) ? (s.participant?.interests as string[]) : [],
      face: DEFAULT_FACES[s.seat] ?? "😐",
      side: seatSide(s.seat),
    }));
    return [
      {
        seat: "HOST",
        participantId: "__host__",
        name: "马东东",
        avatarUrl: null,
        interests: ["cue流程", "敲木鱼", "带节奏"],
        face: DEFAULT_FACES.HOST,
        side: "host" as const,
      },
      ...fromSeats,
    ];
  }, [seats]);

  const ensurePersona = useCallback(
    async (participantId: string) => {
      if (!participantId || participantId === "__host__") return;
      if (personaByParticipantId[participantId] || loadingPersona[participantId]) return;

      setLoadingPersona((prev) => ({ ...prev, [participantId]: true }));
      setPersonaError((prev) => ({ ...prev, [participantId]: "" }));

      try {
        const res = await fetch(`/api/participant/${participantId}/persona`, { method: "GET" });
        const text = await res.text();
        const json = text ? (JSON.parse(text) as PersonaEnvelope) : null;
        if (!res.ok || !json?.success || !json.data) {
          throw new Error(json?.error || `HTTP ${res.status}`);
        }
        setPersonaByParticipantId((prev) => ({ ...prev, [participantId]: json.data! }));
      } catch (e: any) {
        setPersonaError((prev) => ({ ...prev, [participantId]: String(e?.message ?? e) }));
        setPersonaByParticipantId((prev) => ({ ...prev, [participantId]: null }));
      } finally {
        setLoadingPersona((prev) => ({ ...prev, [participantId]: false }));
      }
    },
    [loadingPersona, personaByParticipantId]
  );

  const getPosition = useCallback(
    (seat: string) => {
      if (seat === "HOST") return SEAT_POSITIONS.HOST;

      if (kaigangMode) {
        if (seat === "PRO_2") return KAIGANG_LEFT;
        if (seat === "CON_2") return KAIGANG_RIGHT;
      }

      if (activeSeat && seat === activeSeat && !kaigangMode) {
        return CENTER_STAGE;
      }

      return SEAT_POSITIONS[seat] ?? SEAT_POSITIONS.HOST;
    },
    [activeSeat, kaigangMode]
  );

  const subtitleNode = subtitle ? renderSubtitleRich(subtitle) : null;
  const activeDebater = useMemo(() => {
    if (!activeSeat) return null;
    return debaters.find((d) => d.seat === activeSeat) ?? null;
  }, [activeSeat, debaters]);

  const showVarietyBar = Boolean(
    subtitle &&
      subtitle.trim() &&
      activeDebater &&
      activeDebater.seat !== "HOST" &&
      (activeDebater.side === "red" || activeDebater.side === "blue") &&
      !kaigangMode
  );

  return (
    <div className={styles.stageRoot}>
      <div className={[styles.scene3d, kaigangMode ? styles.sceneKaigang : ""].join(" ")}>
        <div className={styles.floorGrid} />
        <div className={styles.spotlight} />

        {debaters.map((d) => {
          const position = getPosition(d.seat);
          const isSpeaking = Boolean(activeSeat && activeSeat === d.seat);
          const isDimmed = Boolean(kaigangMode && d.seat !== "HOST" && d.seat !== "PRO_2" && d.seat !== "CON_2");

          let rotateY = position.rotateY ?? "0deg";
          if (!position.rotateY) {
            if (d.side === "red") rotateY = "20deg";
            if (d.side === "blue") rotateY = "-20deg";
            if (d.side === "host") rotateY = "0deg";
            if (isSpeaking && !kaigangMode) rotateY = "0deg";
          }

          const pid = d.participantId;
          const persona = pid ? personaByParticipantId[pid] : null;
          const ploading = pid ? loadingPersona[pid] : false;
          const perror = pid ? personaError[pid] : "";

          return (
            <VoxelDebater
              key={d.seat}
              debater={d}
              isSpeaking={isSpeaking}
              isDimmed={isDimmed}
              position={position}
              rotateY={rotateY}
              hostCue={hostCue}
              hostMuyu={hostMuyu}
              persona={persona}
              personaLoading={ploading}
              personaError={perror || null}
              onHover={ensurePersona}
            />
          );
        })}

        {kaigangFlash ? (
          <div className={styles.kaigangOverlay}>
            <div className={styles.kaigangText}>开 杠</div>
          </div>
        ) : null}
      </div>

      <div className={styles.subtitleLayer}>
        {showVarietyBar ? (
          <VarietySubtitleBar
            className="w-[min(980px,92vw)]"
            side={activeDebater!.side as "red" | "blue"}
            number={seatNumber(activeDebater!.seat) || "?"}
            name={activeDebater!.name}
            content={String(subtitle ?? "")}
          />
        ) : subtitleNode ? (
          <div key={subtitleKey} className={[styles.qipaSubtitle, styles.qipaSubtitleActive].join(" ")}>
            {subtitleNode}
          </div>
        ) : null}
      </div>
    </div>
  );
}
