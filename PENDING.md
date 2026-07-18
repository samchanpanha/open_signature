# Pending Tasks

## In Progress
- None currently in progress

## Next Up (from previous context)
- Test full end-to-end flow with browser verification (invite -> setup password -> login -> see filtered docs)
- Consider adding permission-based filtering to template sharing dialog

## Nice to Have
- Document versioning (track changes to documents over time)
- Bulk send improvements (currently uses window.prompt, could use proper dialog)
- Folder delete (documents in deleted folder should move to root)
- Select all checkbox for bulk operations
- Document drag-and-drop into folders

## Notes
- Dev server: `npx next dev -port 3001`
- Build: `npx next build`
- DB seed: `npx prisma db seed` (or manual node script to create admin)
- SMTP not configured - emails log to console (test mode in AlertEngine)
- Seed credentials: admin@opesign.com / Admin123!
