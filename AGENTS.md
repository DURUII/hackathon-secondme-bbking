# SecondMe Hackathon - Progress Notes

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
