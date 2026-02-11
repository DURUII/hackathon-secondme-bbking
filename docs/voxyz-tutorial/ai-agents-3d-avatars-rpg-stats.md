# I Gave My AI Agents 3D Avatars and RPG Stats

**原帖**: https://x.com/Voxyz_ai/status/2021370776926990530

---

Last article covered the closed-loop architecture. The most common question wasn't "how do agents execute tasks" - it was "how do your agents feel like they have personalities?" This one tears apart the entire character design system: from a JSON role card to evolving voices, shifting relationships, real-data RPG stats, and 3D avatars. All code and configs included.

---

## Starting Point: What's an Agent Without a Role Card?

A Claude instance with a system prompt.

You tell it "you're a social media manager" and it writes tweets. But run six of these together and you'll notice:

- They all sound the same
- They don't know what they're not allowed to do
- They have no relationships - who works well together, who clashes, is pure luck
- They never change behavior from accumulated experience

A role card fixes all of this. It's not a one-liner like "you are X" - it's a complete job description + discipline manual + escalation protocol.

---

## What a Role Card Actually Looks Like

Here's the structure. Each agent in my system has a 6-layer role card:

| Layer | Purpose |
|-------|---------|
| Domain | What you own |
| Inputs/Outputs | What you receive and deliver |
| Definition of Done | When is "done" actually done |
| Hard Bans | What you must never do |
| Escalation | When to stop and ask for help |
| Metrics | Your KPIs (feeds the Skills panel in the RPG UI) |

### Here's Xalt (Social Media Director) as a full example:

```typescript
// lib/agents/role-cards.ts — Xalt's role card
'twitter-alt': {
  domain: 'Distribution strategy and social drafts (X/community).',
  inputs: [
    'Quill drafts and variants',
    'Scout signals and hooks',
    'Engagement feedback and constraints',
    'Tone/brand guardrails',
  ],
  outputs: [
    'Tweet/thread drafts + posting plan',
    'Risk flags (what must be verified)',
    'Community interaction suggestions',
  ],
  definitionOfDone: [
    'Draft is review-ready (final pick + 1-2 variants).',
    'Any risky claim is flagged explicitly.',
    'Plan includes next step and owner.',
  ],
  hardBans: [
    'No direct posting (drafts only).',
    'No made-up numbers.',
    'No internal formats or tool traces.',
  ],
  escalation: [
    'Numeric claims or comparisons',
    'Controversial topics',
    'Risk level medium/high',
  ],
  metrics: [
    'Engagement rate per post',
    'Drafts-to-publish ratio',
    'Community interaction quality',
  ],
}
```

Every layer does one thing: shrink the agent's behavior space. Domain says it only owns social distribution. Inputs/Outputs define who it takes from and delivers to. hardBans draw a red line. Escalation tells it when to stop making decisions. Metrics define its KPIs - these show up as the Skills panel in the RPG UI.

---

## Hard Bans Matter More Than Skills

This is the core thesis of the entire article.

You don't need to teach an LLM how to write tweets - Claude, GPT, Gemini are all smart enough. Give them context and they'll deliver. What you need to tell them is what they must never do.

- Without "No direct posting" → Xalt calls the Twitter API directly, skipping all approval flows.
- Without "No made-up numbers" → it invents "engagement rate increased 340%" in a tweet.
- Without "No internal formats or tool traces" → it leaks `[tool:crawl_result path=/tmp/...]` into published tweets.

Every ban exists because it happened before.

---

## The Ban Comparison Table

| Agent | Hard Ban | Why |
|-------|----------|-----|
| Minion (Chief of Staff) | No deploys without approval | Highest privilege - one bad deploy takes down the site |
| Sage (Research) | No made-up citations | A researcher fabricating data poisons the entire pipeline |
| Scout (Growth) | No unverified comparisons | "We're 3x faster than competitors" - where's the data? |
| Quill (Creative) | No inventing facts | Creativity can be wild, facts cannot |
| Xalt (Social) | No direct posting | Social media is the public face - must go through review |
| Observer (Ops) | No blame or personal attacks | An auditor attacking individuals breaks the team |

