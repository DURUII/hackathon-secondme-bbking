# SecondMe Hackathon

## What is A2A and Second Me SDK?

- A2A 互联网 = 不是人用互联网，而是你的 AI 替你在“另一个互联网”里，和别人的 AI 长期、自动地社交、交易、博弈、协作。这不是 Chatbot，也不是 AI 工具，不是：你问，AI 回（那是 A2H / 工具），你的 AI ↔ 别人的 AI 在互动
你本人只是早晚看结果的人。从：人 → 人、你亲自在线、你是行为主体，变成：AI → AI、AI 24/7 在线、你的 AI 是主体。
- SecondMe API 提供 A2A 应用基础能力：OAuth2 授权登录（获取 Access Token）、读取用户授权的基础信息与兴趣标签、访问用户软记忆（个人知识库）、以用户的 AI 分身进行流式对话（SSE）。在此基础上，A2A 应用需要进一步设计“多 Agent 交互”的产品流程：让至少两个（最好更多）Agent 发生自主交互，并把最有价值的结果回流给真人用户。

## Current Progress

1. Bootstrapped and stabilized the Next.js app structure (App Router, API routes, Prisma client scaffold).
2. Fixed runtime blocking issues from empty source files:
   - `src/app/page.tsx` now exports a valid React component.
   - auth/profile API routes and UI components are no longer zero-byte placeholders.
3. Implemented OAuth flow skeleton:
   - `/api/auth/login` builds OAuth authorize URL and redirects.
   - `/api/auth/callback` exchanges `code` for tokens and writes cookies.
   - `/api/auth/logout` clears auth cookies.
   - `/api/user/info` reads access token from cookie and calls SecondMe user info API.
4. Added end-to-end debug traces in server/client logs with:
   - `BEGIN`
   - `MIDDLE(中间变量)`
   - `END`
5. Located and fixed the OAuth token exchange endpoint mismatch:
   - wrong endpoints (`/api/oauth/token`, `/oauth/token`) returned 404.
   - corrected endpoint: `/api/oauth/token/code`.
6. Updated token response parsing to support both snake_case and camelCase fields.

## Key Pitfalls Encountered

1. OAuth token endpoint path mismatch caused repeated `token_http_failed` with 404.
2. Several generated files were empty, causing misleading runtime/type errors.
3. `.env` changes do not apply until `npm run dev` is restarted.
4. Running build while dev server is active may lock `.next` files and trigger EPERM on Windows.

## Commit Scope Guidance

### Should Commit

1. Source code under `src/` and `prisma/`.
2. Project config files (`package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, lint/postcss config).
3. Documentation updates (`AGENTS.md`, `README.md` if changed).
4. Intentional deletions of obsolete `.claude/skills/*` files (if migrating to `.agent` workflow and confirmed by team).

### Should Not Commit

1. Secrets and local env files (`.env*`).
2. Build/runtime artifacts (`.next/`, `out/`, `node_modules/`, logs).
3. Local IDE/agent workspace state (`.agent/`).
4. Local SQLite runtime DB files (`prisma/*.db`, journals).

## Next Validation Checklist

1. Restart dev server after env changes.
2. Click authorize once and verify callback logs show token request `status: 200`.
3. Confirm callback `END` stage is `success` and cookies are set.
4. Verify `/api/user/info` returns `code: 0` and contains real user fields.
