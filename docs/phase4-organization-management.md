# Phase 4: Organization Management (Multi-Tenant Assignment UI)

## Overview
Phase 4 implements comprehensive organization management features including template and form assignment to users, multi-tenant document management, and a unified UI for managing organizational resources.

## Completed Features

### API Endpoints

#### 1. Organization Assignments API
**`/api/organizations/[id]/assignments`**

- **GET**: List all assignments for an organization
  - Query params: `status`, `userId` (for filtering)
  - Returns assignments with user, document, and assigner details
  
- **POST**: Create a new assignment
  - Body: `{ documentId, userId, dueDate?, notes? }`
  - Automatically creates notification for assignee
  - Validates document belongs to org and user is a member

**`/api/organizations/[id]/assignments/[assignmentId]`**

- **PUT**: Update assignment status, notes, or due date
  - Only assignee can update their own status, or admin/owner can update any
  - Auto-sets `completedAt` when status changes to "completed"
  
- **DELETE**: Remove an assignment
  - Only owner or admin can delete assignments

#### 2. Organization Templates API
**`/api/organizations/[id]/templates`**

- **GET**: List all form templates in the organization
  - Includes creator info and field count
  
- **POST**: Create a new form template
  - Body: `{ name, description?, schema, fields? }`
  - Schema is stored as JSON string
  - Optionally creates associated form fields

**`/api/organizations/[id]/templates/[templateId]`**

- **GET**: Get single template with full details
  - Includes all fields with parsed options/validation
  
- **PUT**: Update template name, description, schema, or fields
  - When fields are provided, deletes existing and recreates
  
- **DELETE**: Remove a template
  - Cascades to delete associated form fields

### UI Component

**`OrganizationAssignment` Component** (`src/components/organizations/organization-assignment.tsx`)

A comprehensive React component for managing organization assignments and templates:

#### Features:
- **Two-tab interface**: Assignments and Templates
- **Assignment Management**:
  - View all assignments with status badges
  - Create new assignments (select document + user)
  - Set due dates and add notes
  - Update status (pending, in_progress, completed)
  - Delete assignments
  - Real-time status indicators with icons

- **Template Management**:
  - View all form templates
  - Create new templates with name and description
  - Shows field count and creator info
  - Creation date tracking

#### Usage:
```tsx
import { OrganizationAssignment } from '@/components/organizations/organization-assignment';

// In your organization page
<OrganizationAssignment orgId={currentOrgId} />
```

## Database Models Used

### Assignment
```prisma
model Assignment {
  id          String   @id @default(cuid())
  status      String   // pending, in_progress, completed, overdue
  dueDate     DateTime?
  completedAt DateTime?
  notes       String?
  userId      String
  documentId  String
  orgId       String
  assignedBy  String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user      User         @relation(fields: [userId], references: [id])
  document  Document     @relation(fields: [documentId], references: [id], onDelete: Cascade)
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  assigner  User         @relation("AssignedBy", fields: [assignedBy], references: [id])

  @@unique([userId, documentId])
}
```

### FormTemplate & FormField
```prisma
model FormTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  schema      String   // JSON: form field definitions
  orgId       String
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  org    Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  creator User        @relation(fields: [createdBy], references: [id])
  fields FormField[]
}

model FormField {
  id            String   @id @default(cuid())
  type          String   // text, number, date, select, checkbox, signature
  label         String
  placeholder   String?
  required      Boolean  @default(false)
  options       String?  // JSON array for select fields
  defaultValue  String?
  validation    String?  // JSON validation rules
  formTemplateId String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  formTemplate FormTemplate @relation(fields: [formTemplateId], references: [id], onDelete: Cascade)
}
```

## Security Features

1. **Membership Validation**: All endpoints verify the user is a member of the organization
2. **Role-Based Access**:
   - Only owners/admins can create assignments and templates
   - Only owners/admins can delete assignments and templates
   - Assignees can update their own assignment status
   - Admins cannot remove other admins (only owner can)
3. **Resource Scoping**: Documents and templates are scoped to the organization
4. **Cascade Deletes**: Removing org members or templates cascades to related data

## Integration Points

### With Phase 2 (Permissions):
- Uses role-based checks (`owner`, `admin`, `member`)
- Respects permission hierarchy

### With Phase 3 (User Management):
- Displays user information in assignments
- Allows assigning documents to any org member

### Future Integration (Phase 5+):
- Templates can be extended with drag-and-drop form builder
- Assignments can trigger reminder systems (Phase 7)
- Templates support import/export (Phase 6)

## Testing Checklist

- [ ] Create organization
- [ ] Add multiple members with different roles
- [ ] Create documents in organization
- [ ] Assign documents to members
- [ ] Verify notifications are created
- [ ] Update assignment status
- [ ] Create form templates
- [ ] Verify only owners/admins can manage resources
- [ ] Test security: non-member cannot access org data
- [ ] Test security: member cannot delete owner's assignments

## Files Created/Modified

### New API Routes:
- `/workspace/src/app/api/organizations/[id]/assignments/route.ts`
- `/workspace/src/app/api/organizations/[id]/assignments/[assignmentId]/route.ts`
- `/workspace/src/app/api/organizations/[id]/templates/route.ts`
- `/workspace/src/app/api/organizations/[id]/templates/[templateId]/route.ts`

### New Components:
- `/workspace/src/components/organizations/organization-assignment.tsx`

### Documentation:
- `/workspace/docs/phase4-organization-management.md` (this file)

## Next Steps

Phase 4 completes the multi-tenant organization management foundation. The next phases will build on this:

- **Phase 5**: Form builder with drag-and-drop UI for creating template fields
- **Phase 6**: Import/Export functionality for templates and documents
- **Phase 7**: Signer alert/reminder system for assignments
- **Phase 8**: Advanced template & form assignment workflows
- **Phase 9**: Integration, polish, and comprehensive testing