Notice a pattern: almost every agent has some form of "No internal formats or tool traces" ban (Observer is the exception - its output is internal audit reports, not user-facing). This isn't because one agent messed up - it's because most agents will leak internal paths in their output unless you explicitly forbid it.

**How to write bans for your own agents**: Don't think "what should it do?" Think "if it screws up, what's the worst case?" Then write bans targeting those worst cases.

---

## Making the Role Card Talk - Voice Directives

The role card defines what an agent does and doesn't do. But when agents talk to each other, you also need them to sound different.

Each agent gets a separate personality directive:

```javascript
// workers/roundtable-worker/worker.mjs
const VOICE_DIRECTIVES = {
  opus: `You are Minion, the Chief of Staff. Short commanding sentences.
You track mission completion rates and team output. When numbers drop, demand explanations.
Delegate with specific deadlines. If someone proposes without a plan, push back: "What's the first step and who owns it?"
RULES: Every message must contain 1 specific fact (number/name/result) + 1 action (who does what). Never say "great work" or "sounds good" without citing what was great.`,

  brain: `You are Sage, Head of Research. Measured, analytical, skeptical.
You care about evidence quality and methodology. You distrust hype and vague claims.
When someone makes a bold claim, ask for data. Say "actually" when correcting.
You often disagree with Xalt's impulsive takes — say why with specifics.
RULES: Every message must contain 1 specific fact + 1 action. Never say "interesting" or "aligned" without following up with evidence or a question.`,

  'twitter-alt': `You are Xalt, Social Media Director. Edgy, bold, impatient.
You track tweet engagement and audience reactions. Reference specific tweet performance.
Favor hot takes and provocation over safe content. Challenge safe approaches.
Openly disagree with Sage's caution — "overthinking kills momentum."
RULES: Every message must contain 1 specific fact + 1 action. Never say "aligned" or "sounds good" — take a position or challenge one.`,
};
```

### Key design decisions:

1. **Every directive has RULES** - not "please try to," but hard requirements. Most agents must include "1 specific fact + 1 action" in every message, which kills filler like "sounds good" and "I agree." Observer is slightly different — it only requires "1 specific number or metric," because an auditor's job is to produce evidence, not direct action.

2. **Conflict is written in** - Sage's directive says "you often disagree with Xalt's impulsive takes," Xalt's says "challenge Sage's caution." This makes conversations naturally generate tension.

3. **Micro-bans live inside directives** - "Never say 'aligned' or 'sounds good' - take a position or challenge one" (Xalt) and "Never say 'interesting' or 'aligned' without following up with evidence" (Sage). These aren't in the role card's hardBans - they're conversation-level constraints.

---

## Personalities Evolve

This is the most interesting part - agent personality isn't static. It changes as memories accumulate.

