const API_BASE = '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...getHeaders(), ...options.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// Auth
export const authApi = {
  register: (email: string, name: string, password: string) =>
    request<{ token: string; user: { id: string; email: string; name: string } }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token?: string; user?: { id: string; email: string; name: string }; requiresPasswordSetup?: boolean; message?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ id: string; email: string; name: string }>('/api/auth/me'),
  setupPassword: (email: string, password: string) =>
    request<{ success: boolean; message: string }>('/api/auth/setup-password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// Organizations
export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
  documentCount: number;
  createdAt: string;
}

export interface OrgDetail extends OrgListItem {
  ownerId: string;
  logoUrl: string | null;
  brandColor: string | null;
  customDomain: string | null;
  members: {
    id: string;
    role: string;
    joinedAt: string;
    user: { id: string; email: string; name: string };
  }[];
}

export interface OrgMember {
  id: string;
  role: string;
  inviteStatus: string;
  isActive: boolean;
  lastLoginAt: string | null;
  joinedAt: string;
  createdAt: string;
  user: { id: string; email: string; name: string };
  inviter?: { id: string; name: string; email: string } | null;
  tempPassword?: string;
  isNewUser?: boolean;
}

export const orgApi = {
  list: () => request<OrgListItem[]>('/api/organizations'),
  get: (id: string) => request<OrgDetail>(`/api/organizations/${id}`),
  create: (name: string) =>
    request<OrgListItem>('/api/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) => request(`/api/organizations/${id}`, { method: 'DELETE' }),
  listMembers: (orgId: string) => request<OrgMember[]>(`/api/organizations/${orgId}/members`),
  inviteMember: (orgId: string, email: string, role?: string, name?: string, password?: string) =>
    request<OrgMember>(`/api/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role, name, password }),
    }),
  updateMember: (orgId: string, memberId: string, data: { role?: string; isActive?: boolean; inviteStatus?: string }) =>
    request<OrgMember>(`/api/organizations/${orgId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateMemberRole: (orgId: string, memberId: string, role: string) =>
    request<OrgMember>(`/api/organizations/${orgId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  removeMember: (orgId: string, memberId: string) =>
    request(`/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' }),
  sendInviteNotification: (orgId: string, memberId: string) =>
    request<{ success: boolean; message: string }>(`/api/organizations/${orgId}/members/${memberId}/invite`, {
      method: 'POST',
    }),
};

// Documents
export interface DocumentListItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  signerCount: number;
  signedCount: number;
  expiresAt?: string | null;
  ccRecipients?: { name: string; email: string }[];
  rejectionReason?: string | null;
  rejectedBy?: string | null;
  organizationId?: string | null;
  owner?: { id: string; name: string; email: string };
  isOwner?: boolean;
  ownerRole?: string | null;
  signedPdfPath?: string | null;
  tags?: { id: string; name: string; color: string | null }[];
}

export interface DocumentDetail extends DocumentListItem {
  originalPdfPath: string;
  signedPdfPath: string | null;
  ownerId: string;
  workflowId?: string | null;
  workflow?: {
    id: string;
    name: string;
    steps: {
      id: string;
      name: string;
      order: number;
      stepType: string;
      user: { id: string; name: string; email: string };
    }[];
  } | null;
  signers: {
    id: string;
    email: string;
    name: string;
    order: number;
    signedAt: string | null;
    token?: string;
    rejectedAt?: string | null;
    rejectionReason?: string | null;
  }[];
  fields: {
    id: string;
    type: string;
    label?: string | null;
    required: boolean;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    value: string | null;
    signerId: string | null;
    options?: string[] | null;
  }[];
}

export interface SignerInfo {
  id: string;
  email: string;
  name: string;
  order: number;
  signedAt: string | null;
  fields: {
    id: string;
    type: string;
    label?: string | null;
    required: boolean;
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    value: string | null;
    options?: string[] | null;
  }[];
}

export const documentsApi = {
  list: (orgId?: string | null, search?: string, signerEmail?: string, folderId?: string | null) => {
    const params = new URLSearchParams();
    if (orgId !== undefined && orgId !== null) params.set('orgId', orgId);
    if (search) params.set('search', search);
    if (signerEmail) params.set('signerEmail', signerEmail);
    if (folderId !== undefined) params.set('folderId', folderId || '');
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<DocumentListItem[]>(`/api/documents${query}`);
  },
  get: (id: string) => request<DocumentDetail>(`/api/documents/${id}`),
  create: (formData: FormData) =>
    fetch('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data as DocumentDetail;
    }),
  delete: (id: string) => request(`/api/documents/${id}`, { method: 'DELETE' }),
  rename: (id: string, title: string) =>
    request<{ id: string; title: string }>(`/api/documents/${id}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    }),
  resend: (id: string, signerIds?: string[]) =>
    request<{ success: boolean; resent: number }>(`/api/documents/${id}/resend`, {
      method: 'POST',
      body: JSON.stringify({ signerIds: signerIds || [] }),
    }),
  formData: (id: string, format: 'json' | 'csv' = 'json') =>
    request<{ documentId: string; title: string; fields: any[] }>(`/api/documents/${id}/form-data?format=${format}`),
  moveToFolder: (id: string, folderId: string | null) =>
    request<{ document: any }>(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ folderId }),
    }),
  bulk: (action: 'move' | 'delete', documentIds: string[], folderId?: string | null) =>
    request<{ affected: number }>('/api/documents/bulk', {
      method: 'POST',
      body: JSON.stringify({ action, documentIds, folderId }),
    }),
  send: (id: string, signers: { email: string; name: string }[], fieldAssignments?: { fieldId: string; signerIndex: number }[], ccRecipients?: { name: string; email: string }[], expiresAt?: string, workflowId?: string, currentStepIndex?: number, requireOtp?: boolean) =>
    request<DocumentDetail>(`/api/documents/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ signers, fieldAssignments, ccRecipients, expiresAt, workflowId, currentStepIndex, requireOtp }),
    }),
  download: (id: string) =>
    fetch(`/api/documents/${id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(async (res) => {
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }),
  audit: (id: string) =>
    request<{ id: string; action: string; createdAt: string; details: string | null; ipAddress: string | null; userAgent: string | null }[]>(
      `/api/documents/${id}/audit`
    ),
  duplicate: (id: string) =>
    request<DocumentDetail>(`/api/documents/${id}/duplicate`, { method: 'POST' }),
  signSelf: (id: string) =>
    request<{ token: string }>(`/api/documents/${id}/sign-self`, { method: 'POST' }),
  addTag: (id: string, name: string, color?: string) =>
    request<{ tag: { id: string; name: string; color: string | null } }>(`/api/documents/${id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
  removeTag: (id: string, tagId: string) =>
    request<{ success: boolean }>(`/api/documents/${id}/tags`, {
      method: 'DELETE',
      body: JSON.stringify({ tagId }),
    }),
  certificate: (id: string) =>
    fetch(`/api/documents/${id}/certificate`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(async (res) => {
      if (!res.ok) throw new Error('Certificate download failed');
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }),
};

// Fields
export const fieldsApi = {
  create: (documentId: string, field: { type: string; pageNumber: number; x: number; y: number; width: number; height: number; signerId?: string; label?: string; required?: boolean }) =>
    request('/api/fields', {
      method: 'POST',
      body: JSON.stringify({ documentId, ...field }),
    }),
  update: (id: string, data: { value?: string; signerId?: string | null; x?: number; y?: number; width?: number; height?: number; label?: string | null; required?: boolean }) =>
    request(`/api/fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request(`/api/fields/${id}`, { method: 'DELETE' }),
};

// Signing (guest)
export const signingApi = {
  getInfo: (token: string) =>
    request<{ signer: SignerInfo; document: { id: string; title: string; status: string; expiresAt?: string | null } }>(`/api/sign/${token}`),
  updateField: (token: string, fieldId: string, value: string) =>
    request(`/api/sign/${token}/field`, {
      method: 'PUT',
      body: JSON.stringify({ fieldId, value }),
    }),
  complete: (token: string) =>
    request<{ success: boolean }>(`/api/sign/${token}/complete`, { method: 'POST' }),
  downloadSigned: (token: string) =>
    fetch(`/api/sign/${token}/download`).then(async (res) => {
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }),
  reject: (token: string, reason: string) =>
    request(`/api/sign/${token}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// Templates
export const templatesApi = {
  list: () => request<{ id: string; name: string; fieldConfig: any[]; createdAt: string }[]>('/api/templates'),
  create: (name: string, fieldConfig: any[]) =>
    request('/api/templates', {
      method: 'POST',
      body: JSON.stringify({ name, fieldConfig }),
    }),
  duplicate: (id: string) =>
    request<{ id: string; name: string }>(`/api/templates/${id}/duplicate`, { method: 'POST' }),
  delete: (id: string) => request(`/api/templates/${id}`, { method: 'DELETE' }),
};

// Saved Signatures
export const signaturesApi = {
  list: () => request<{ id: string; name: string; dataUrl: string; createdAt: string }[]>('/api/signatures'),
  save: (name: string, dataUrl: string) =>
    request('/api/signatures', {
      method: 'POST',
      body: JSON.stringify({ name, dataUrl }),
    }),
  delete: (id: string) =>
    request(`/api/signatures?id=${id}`, { method: 'DELETE' }),
};

// Workflows
export interface WorkflowStep {
  id: string;
  name: string;
  order: number;
  stepType: string;
  user: { id: string; email: string; name: string };
}

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdBy: { id: string; email: string; name: string };
  documentCount: number;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDetail extends WorkflowListItem {
  documents: { id: string; title: string; status: string; createdAt: string }[];
}

export const workflowsApi = {
  list: (orgId: string) =>
    request<WorkflowListItem[]>(`/api/workflows?orgId=${orgId}`),
  get: (id: string) =>
    request<WorkflowDetail>(`/api/workflows/${id}`),
  create: (data: { name: string; description?: string; orgId: string; steps: { name: string; stepType: string; userId: string }[] }) =>
    request<WorkflowListItem>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: { name?: string; description?: string; isActive?: boolean; steps?: { name: string; stepType: string; userId: string }[] }) =>
    request<WorkflowListItem>(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request(`/api/workflows/${id}`, { method: 'DELETE' }),
  export: (id: string) =>
    request<{ templateVersion: number; name: string; description: string; steps: { name: string; stepType: string; userEmail: string; order: number }[]; exportedAt: string }>(`/api/workflows/${id}/export`),
  import: (data: { template: { name: string; description?: string; steps: { name: string; stepType: string; userEmail: string; order: number }[] }; orgId: string; nameOverride?: string }) =>
    request<WorkflowListItem>('/api/workflows/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// OTP Verification
export const otpApi = {
  requestOtp: (token: string) =>
    request<{ success: boolean }>(`/api/sign/${token}/request-otp`, { method: 'POST' }),
  verifyOtp: (token: string, code: string) =>
    request<{ success: boolean }>(`/api/sign/${token}/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
};

// Completion Certificate
export const certificateApi = {
  generate: (documentId: string) =>
    request<{ certificatePath: string }>(`/api/documents/${documentId}/certificate`),
};

// Contacts
export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  createdAt: string;
}

export const contactsApi = {
  list: () => request<{ contacts: Contact[] }>('/api/contacts').then(d => d.contacts),
  create: (data: { name: string; email: string; phone?: string; company?: string }) =>
    request<Contact>('/api/contacts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; email?: string; phone?: string; company?: string }) =>
    request<Contact>(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/contacts/${id}`, { method: 'DELETE' }),
};

// Contact Groups
export interface ContactGroup {
  id: string;
  name: string;
  contacts: { id: string; contact: { id: string; name: string; email: string } }[];
}

export const contactGroupsApi = {
  list: () => request<{ groups: ContactGroup[] }>('/api/contact-groups').then(d => d.groups),
  create: (data: { name: string; contactIds?: string[] }) =>
    request<{ group: ContactGroup }>('/api/contact-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(d => d.group),
  update: (groupId: string, contactIds: string[]) =>
    request<{ group: ContactGroup }>('/api/contact-groups', {
      method: 'PUT',
      body: JSON.stringify({ groupId, contactIds }),
    }).then(d => d.group),
  remove: (groupId: string) =>
    request('/api/contact-groups', { method: 'DELETE', body: JSON.stringify({ groupId }) }),
};

// Folders
export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  createdAt: string;
}

export const foldersApi = {
  list: (orgId: string) => request<{ folders: Folder[] }>(`/api/folders?orgId=${orgId}`).then(d => d.folders),
  create: (data: { name: string; parentId?: string; orgId: string }) =>
    request<Folder>('/api/folders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name: string }) =>
    request<Folder>(`/api/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/folders/${id}`, { method: 'DELETE' }),
};

// Webhooks
export interface Webhook {
  id: string;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: string;
}

export const webhooksApi = {
  list: (orgId: string) => request<{ webhooks: Webhook[] }>(`/api/webhooks?orgId=${orgId}`).then(d => d.webhooks),
  create: (data: { url: string; events: string[]; orgId: string }) =>
    request<Webhook>('/api/webhooks', { method: 'POST', body: JSON.stringify({ ...data, events: JSON.stringify(data.events) }) }),
  update: (id: string, data: { url?: string; events?: string[]; isActive?: boolean }) =>
    request<Webhook>(`/api/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, events: data.events ? JSON.stringify(data.events) : undefined }),
    }),
  delete: (id: string) => request(`/api/webhooks/${id}`, { method: 'DELETE' }),
};

// Public Templates
export interface PublicTemplate {
  id: string;
  name: string;
  description?: string;
  shareToken: string;
  fieldConfig: string;
  isActive: boolean;
  createdAt: string;
}

export const publicTemplatesApi = {
  list: (orgId: string) => request<PublicTemplate[]>(`/api/public-templates?orgId=${orgId}`),
  create: (data: { name: string; description?: string; fieldConfig: object; orgId: string }) =>
    request<PublicTemplate>('/api/public-templates', {
      method: 'POST',
      body: JSON.stringify({ ...data, fieldConfig: JSON.stringify(data.fieldConfig) }),
    }),
  getByToken: (token: string) => request<PublicTemplate>(`/api/public-templates/${token}`),
};

// Email Templates
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  isDefault: boolean;
  createdAt: string;
}

export const emailTemplatesApi = {
  list: (orgId: string) => request<{ templates: EmailTemplate[] }>(`/api/email-templates?orgId=${orgId}`).then(d => d.templates),
  get: (id: string) => request<EmailTemplate>(`/api/email-templates/${id}`),
  create: (data: { name: string; subject: string; htmlBody: string; orgId: string }) =>
    request<EmailTemplate>('/api/email-templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; subject?: string; htmlBody?: string }) =>
    request<EmailTemplate>(`/api/email-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/email-templates/${id}`, { method: 'DELETE' }),
  seed: (orgId: string) =>
    request<{ created: number }>('/api/email-templates/seed', { method: 'POST', body: JSON.stringify({ orgId }) }),
};

// API Keys
export interface ApiKey {
  id: string;
  name: string;
  key?: string;
  permissions: string;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

export const apiKeysApi = {
  list: (orgId: string) => request<{ apiKeys: ApiKey[] }>(`/api/api-keys?orgId=${orgId}`).then(d => d.apiKeys),
  create: (data: { name: string; permissions: string[]; orgId: string; expiresAt?: string }) =>
    request<ApiKey & { key: string }>('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ ...data, permissions: JSON.stringify(data.permissions) }),
    }),
  delete: (id: string) => request(`/api/api-keys/${id}`, { method: 'DELETE' }),
};

// Reminders
export interface Reminder {
  id: string;
  type: string;
  scheduledAt: string;
  sentAt?: string;
  message: string;
  documentId: string;
  createdAt: string;
}

export const remindersApi = {
  list: (documentId: string) => request<Reminder[]>(`/api/reminders?documentId=${documentId}`),
  create: (data: { documentId: string; type?: string; scheduledAt: string; message?: string }) =>
    request<{ reminder: Reminder }>('/api/reminders', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/api/reminders?id=${id}`, { method: 'DELETE' }),
};

// Expire check
export const expireApi = {
  check: () => request<{ expiredCount: number }>('/api/documents/expire'),
};

// Document Rejection
export const rejectionApi = {
  reject: (token: string, reason?: string) =>
    request(`/api/sign/${token}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

// Document Revoke
export const revokeApi = {
  revoke: (documentId: string, reason?: string) =>
    request(`/api/documents/${documentId}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

// Bulk Send
export interface BulkRecipient {
  email: string;
  name?: string;
  role?: string;
}
export const bulkSendApi = {
  send: (documentId: string, recipients: BulkRecipient[], expiresInDays?: number) =>
    request<{ totalSent: number; results: any[] }>('/api/documents/bulk-send', {
      method: 'POST',
      body: JSON.stringify({ documentId, recipients, expiresInDays }),
    }),
};

// Password Protection
export const passwordApi = {
  getStatus: (documentId: string) =>
    request<{ hasPassword: boolean }>(`/api/documents/${documentId}/password`),
  set: (documentId: string, password: string) =>
    request(`/api/documents/${documentId}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
  remove: (documentId: string) =>
    request(`/api/documents/${documentId}/password`, { method: 'DELETE' }),
};

// Download Links (with expiry)
export const downloadLinkApi = {
  create: (documentId: string, type: 'signed_pdf' | 'certificate') =>
    request<{ url: string; expiresAt: string }>(`/api/documents/${documentId}/download-link`, {
      method: 'POST', body: JSON.stringify({ type }),
    }),
};

// Analytics
export const analyticsApi = {
  get: () => request<any>('/api/analytics'),
};

// Branding / White-label
export const brandingApi = {
  get: () => request<any>('/api/branding'),
  update: (data: { logoUrl?: string; brandColor?: string; customDomain?: string; name?: string }) =>
    request('/api/branding', { method: 'PUT', body: JSON.stringify(data) }),
};

// User Profile
export const profileApi = {
  get: () => request<any>('/api/auth/profile'),
  update: (data: { name?: string; company?: string; jobTitle?: string; phone?: string; avatarUrl?: string }) =>
    request<any>('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
};

// Template Offline Signing
export const offlineSignApi = {
  get: (templateId: string) =>
    request<{ allowOfflineSign: boolean }>(`/api/templates/${templateId}/offline`),
  toggle: (templateId: string, allowOfflineSign: boolean) =>
    request(`/api/templates/${templateId}/offline`, { method: 'PUT', body: JSON.stringify({ allowOfflineSign }) }),
};

// Permissions
export const permissionsApi = {
  list: (orgId: string) =>
    request<{ id: string; resource: string; action: string; granted: boolean; userId: string; user?: { email: string; name: string } }[]>(`/api/permissions?orgId=${orgId}`),
  grant: (data: { userId: string; orgId: string; resource: string; action: string; granted?: boolean }) =>
    request('/api/permissions', { method: 'POST', body: JSON.stringify(data) }),
  revoke: (permissionId: string) =>
    request(`/api/permissions?id=${permissionId}`, { method: 'DELETE' }),
  applyRole: (userId: string, orgId: string, role: string) =>
    request<{ success: boolean; role: string; permissionsCreated: number }>('/api/permissions/batch', {
      method: 'POST',
      body: JSON.stringify({ userId, orgId, role }),
    }),
};

// Document Permissions
export interface DocumentPermission {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
}

export interface OrgMemberForDoc {
  userId: string;
  role: string;
  name: string;
  email: string;
}

export interface DocAccessEntry {
  userId: string;
  name: string;
  email: string;
  role: string;
  accessType: 'owner' | 'role' | 'shared';
}

export const documentPermissionsApi = {
  get: (docId: string) =>
    request<{ permissions: DocumentPermission[]; orgMembers: OrgMemberForDoc[]; allAccess: DocAccessEntry[] }>(`/api/documents/${docId}/permissions`),
  add: (docId: string, targetUserId: string, action: string) =>
    request<{ id: string; success: boolean }>(`/api/documents/${docId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, action }),
    }),
  remove: (docId: string, targetUserId: string, action: string) =>
    request<{ success: boolean }>(`/api/documents/${docId}/permissions?userId=${targetUserId}&action=${action}`, {
      method: 'DELETE',
    }),
};

// Template Permissions
export const templatePermissionsApi = {
  get: (templateId: string) =>
    request<{ permissions: DocumentPermission[]; orgMembers: OrgMemberForDoc[] }>(`/api/templates/${templateId}/permissions`),
  add: (templateId: string, targetUserId: string, action: string) =>
    request<{ id: string; success: boolean }>(`/api/templates/${templateId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, action }),
    }),
  remove: (templateId: string, targetUserId: string, action: string) =>
    request<{ success: boolean }>(`/api/templates/${templateId}/permissions?userId=${targetUserId}&action=${action}`, {
      method: 'DELETE',
    }),
};

// User Permissions Overview
export interface UserDocumentPermission {
  id: string;
  action: string;
  documentId: string;
  documentTitle: string;
  organizationId: string | null;
  grantedBy: string;
  grantedAt: string;
}

export interface UserTemplatePermission {
  id: string;
  action: string;
  templateId: string;
  templateName: string;
  organizationId: string | null;
  grantedBy: string;
  grantedAt: string;
}

export interface UserOrgMembership {
  orgId: string;
  orgName: string;
  role: string;
  isActive: boolean;
}

export const userPermissionsApi = {
  get: (userId: string) =>
    request<{
      documentPermissions: UserDocumentPermission[];
      templatePermissions: UserTemplatePermission[];
      memberships: UserOrgMembership[];
      totalPermissions: number;
    }>(`/api/users/${userId}/permissions`),
  revokeAll: (userId: string, orgId: string) =>
    request<{ success: boolean; revoked: number }>(`/api/users/${userId}/permissions/revoke-all`, {
      method: 'POST',
      body: JSON.stringify({ orgId }),
    }),
};

// Bulk Permissions
export interface BulkPermissionItem {
  userId: string;
  documentId?: string;
  templateId?: string;
  action: string;
}

export const bulkPermissionsApi = {
  set: (permissions: BulkPermissionItem[], orgId?: string) =>
    request<{ success: boolean; created: number; skipped: number }>('/api/permissions/bulk', {
      method: 'POST',
      body: JSON.stringify({ permissions, orgId }),
    }),
};

// Expiring Permissions
export interface ExpiringPermission {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  documentId: string | null;
  documentTitle: string | null;
  templateId: string | null;
  templateName: string | null;
  orgId: string | null;
  orgName: string | null;
  expiresAt: string;
  daysUntilExpiry: number;
}

export const expiringPermissionsApi = {
  get: (days: number = 7, orgId?: string) => {
    const params = new URLSearchParams();
    params.set('days', days.toString());
    if (orgId) params.set('orgId', orgId);
    return request<{ permissions: ExpiringPermission[]; total: number }>(`/api/permissions/expiring?${params.toString()}`);
  },
};

// Permission Extension
export const permissionExtensionApi = {
  extend: (permissionId: string, days: number) =>
    request<{ success: boolean; newExpiresAt: string }>(`/api/permissions/${permissionId}/extend`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    }),
};

// Organization Permissions Overview
export interface OrgPermission {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  documentId: string | null;
  documentTitle: string | null;
  templateId: string | null;
  templateName: string | null;
  grantedBy: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface OrgUserPermissions {
  userId: string;
  userName: string;
  userEmail: string;
  documentCount: number;
  templateCount: number;
  permissions: OrgPermission[];
}

export const orgPermissionsApi = {
  get: (orgId: string, resource?: 'document' | 'template', includeExpired?: boolean) => {
    const params = new URLSearchParams();
    if (resource) params.set('resource', resource);
    if (includeExpired) params.set('includeExpired', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ permissions: OrgPermission[]; byUser: OrgUserPermissions[]; total: number }>(
      `/api/organizations/${orgId}/permissions${query}`
    );
  },
  export: (orgId: string) => {
    return `/api/organizations/${orgId}/permissions/export`;
  },
  history: (orgId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ history: PermissionHistoryEntry[]; totalCount: number; hasMore: boolean }>(
      `/api/organizations/${orgId}/permissions/history${query}`
    );
  },
};

// Permission Templates
export interface PermissionTemplate {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  permissions: string; // JSON array
  createdAt: string;
  updatedAt: string;
}

export interface PermissionTemplateListItem {
  id: string;
  name: string;
  description: string | null;
  permissions: Array<{ resource: string; action: string }>;
}

export const permissionTemplatesApi = {
  list: (orgId: string) =>
    request<{ templates: PermissionTemplate[] }>(`/api/organizations/${orgId}/permission-templates`),
  create: (orgId: string, data: { name: string; description?: string; permissions: Array<{ resource: string; action: string }> }) =>
    request<{ template: PermissionTemplate }>(`/api/organizations/${orgId}/permission-templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (orgId: string, templateId: string, data: { name?: string; description?: string; permissions?: Array<{ resource: string; action: string }> }) =>
    request<{ template: PermissionTemplate }>(`/api/organizations/${orgId}/permission-templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (orgId: string, templateId: string) =>
    request<{ success: boolean }>(`/api/organizations/${orgId}/permission-templates/${templateId}`, {
      method: 'DELETE',
    }),
  apply: (orgId: string, templateId: string, targetUserId: string) =>
    request<{ templateName: string; permissionsApplied: number }>(`/api/organizations/${orgId}/permission-templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
};

// Permission History
export interface PermissionHistoryEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  details: string | null;
  createdAt: string;
}

// Activity Log
export interface ActivityLogEntry {
  id: string;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  document: { id: string; title: string } | null;
}

export const activityApi = {
  get: (orgId: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit.toString());
    if (offset) params.set('offset', offset.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ activities: ActivityLogEntry[]; totalCount: number; hasMore: boolean }>(
      `/api/organizations/${orgId}/activity${query}`
    );
  },
};

// Onboarding
export const onboardingApi = {
  getStatus: () => request<{ steps: string[]; totalSteps: number; isComplete: boolean }>('/api/onboarding'),
  completeStep: (step: string) =>
    request<{ completedSteps: string[] }>('/api/onboarding', { method: 'POST', body: JSON.stringify({ step }) }),
};