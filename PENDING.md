# Pending Tasks

## In Progress
- None currently in progress

## Completed
- Super Admin role: Added `isSuperAdmin` field to User model, JWT includes it
- Super Admin API: `/api/super-admin` (overview), `/api/super-admin/users` (CRUD), `/api/super-admin/orgs`, `/api/super-admin/impersonate`
- Super Admin UI: `/admin/system` - Dashboard with stats, user management, org list, impersonation
- Audit Log system: Extended AuditLog model with orgId, resourceType, resourceId, method, path, statusCode, duration, metadata
- Audit Log API: `/api/super-admin/audit-logs` (filtered list), `/api/super-admin/audit-logs/export` (CSV)
- Audit Log UI: `/admin/audit-logs` - Viewer with search, filters (action, resource type, date range), CSV export
- Audit logging added to: login, register, document delete, document send, signing completion
- Navigation: "System Admin" link in dashboard sidebar (visible only to super admins)
- Permission-based filtering for template sharing dialog
- Bulk send improvements (replaced window.prompt with proper dialog)
- Fixed TypeScript errors (AuthUser.id alias, async params in API routes, form-templates page props)
- Fixed db.template → db.documentTemplate, AuditLog templateId, pdf-lib rgb(), missing imports, and 15+ more TS issues
- Fixed team-member-manager, permission-templates apply, organization-assignment, workflow-manager, excel/pdf exporters
- Only 2 TS errors remain (missing @aws-sdk packages - optional S3 integration)
- Security: Removed plaintext OTP/password logging
- UX: Added error toast for failed field updates during signing
- Added error.tsx and not-found.tsx route boundaries
- Removed unused imports (ScrollArea, analyticsApi, brandingApi, profileApi, onboardingApi)
- Security: OTP codes hashed with SHA-256 before storage, timing-safe comparison
- Security: crypto.randomInt() for OTP generation (replaced Math.random())
- Security: JWT_SECRET now required (removed hardcoded fallback)
- Security: OTP expiry enforced server-side (10 min window)
- Security: Rate limiting on login (5/15min), OTP request (3/5min), OTP verify (5/10min)
- Security: 50MB file upload size limit
- Security: Email validation on register, contacts, document send routes
- Security: Admin users page uses crypto for temp passwords
- UX: Inline validation with red borders on auth form
- Code quality: Unified 50 duplicate getAuthUser functions to single import
- Code quality: Unified email sender addresses to use EMAIL_FROM env var
- Code quality: Split permission-templates route into proper Next.js route structure
- Code quality: Fixed analytics route orgId to use query params

## Next Up
- Test full end-to-end flow with browser verification (invite -> setup password -> login -> see filtered docs)
- Assign first super admin: Run `npx prisma db execute --stdin` with SQL to set isSuperAdmin=true on desired user

## Notes
- Dev server: `npx next dev -port 3001`
- Build: `npx next build`
- DB seed: `npx prisma db seed` (or manual node script to create admin)
- SMTP not configured - emails log to console (test mode in AlertEngine)
- Seed credentials: admin@opesign.com / Admin123!
- ESLint config is currently broken in this environment (eslint-config-next subpath
  exports don't resolve under Node ESM). Validation done via `npx tsc --noEmit`
  (passes) and `npx next build` (passes). Not a regression from this work.
- CRON_SECRET env: set it to enable the /api/reminders/process cron endpoint
  (disabled/401 when unset). Call via external scheduler (cron/Caddy/CI) every ~15 min.
- To make a user super admin: `UPDATE User SET isSuperAdmin = 1 WHERE id = 'USER_ID';`