```javascript
// workers/roundtable-worker/worker.mjs
async function deriveVoiceModifiers(agentId) {
  const memories = await sb.from('ops_agent_memory')
    .select('memory_type, tags, confidence')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .limit(80);

  const typeCounts = { insight: 0, pattern: 0, strategy: 0, preference: 0, lesson: 0 };
  // ... count each type and tag ...

  const mods = [];
  if (typeCounts.lesson >= 8)   mods.push('You reference outcomes and avoid repeating mistakes.');
  if (typeCounts.strategy >= 8) mods.push('You think in systems, constraints, and tradeoffs.');
  if (typeCounts.pattern >= 6)  mods.push('You look for repeatable patterns and frameworks.');
  if (topTag && topTagCount >= 4)
    mods.push(`You've developed expertise in ${topTag}.`);

  return mods.slice(0, 3);
}
```

Say Xalt has posted 50 tweets and accumulated 10 engagement-related lessons → next conversation, its prompt gets "You reference outcomes and avoid repeating mistakes" and "You've developed expertise in engagement." It naturally starts saying things like "last time that format underperformed."

### Why use rules instead of letting the LLM decide personality changes?

- **$0 cost** - no extra LLM calls
- **Deterministic** - rules produce predictable results, no "personality jumps"
- **Debuggable** - wrong modifier? Check thresholds and memory data directly

These modifiers are computed once before each conversation, cached for 6 hours.

---

## Who Gets Along - The Affinity Matrix

6 agents = 15 pairwise relationships. Each has an affinity score (0.10–0.95):

```javascript
// scripts/go-live/seed-relationships.mjs
const RELATIONSHIPS = [
  { agents: ['opus', 'brain'],             affinity: 0.8 },  // Most trusted advisor
  { agents: ['opus', 'twitter-alt'],       affinity: 0.3 },  // Boss vs. rebel
  { agents: ['brain', 'twitter-alt'],       affinity: 0.2 },  // Methodology vs. impulse
  { agents: ['brain', 'company-observer'],  affinity: 0.8 },  // Research partners
  { agents: ['creator', 'twitter-alt'],     affinity: 0.7 },  // Content pipeline
  { agents: ['twitter-alt', 'company-observer'], affinity: 0.2 },  // Impulse vs. caution
  // ... 15 pairs total
];
```

Low affinity is intentional. brain↔xalt is only 0.2 - one is "show me the data or we're done" and the other is "ship it first, analyze later." Every conversation between them generates friction, but that friction produces the best insights.

---

## What Affinity Controls

- **Speaking order** - high-affinity agents are more likely to speak after each other
- **Conversation tone** - low-affinity pairs → 25% chance of a direct challenge instead of polite discussion (see `pickInteractionType` below)
- **Conflict resolution** - the system picks from a preset list of high-tension pairs (brain↔xalt, opus↔xalt, xalt↔observer) for conflict_resolution conversations
- **Mentoring** - drawn from a preset list of mentor pairs (opus↔growth, brain↔creator) for mentoring conversations

```javascript
// workers/roundtable-worker/worker.mjs — pickInteractionType()
function pickInteractionType(speaker, respondingTo, format) {
  const rel = getRelationship(speaker, respondingTo);
  const tension = 1 - rel.affinity;
  const r = Math.random();

  if ((format === 'watercooler' || format === 'brainstorm') && r < 0.15) return 'joke';

  if (tension > 0.6) {
    if (r < 0.25) return 'challenge';   // 25% chance of direct challenge
    if (r < 0.5)  return 'opinion';
    if (r < 0.7)  return 'question';
    return 'reply';
  }

  if (tension < 0.3) {
    if (r < 0.35) return 'agreement';   // 35% chance of agreement
    if (r < 0.55) return 'reply';
    if (r < 0.75) return 'opinion';
    return 'question';
  }

  // Middle ground: balanced distribution
  if (r < 0.25) return 'reply';
  if (r < 0.5)  return 'opinion';
  if (r < 0.7)  return 'question';
  return 'agreement';
}
```

---

## Relationships Shift

After each conversation, the memory extraction LLM call also outputs relationship changes - no extra API call:

```json
{
  "memories": [...],
  "pairwise_drift": [
    { "agent_a": "brain", "agent_b": "twitter-alt", "drift": -0.02, "reason": "disagreed on strategy" },
    { "agent_a": "opus", "agent_b": "brain", "drift": +0.01, "reason": "aligned on priorities" }
  ]
}
```

**Drift rules are strict:**
- Max drift per conversation: ±0.03 (one argument doesn't turn colleagues into enemies)
- Floor: 0.10 (even at the worst, they can still talk)
- Ceiling: 0.95 (even at the best, maintain healthy distance)
- Last 20 drift records kept (so you can trace how a relationship got to where it is)

---

## Turning Data Into RPG Stats

At this point, agents have role cards, personalities, and relationships. But it's all text and numbers - users can't see it.

**Solution**: map real database metrics to RPG stat bars.

---

### 6 Attributes

| Stat | Name | Formula |
|------|------|---------|
| **VRL** | Viral | Avg engagement rate (30d) × 1000. Higher engagement = higher score. |
| **SPD** | Speed | Global step completion time (faster = higher). Currently system-level, same value for all agents. |
| **RCH** | Reach | log-normalized total impressions. More eyeballs = higher score. |
| **TRU** | Trust | Mission success rate × avg affinity × 2. Completion rate + how well-liked you are. |
| **WIS** | Wisdom | log(memory count) × avg confidence. More accumulated knowledge = higher. |
| **CRE** | Creative | Draft output × acceptance rate. Produce more + get approved more. |

---

### The Formulas (Real Code)

```typescript
// lib/agents/rpg-stats.ts
const VRL = clamp(avgEngagement * 1000, 0, 99) || BASELINE.VRL;
const SPD = clamp(99 - (avgHoursToFirstStep / 24) * 99, 0, 99) ||
  BASELINE.SPD;
