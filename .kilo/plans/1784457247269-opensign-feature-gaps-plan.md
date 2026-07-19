# OpenSign Feature Completion Plan — `open_signature`

## Context

The project at `/Users/samchanpanha/Desktop/projects/nodes js/open_signature` (Next.js 15 + Prisma/SQLite + shadcn) already replicates **all** of OpenSign's documented features (secure PDF e-signing, annotations, templates, multi-signer + sequential order, guest OTP, expiry/rejection, email templates, bulk send, reminders, "Drive" folders) plus enterprise extras (orgs, granular 6-role permissions, workflows, webhooks, API keys, contacts, assignments, versions, comments, tags, public forms, embed, analytics, onboarding, audit trail).

**No whole OpenSign feature area is missing.** The real gaps are features that have a backend route + DB model but are **not wired into the live execution path or UI**. This plan closes those gaps. Each item is independently shippable.

Verified evidence for every item below (file:line) is included.

---

## Gap 1 — OTP is generated/verified but never enforced at signing completion
- `src/app/api/sign/[token]/complete/route.ts` does NOT check `signer.otpVerifiedAt` before completing (grep: no `otpVerifiedAt` reference).
- `verify-otp` route sets `otpVerifiedAt`; UI gates only a local flag (`src/app/page.tsx:1462-1488`).
- **Decision: Sender toggle.** Add a per-document `requireOtp` boolean (DB field on `Document`, default false; UI toggle in editor send sidebar). Gate completion only when `document.requireOtp === true`.
- **Fix:** Add `requireOtp` to `Document` model + migration. In `complete/route.ts`, when `document.requireOtp` is true, require `signer.otpVerifiedAt != null` else return `401 { code: "OTP_REQUIRED" }`. Wire the editor toggle to the send payload and persist on document create/update.
- **Validation:** Send with `requireOtp=true`; complete without verify-otp → 401; after verify-otp → 200. With `requireOtp=false` → completes without OTP.

## Gap 2 — API keys are created but never used for authentication
- `getAuthUser` in `src/lib/permissions.ts:81` only reads the JWT Bearer; no `x-api-key` check anywhere (grep confirmed).
- `src/lib/api.ts:510` + `page.tsx:3135` list keys; no create dialog in main app; no auth use.
- **Fix:** Add an optional API-key resolution path in `getAuthUser`: if `Authorization` absent, read `x-api-key` header, look up `ApiKey` (active, not expired, `lastUsedAt` updated), resolve its `userId`, attach `apiKeyScopes` from `ApiKey.permissions`. Document scopes usage in routes that should accept key auth (documents, templates). Add a "Create API Key" dialog to the org/settings API keys tab.
- **Validation:** Create key via UI, call `GET /api/documents?apiKey=...` with key → 200; with invalid key → 401.

## Gap 3 — Email templates are customizable but never used when sending mail
- `src/lib/alerts/alert-engine.ts` sends hardcoded inline HTML (grep: no `EmailTemplate` reference).
- `email-templates` routes + seed + preview UI exist and work.
- **Fix:** In `alert-engine.ts`, before sending, resolve the org's `EmailTemplate` by `type` (e.g. `sign_invite`, `completed`, `reminder`) falling back to a built-in default. Render template `htmlBody` with variable substitution (`{{signerName}}`, `{{documentTitle}}`, `{{signLink}}`, etc.). Keep `SMTP_HOST` test-mode console logging.
- **Validation:** Seed a custom template, send a doc, confirm logged HTML reflects the template (not the hardcoded default).

## Gap 4 — Branding is stored but never displayed in the UI
- `branding/route.ts` GET/PUT + `src/lib/api.ts:595` exist; `logoUrl`/`brandColor`/`customDomain` never read by any component (grep confirmed).
- **Fix:** Add a `useBranding()` hook (or fetch in `providers.tsx`) that loads org branding; apply `brandColor` as a CSS variable on `:root` (emerald fallback), and render the org `logoUrl` in the dashboard/editor/viewer headers (replace the static OpenSign wordmark). Add an org-settings branding form (logo upload URL + color picker + custom domain) wired to `branding/route.ts` PUT.
- **Validation:** Set brand color/logo in settings → headers reflect it on reload.

