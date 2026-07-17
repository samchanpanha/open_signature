# Implementation Plan: OpenSign Feature Completion

## Overview
Add user management, multi-tenant organizations, role-based permissions, signature alerts, import/export (Excel, Word, PDF), drag-and-drop form builder, and template/form assignment to users.

## Phase 1: Database Schema Additions
**Goal**: Add new models for permissions, form builder, assignments, and notifications.

### 1.1 Add Permission Model
```prisma
model Permission {
  id        String   @id @default(cuid())
  action    String   // create, read, update, delete, assign
  resource  String   // document, template, form, user, org
  userId    String
  orgId     String?
  createdAt DateTime @default(now())
  
  user User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Organization? @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  @@unique([userId, resource, action, orgId])
}
```

### 1.2 Add FormTemplate and FormField Models
```prisma
model FormTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  ownerId     String
  orgId       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  owner     User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  org       Organization? @relation(fields: [orgId], references: [id], onDelete: SetNull)
  fields    FormField[]
  assignments Assignment[]
}

model FormField {
  id           String   @id @default(cuid())
  type         String   // text, email, number, date, select, checkbox, signature
  label        String
  required     Boolean  @default(true)
  options      String?  // JSON array for select fields
  placeholder  String?
  defaultValue String?
  order        Int      @default(0)
  formTemplateId String
  
  formTemplate FormTemplate @relation(fields: [formTemplateId], references: [id], onDelete: Cascade)
}
```

### 1.3 Add Assignment Model
```prisma
model Assignment {
  id            String   @id @default(cuid())
  type          String   // template, form
  templateId    String?
  formTemplateId String?
  assigneeId    String
  assignerId    String
  orgId         String?
  status        String   @default("pending") // pending, completed, expired
  dueAt         DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  template     DocumentTemplate? @relation(fields: [templateId], references: [id], onDelete: Cascade)
  formTemplate FormTemplate?     @relation(fields: [formTemplateId], references: [id], onDelete: Cascade)
  assignee     User              @relation("Assignee", fields: [assigneeId], references: [id], onDelete: Cascade)
  assigner     User              @relation("Assigner", fields: [assignerId], references: [id], onDelete: Cascade)
  org          Organization?     @relation(fields: [orgId], references: [id], onDelete: SetNull)
}
```

### 1.4 Add Notification/Reminder Models
```prisma
model Notification {
  id         String   @id @default(cuid())
  type       String   // signing_request, assignment, reminder, alert
  title      String
  message    String
  userId     String
  read       Boolean  @default(false)
  documentId String?
  createdAt  DateTime @default(now())
  
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  document Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)
}

model Reminder {
  id         String   @id @default(cuid())
  documentId String
  signerId   String?
  type       String   // signing_deadline, completion_alert, custom
  message    String
  scheduledAt DateTime
  sentAt     DateTime?
  createdAt  DateTime @default(now())
  
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  signer   Signer?  @relation(fields: [signerId], references: [id], onDelete: SetNull)
}
```

### 1.5 Update Existing Models
- Add `permissions Permission[]` to User model
- Add `formTemplates FormTemplate[]` to User model
- Add `assignments Assignment[]` (as assignee) to User model
- Add `notifications Notification[]` to User model
- Add `formTemplates FormTemplate[]` to Organization model
- Add `assignments Assignment[]` to Organization model

## Phase 2: Backend API Routes
**Goal**: Create API endpoints for new features.

### 2.1 Permissions API
- `GET /api/permissions` - List user permissions
- `POST /api/permissions` - Create permission
- `DELETE /api/permissions/[id]` - Delete permission
- Middleware helper: `checkPermission(userId, action, resource, orgId?)`

### 2.2 Form Templates API
- `GET /api/form-templates` - List form templates
- `POST /api/form-templates` - Create form template
- `GET /api/form-templates/[id]` - Get form template
- `PUT /api/form-templates/[id]` - Update form template
- `DELETE /api/form-templates/[id]` - Delete form template

### 2.3 Assignments API
- `GET /api/assignments` - List assignments (for current user)
- `POST /api/assignments` - Create assignment
- `PUT /api/assignments/[id]` - Update assignment status
- `DELETE /api/assignments/[id]` - Delete assignment

### 2.4 Notifications API
- `GET /api/notifications` - List notifications
- `PUT /api/notifications/[id]/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/[id]` - Delete notification

### 2.5 Import/Export API
- `POST /api/import/excel` - Import from Excel
- `POST /api/import/word` - Import from Word
- `GET /api/export/excel/[documentId]` - Export to Excel
- `GET /api/export/word/[documentId]` - Export to Word
- `GET /api/export/pdf/[documentId]` - Export to PDF

## Phase 3: Frontend Components
**Goal**: Build UI components for new features.

### 3.1 User Management
- User profile page
- User list (admin view)
- User search/filter

### 3.2 Role-Based Permissions
- Permission matrix UI
- Role assignment dialog
- Permission check hooks

### 3.3 Form Builder
- Drag-and-drop form builder
- Form field components (text, select, checkbox, etc.)
- Form preview
- Form response viewer

### 3.4 Import/Export
- Import wizard (Excel, Word)
- Export dropdown menu
- Bulk export

### 3.5 Alerts & Reminders
- Notification center
- Reminder settings
- Alert preferences

### 3.6 Assignments
- Assignment dashboard
- Assignment creation wizard
- Assignment tracking

## Phase 4: Integration & Polish
**Goal**: Connect all features and polish UX.

### 4.1 Dashboard Updates
- Add new cards for assignments, notifications
- Quick actions menu
- Recent activity feed

### 4.2 Template Management
- Template assignment flow
- Template versioning
- Template sharing

### 4.3 Document Workflow
- Document status tracking
- Signing workflow improvements
- Completion certificates

### 4.4 Settings & Configuration
- Organization settings page
- User preferences
- Notification settings

## Success Criteria
- [ ] All features functional and tested
- [ ] No TypeScript errors
- [ ] All API routes protected with auth
- [ ] Responsive UI on mobile/desktop
- [ ] Performance acceptable (< 2s load times)