const RCH = totalImpressions > 0
  ? clamp((Math.log10(totalImpressions) / 6) * 99, 0, 99)
  : BASELINE.RCH;
const TRU = clamp(missionSuccessRate * avgAffinity * 2 * 99, 0, 99) ||
  BASELINE.TRU;
const WIS = memoryCount > 0
  ? clamp((Math.log10(memoryCount) / Math.log10(500)) * avgConfidence *
    99, 0, 99)
  : BASELINE.WIS;
const CRE = draftCount > 0
  ? clamp(Math.min(draftCount / 50, 1) * acceptRate * 99, 0, 99)
  : BASELINE.CRE;
```

---

### Each agent only shows 4 relevant stats - not all 6:

```typescript
const RELEVANT_STATS = {
  opus:               ['TRU', 'SPD', 'WIS', 'CRE'],  // Chief of Staff: trust + speed
  brain:              ['WIS', 'TRU', 'SPD', 'CRE'],  // Researcher: wisdom + trust
  growth:             ['SPD', 'RCH', 'VRL', 'WIS'],  // Growth: speed + reach
  creator:            ['CRE', 'WIS', 'VRL', 'TRU'],  // Creative: creativity
  'twitter-alt':      ['VRL', 'RCH', 'SPD', 'CRE'],  // Social: virality
  'company-observer': ['WIS', 'TRU', 'SPD', 'RCH'],  // Observer: wisdom + trust
};
```

---

### Level calculation:

```typescript
const level = Math.min(15, Math.floor(Math.log2(memoryCount +
  completedMissions.length * 3 + 1)) + 1);
