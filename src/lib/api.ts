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
    request<{ token: string; user: { id: string; email: string; name: string } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ id: string; email: string; name: string }>('/api/auth/me'),
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
  joinedAt: string;
  user: { id: string; email: string; name: string };
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
  inviteMember: (orgId: string, email: string, role?: string) =>
    request<OrgMember>(`/api/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),
  updateMemberRole: (orgId: string, memberId: string, role: string) =>
    request<OrgMember>(`/api/organizations/${orgId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  removeMember: (orgId: string, memberId: string) =>
    request(`/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' }),
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
  list: (orgId?: string | null) => {
    const query = orgId !== undefined ? `?orgId=${orgId}` : '';
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
  send: (id: string, signers: { email: string; name: string }[], fieldAssignments?: { fieldId: string; signerIndex: number }[], ccRecipients?: { name: string; email: string }[], expiresAt?: string, workflowId?: string, currentStepIndex?: number) =>
    request<DocumentDetail>(`/api/documents/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ signers, fieldAssignments, ccRecipients, expiresAt, workflowId, currentStepIndex }),
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

// Onboarding
export const onboardingApi = {
  getStatus: () => request<{ steps: string[]; totalSteps: number; isComplete: boolean }>('/api/onboarding'),
  completeStep: (step: string) =>
    request<{ completedSteps: string[] }>('/api/onboarding', { method: 'POST', body: JSON.stringify({ step }) }),
};