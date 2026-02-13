-- Add per-session prompt controls for debugging system prompts / act controls.

ALTER TABLE "debate_sessions"
  ADD COLUMN IF NOT EXISTS "system_prompt" TEXT,
  ADD COLUMN IF NOT EXISTS "act_control" TEXT,
  ADD COLUMN IF NOT EXISTS "prompt_version" TEXT;