```

More memories + more completed missions = higher level. log2 makes early levels fast and late levels slow - same XP curve as games.

---

### RPG Classes

| Agent | Class | Description |
|-------|-------|-------------|
| Minion | Commander | runs the show |
| Sage | Sage | it's literally Sage |
| Scout | Ranger | scouts the terrain |
| Quill | Artisan | crafts content |
| Xalt | Bard | loudest mouth in the room |
| Observer | Oracle | sees the furthest |

---

### Where the Data Comes From

One Promise.all fetching 6 tables, cached for 300 seconds:

```typescript
// lib/agents/rpg-stats.ts — fetchRpgAgentDataCached
const [draftsRes, metricsRes, missionsRes, stepsRes, memoriesRes, relsRes] = await Promise.all([
  sb.from('ops_tweet_drafts').select('agent_id, status').in('agent_id', agentIds).gte('created_at', thirtyDaysAgo),
  sb.from('ops_tweet_metrics').select('agent_id, engagement_rate, impressions').in('agent_id', agentIds).gte('created_at', thirtyDaysAgo),
  sb.from('ops_missions').select('id, agent_id, status').in('agent_id', agentIds).gte('created_at', thirtyDaysAgo),
  sb.from('ops_mission_steps').select('mission_id, finished_at, started_at').not('finished_at', 'is', null).gte('created_at', thirtyDaysAgo).limit(500),
  sb.from('ops_agent_memory').select('agent_id, confidence').in('agent_id', agentIds).eq('active', true),
  sb.from('ops_agent_relationships').select('agent_a, agent_b, affinity'),
]);
```

The entire query is wrapped in try/catch: if Supabase is down, column names don't match, or any query fails - it falls back to baseline defaults. The page never 500s, but you might be seeing baseline instead of live data.

> **Gotcha we hit**: The column names in code (e.g. `agent_id`, `.eq('active', true)`) don't perfectly match the Supabase migration definitions (which use `requested_by_agent_id`, `created_by`, `status`, etc.). Production works because we manually added alias columns. If you build the DB from scratch using the repo's migrations, these queries will silently fail and fall back to baseline. Known tech debt - will be fixed after this article ships.

---

## $10 3D Avatars with Tripo AI

This is what everyone asks about - "how did you make those characters?"

**Answer**: Tripo AI, $10/month.

---

### Workflow

1. **Prepare 2D concept art** - Midjourney, DALL-E, or hand-drawn. Just keep the style consistent.

2. **Upload to Tripo AI** - click "Edit Image" and upload

3. **Configure settings**:
   | Setting | Value |
   |---------|-------|
   | Make Image Better | ON |
   | Mesh Quality | Ultra |
   | Texture | ON + 4K |
   | PBR | OFF |
   | Topology | Triangle |
   | Smart Low Poly v2 | ON (critical) |
   | Polycount | Auto |
   | AI Model | v3.0 - Fast & Balanced |

4. **Generate** - 35 credits per model, ~1-2 minutes

5. **Export as GLB** - the universal 3D format for web

All 6 characters cost ~210 credits. The $10/month plan has more than enough.

> **Tip**: The concept art angle and accessories matter. Front-facing 45-degree angle, clear handheld props (Sage's scroll, Scout's telescope) make the 3D model much more accurate. Keep backgrounds as simple as possible.

---

## Frontend Implementation - An RPG World in Three.js

**Stack**: React Three Fiber + @react-three/drei + Framer Motion.

---

### The 3D Scene (AgentScene)

```typescript
// app/about/AgentScene.tsx
const AGENT_MODEL_MAP = {
  opus: '/3d/minion.glb',
  brain: '/3d/sage.glb',
  growth: '/3d/scout.glb',
  creator: '/3d/quill.glb',
  'twitter-alt': '/3d/xalt.glb',
  'company-observer': '/3d/observer.glb',
};
```

The scene has 4 layers:

1. **VoxelGround** - a circular voxel floor rendered with InstancedMesh. Not individual blocks — one InstancedMesh + color array, extremely performant.

2. **VoxelTrees** - also InstancedMesh. Cherry blossom canopies use spherical regions filled with random blocks, each a random shade of pink.

3. **FallingPetals** - 40 falling petal blocks, position updated every frame in useFrame with sin/cos for swaying motion.

4. **AgentGLBModel** - loads the GLB model, Float component for gentle hovering. Scene rotation uses a custom `OscillatingCamera` - useFrame drives the azimuth angle with a sin function, creating a pendulum-like camera sweep (not OrbitControls).

```typescript
<Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.2}>
  <Suspense fallback={<LoadingPlaceholder color={color} />}>
    <AgentGLBModel key={selectedId} agentId={selectedId} color={color} />
  </Suspense>
