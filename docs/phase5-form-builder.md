# Phase 5: Form Builder with Drag-and-Drop

## Overview
Implemented a complete drag-and-drop form builder for creating reusable form templates with customizable fields.

## Features

### Core Components

#### 1. FormBuilder Component (`/src/components/form-builder/form-builder.tsx`)
- **Drag-and-drop interface** using `@dnd-kit` libraries
- **Field palette** with 8 field types:
  - Text Input
  - Number
  - Email
  - Text Area
  - Date Picker
  - Dropdown (Select)
  - Checkbox
  - Signature
- **Live preview** of the form as you build it
- **Field editor dialog** for customizing:
  - Label
  - Field type
  - Placeholder text
  - Default value
  - Options (for dropdowns)
  - Required toggle
- **Reorderable fields** via drag-and-drop
- **Delete functionality** for each field

#### 2. Form Templates Page (`/src/app/form-templates/page.tsx`)
- List all form templates for an organization
- Create new templates
- Edit existing templates
- Delete templates
- Shows template metadata (field count, creator, dates)

### API Endpoints

#### GET `/api/form-templates?orgId={id}`
List all form templates for an organization.

**Response:**
```json
{
  "templates": [
    {
      "id": "...",
      "name": "Employee Onboarding",
      "description": "New hire paperwork",
      "schema": "{}",
      "fields": [...],
      "creator": { "id": "...", "name": "John", "email": "john@example.com" },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST `/api/form-templates`
Create a new form template.

**Request Body:**
```json
{
  "name": "Contact Form",
  "description": "Customer contact information",
  "orgId": "...",
  "schema": {},
  "fields": [
    {
      "type": "text",
      "label": "Full Name",
      "placeholder": "Enter your name",
      "required": true
    },
    {
      "type": "email",
      "label": "Email Address",
      "required": true
    },
    {
      "type": "select",
      "label": "Subject",
      "options": ["Support", "Sales", "Other"],
      "required": false
    }
  ]
}
```

#### GET `/api/form-templates/[id]`
Get a specific form template by ID.

#### PUT `/api/form-templates/[id]`
Update a form template including its fields.

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "New description",
  "schema": {},
  "fields": [...]
}
```

#### DELETE `/api/form-templates/[id]`
Delete a form template.

### Database Schema Updates

Added `order` field to `FormField` model for maintaining field sequence:

```prisma
model FormField {
  id            String   @id @default(cuid())
  type          String
  label         String
  placeholder   String?
  required      Boolean  @default(false)
  options       String?  // JSON array for select fields
  defaultValue  String?
  validation    String?  // JSON validation rules
  formTemplateId String
  order         Int      @default(0)  // NEW FIELD
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  formTemplate FormTemplate @relation(fields: [formTemplateId], references: [id], onDelete: Cascade)
}
```

## Usage

### Basic Integration

```tsx
import { FormTemplatesPage } from '@/app/form-templates/page';

// In your organization dashboard
<FormTemplatesPage orgId={currentOrgId} />
```

### Using FormBuilder Directly

```tsx
import { FormBuilder } from '@/components/form-builder/form-builder';

function MyForm() {
  const handleSave = (fields) => {
    console.log('Saved fields:', fields);
    // Save to your backend
  };

  return (
    <FormBuilder
      initialFields={[]}
      onSave={handleSave}
      onCancel={() => console.log('Cancelled')}
    />
  );
}
```

## Security Features

- **Role-based access control**: Only owners/admins can create/edit/delete templates
- **Permission checks**: Custom permissions can be granted for form management
- **Organization scoping**: Templates are isolated per organization
- **Authentication required**: All API endpoints require valid user session

## Dependencies

The following packages are required (already in package.json):
- `@dnd-kit/core` - Drag and drop context
- `@dnd-kit/sortable` - Sortable list functionality
- `@dnd-kit/utilities` - CSS transforms and utilities

## Next Steps

After creating form templates, they can be:
1. Assigned to users (Phase 8)
2. Used in document workflows
3. Integrated with signing processes
4. Exported/Imported (Phase 6)

## Files Created

1. `/src/app/api/form-templates/route.ts` - List/create templates
2. `/src/app/api/form-templates/[id]/route.ts` - Get/update/delete template
3. `/src/components/form-builder/form-builder.tsx` - Drag-and-drop builder component
4. `/src/app/form-templates/page.tsx` - UI page for managing templates
5. `/docs/phase5-form-builder.md` - This documentation

## Database Migration Required

Run after schema changes:
```bash
npx prisma migrate dev --name add_form_field_order
npx prisma generate
```
