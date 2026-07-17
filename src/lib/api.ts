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
}

export interface DocumentDetail extends DocumentListItem {
  originalPdfPath: string;
  signedPdfPath: string | null;
  ownerId: string;
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
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    value: string | null;
    signerId: string | null;
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
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
    value: string | null;
  }[];
}

export const documentsApi = {
  list: () => request<DocumentListItem[]>('/api/documents'),
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
  send: (id: string, signers: { email: string; name: string }[], fieldAssignments?: { fieldId: string; signerIndex: number }[], ccRecipients?: { name: string; email: string }[], expiresAt?: string) =>
    request<DocumentDetail>(`/api/documents/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ signers, fieldAssignments, ccRecipients, expiresAt }),
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
  create: (documentId: string, field: { type: string; pageNumber: number; x: number; y: number; width: number; height: number; signerId?: string }) =>
    request('/api/fields', {
      method: 'POST',
      body: JSON.stringify({ documentId, ...field }),
    }),
  update: (id: string, data: { value?: string; signerId?: string | null }) =>
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

// PDF pages (rendered as images)
export const pdfApi = {
  getPages: (documentId: string) =>
    fetch(`/api/documents/${documentId}/pages`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(async (res) => {
      if (!res.ok) throw new Error('Failed to load pages');
      return res.json() as Promise<{ pages: { pageNumber: number; dataUrl: string; width: number; height: number }[] }>;
    }),
  getSigningPages: (token: string) =>
    fetch(`/api/sign/${token}/pages`).then(async (res) => {
      if (!res.ok) throw new Error('Failed to load pages');
      return res.json() as Promise<{ pages: { pageNumber: number; dataUrl: string; width: number; height: number }[] }>;
    }),
};