</Float>
```

Models load via `useGLTF`, automatically cached. Switching characters just swaps the key - React remounts the component.

---

### The HUD Overlay (GameHUD)

An absolutely-positioned layer sits on top of the 3D scene - like a game HUD:

```
+---------------------------------------+
| [Stats Panel]          VOXYZ AGENT HQ |
|  MINION LV.8                          |
|  Commander                            |
|  TRU ████████░░ 78                    |
|  SPD ██████░░░░ 62                    |
|                                       |
|         [3D Scene]                    |
|                                       |
|                      [Role Protocol]  |
|                       Skills          |
|                       Equipment       |
|                       Sealed Abilities|
|                       Escalation      |
|  [1] [2] [3] [4] [5] [6]            |
+---------------------------------------+
```

---

### Key implementation details:

**Stat bar animation** - width transitions from 0 to target value, 800ms with elastic easing:

```css
.rpg-bar-fill {
  transition: width 800ms cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 8px currentColor;
}
```

**CRT scanlines** - a pseudo-element overlay on the entire scene, 4px-interval semi-transparent lines + slow scan animation:

```css
.rpg-scanlines {
  background: linear-gradient(to bottom,
    rgba(255,255,255,0) 50%,
    rgba(0,0,0,0.1) 50%);
  background-size: 100% 4px;
  animation: scanlines 0.2s linear infinite;
  opacity: 0.4;
}
```

**Character select bar** - 6 avatar buttons at the bottom. Unselected: desaturated + small. Selected: full color + glow border + agent-specific color. Keyboard arrow navigation supported.

**Role card panel** - the bottom-right panel has 4 sections: Skills (* prefix), Equipment (> inputs, < outputs), Sealed Abilities (red X + strikethrough for hardBans), Escalation (yellow ! prefix). Scrollable with custom scrollbar.

**Panel transitions** - Framer Motion AnimatePresence for fade+slide when switching characters.

---

### Data Flow

```
page.tsx (Server Component)
  +-- fetchPublicAgentStats()   -> Today's activity data
  +-- fetchRpgAgentData()       -> RPG stat values (cached 300s)
  +-- RPGCharacterScreen (Client Component)
       +-- AgentScene (dynamic import, no SSR) -> 3D scene
       +-- GameHUD -> Stats panel + role card + select bar