## Gap 5 — Document tags are a stub (UI fires toast, never persists)
- `documents/[id]/tags/route.ts` + `DocumentTag` model complete, but the only tag UI (`BulkOperations` "Add Tag", `page.tsx:2665-2667`) just calls `toast.success` and never calls the API (grep: no `tagsApi`/`tags/` call in page.tsx).
- **Fix:** Wire "Add Tag" to `tagsApi.add`; render tag chips on document cards and in the viewer (`src/components/document-status-badge.tsx` or card header); support remove. Add tag filtering on the dashboard (optional).
- **Validation:** Add a tag to a doc → chip appears and persists after reload (DB row present).

## Gap 6 — Workflows have full backend + enforcement but no creation/management UI
- `WorkflowManager` (`src/components/workflows/workflow-manager.tsx`) is orphaned — never imported/rendered (grep confirmed). Editor only has a read-only workflow SELECT (`page.tsx:3540-3554`).
- **Fix:** Render `WorkflowManager` in org settings (or a dedicated tab), enabling create/edit/delete of workflows and steps (users + step types sign/approve/review/cc). Keep existing enforcement in `documents/[id]/send/route.ts:70-153` and `complete/route.ts`.
- **Validation:** Create a 2-step workflow in UI, assign to a doc, send → first step user notified; after step completes, next step notified.

## Gap 7 — Contact groups have routes but no management UI
- `contact-groups/route.ts` + `ContactGroup`/`ContactGroupMember` models complete; contact autocomplete works in editor (`contact-autocomplete.tsx`, `page.tsx:3317,3326`). No UI to create/edit groups or bulk-assign contacts.
- **Fix:** Add a Contacts management section (page or dialog) listing contacts + groups, with create-group, add-contact-to-group, and bulk-select-for-send. Reuse `contactsApi`/`contactGroupsApi` in `src/lib/api.ts`.
- **Validation:** Create a group, add contacts, use group in send dialog → all members receive invites.

## Gap 8 — Reminders are recorded but never delivered by an automated job
- `documents/[id]/reminders` CRUD + auto-reminder rows at send (`send/route.ts:169-191`) exist; `processAlerts()` in `src/lib/alerts/alert-engine.ts:64-164` reads due `Reminder`/`Assignment` rows but is **never invoked** by any route (no scheduler).
- **Decision: Cron endpoint.** Add a protected `GET /api/reminders/process` (or `POST`) that requires header `x-cron-secret` matching `CRON_SECRET` env (403 otherwise), then invokes `processAlerts()` to send due reminders/overdue notifications and update `sentAt`/`lastSentAt`/`nextSendAt`. Document running it via external cron/Caddy (e.g. every 15 min). (Outbound mail still requires `SMTP_HOST`; otherwise test-mode log.)
- **Validation:** Create a reminder with past `scheduledAt`, call the process endpoint with the secret → `Reminder.sentAt` set and email logged/sent; without secret → 403.

---

## Out of scope / notes
- **Cryptographic PDF seal (Gap from audit #6)** is currently decorative (hash text only, no real PKCS#7/PAdES). Real digital signing requires a signing cert/key infrastructure — flag as a separate, larger effort; not included here unless requested.
- **S3 / SMTP** integrations require env vars (`SMTP_HOST`, AWS S3 keys). Items 3 & 8 degrade to console test-mode without them — expected.
- `@aws-sdk` packages noted optional in `PENDING.md`; not required for the above fixes.

## Implementation order (recommended)
1. Gap 1 (OTP enforcement) — security fix, small, high value.
2. Gap 5 (tags) — small, self-contained.
3. Gap 4 (branding display) — small frontend.
4. Gap 2 (API-key auth) — medium, touches `getAuthUser`.
5. Gap 3 (email templates) — medium, touches mail path.
6. Gap 6 (workflow UI) — medium, renders existing component.
7. Gap 7 (contact groups UI) — medium.
8. Gap 8 (reminder scheduler) — medium, new cron endpoint.

## Validation plan
- `npm run lint` and `npx tsc --noEmit` clean after each item.
- `npx next build` succeeds.
- Manual E2E per item above using seeded admin (`admin@opesign.com` / `Admin123!`).
- Re-run the two-audit checks (grep for the gap signal) to confirm closure.

## Resolved decisions
- **Gap 1 (OTP):** Per-document sender toggle `requireOtp` gates completion (not blanket enforcement).
- **Gap 8 (Reminders):** Delivered via a `CRON_SECRET`-protected `/api/reminders/process` endpoint called by external cron.