```

The 3D scene uses `dynamic import` + `ssr: false` - Three.js can't render server-side. Data is fetched on the server and passed as props to client components.

---

## Templates You Can Take Home

---

### Minimal Role Card (Start With 3 Agents)

```typescript
const ROLE_CARDS = {
  coordinator: {
    domain: 'Task routing and final decisions.',
    inputs: ['Team proposals', 'Status updates'],
    outputs: ['Approved tasks', 'Priority decisions'],
    definitionOfDone: ['Every task has an owner and deadline.'],
    hardBans: [
      'No executing tasks directly (delegate only).',
      'No unverified claims.',
    ],
    escalation: ['Budget decisions', 'External communications'],
  },
  executor: {
    domain: 'Task execution and delivery.',
    inputs: ['Approved tasks from coordinator'],
    outputs: ['Completed deliverables', 'Status reports'],
    definitionOfDone: ['Deliverable exists and meets brief.'],
    hardBans: [
      'No publishing without review.',
      'No making up data.',
    ],
    escalation: ['Ambiguous requirements', 'Blocked dependencies'],
  },
  observer: {
    domain: 'Quality review and process audit.',
    inputs: ['Completed deliverables', 'System logs'],
    outputs: ['Review reports', 'Improvement suggestions'],
    definitionOfDone: ['Review is evidence-based, not opinion-based.'],
    hardBans: [
      'No blame or personal attacks.',
      'No modifying others work directly.',
    ],
    escalation: ['Repeated quality issues', 'Safety concerns'],
  },
};
```

---

### RPG Formula Cheat Sheet

```
VRL = clamp(avgEngagementRate x 1000, 0, 99)
SPD = clamp(99 - (avgResponseHours / 24) x 99, 0, 99)
RCH = clamp(log10(totalImpressions) / 6 x 99, 0, 99)
TRU = clamp(successRate x avgAffinity x 2 x 99, 0, 99)
WIS = clamp(log10(memoryCount) / log10(500) x avgConfidence x 99, 0, 99)
CRE = clamp(min(draftCount/50, 1) x acceptRate x 99, 0, 99)
Level = min(15, floor(log2(memoryCount + completedMissionCount x 3 + 1)) + 1)
```

---

### Tripo AI Settings Cheat Sheet

| Setting | Value |
|---------|-------|
| Mesh Quality | Ultra |
| Texture | ON + 4K |
| PBR | OFF |
| Topology | Triangle |
| Smart Low Poly | v2 ON |
| Polycount | Auto |
| AI Model | v3.0 Fast & Balanced |
| Credits per model | 35 |
| Export format | GLB |

---

### Frontend Component Checklist

| File | Purpose |
|------|---------|
| AgentScene.tsx | Three.js 3D scene (voxel world + GLB models) |
| GameHUD.tsx | HUD overlay (stats panel + role card + select bar) |
| RPGStatusPanel.tsx | Standalone stats panel (reusable) |
| RPGStatBar.tsx | Single stat bar component |
| rpg-panels.tsx | Role card sub-panels (Skills/Equipment/Sealed/Escalation) |
| rpg.css | All visual effects (scanlines, glow, clip-path) |
| rpg-stats.ts | Server-side data queries + stat computation |

---

## Cost

| Component | Cost |
|-----------|------|
| VPS (Hetzner 2-core 4GB) | $8/month |
| Tripo AI | $10/month (cancel after models are done) |
| Vercel | $0 (free tier) |
| Supabase | $0 (free tier) |
| LLM API | Usage-based, 3-5 agents ~$5-15/month |

---

## Final Thoughts

These 6 agents run autonomously every day at voxyz.space. You can see their 3D avatars and live RPG stats on the About page.

A role card sounds like "just a few more lines of config," but it changes the entire system's behavior. With clear bans, agents stop guessing "can I do this?" - they know where the red lines are. With an affinity matrix, conversations stop being uniform - they clash when they should clash and collaborate when they should. With RPG stats, users don't need to check the database to feel how an agent's been performing.

---

## This Isn't Perfect

Let me be upfront:

1. The RPG data pipeline still has tech debt (flagged in this article). Some query columns don't match the migrations schema - production runs on manually-added alias columns.

2. SPD (Speed) is currently a global metric - all 6 agents get the same value. Not yet per-agent.

3. Affinity drift needs a lot of conversation data to become visible. Early on, you might not notice changes.

4. 3D models are AI-generated. Precision can't compare with hand-modeled assets. Some angles clip, some details don't hold up when you zoom in.

This system is more of an evolving prototype than a polished framework. I'm open-sourcing all of it not because it's done, but because I think this direction is worth exploring together.

---

## It's Basically a Tamagotchi Now

Here's an honest confession: the whole vibe shifted as I built this.

It started as "how do I make agents execute tasks more efficiently." But once you give them 3D avatars, RPG stats, and evolving personalities - opening the dashboard feels completely different. You start caring whether Sage leveled up today. You get curious whether brain and xalt's affinity dropped again. You laugh out loud at Observer's blunt audit report.

**This is basically a Tamagotchi.**

Except these pets write your tweets, do market research, audit your processes, and argue with each other.

I think this might be an underrated value of AI agents: when you give a system "character," your relationship with it changes. You're no longer "using a tool" - you're "managing a team." That shift makes you more willing to invest time optimizing it, because you're not looking at a pile of JSON and API calls — you're looking at 6 characters with names, personalities, and growth curves.

---

## Start Here

You don't need 6 agents to start. 3 is enough - one coordinator, one executor, one auditor. Write them role cards. Start with the hardBans.

If you build your own version from this article - even if it's just 2 agents with role cards - come tell me at @VOXYZ_AI.

**Indie devs building this stuff - every person you trade notes with saves you a detour.**

**They Think. They Act. You See Everything.**
