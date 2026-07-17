import { create } from 'zustand';

export type AppView = 'auth' | 'dashboard' | 'editor' | 'viewer' | 'signing';

export interface User {
  id: string;
  email: string;
  name: string;
}

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;

  // Navigation
  currentView: AppView;
  setView: (view: AppView) => void;

  // Document editor
  editingDocumentId: string | null;
  setEditingDocument: (id: string | null) => void;

  // Document viewer
  viewingDocumentId: string | null;
  setViewingDocument: (id: string | null) => void;

  // Signing
  signingToken: string | null;
  setSigningToken: (token: string | null) => void;

  // Organization
  currentOrgId: string | null;  // null = personal, string = org id
  setCurrentOrgId: (id: string | null) => void;

  // Org settings dialog
  orgSettingsOpen: boolean;
  setOrgSettingsOpen: (open: boolean) => void;
  orgSettingsOrgId: string | null;
  openOrgSettings: (orgId: string) => void;
  closeOrgSettings: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, currentView: 'auth' });
  },

  currentView: 'auth',
  setView: (view) => set({ currentView: view }),

  editingDocumentId: null,
  setEditingDocument: (id) => set({ editingDocumentId: id }),

  viewingDocumentId: null,
  setViewingDocument: (id) => set({ viewingDocumentId: id }),

  signingToken: null,
  setSigningToken: (token) => set({ signingToken: token }),

  currentOrgId: null,
  setCurrentOrgId: (id) => set({ currentOrgId: id }),

  orgSettingsOpen: false,
  setOrgSettingsOpen: (open) => set({ orgSettingsOpen: open }),
  orgSettingsOrgId: null,
  openOrgSettings: (orgId) => set({ orgSettingsOpen: true, orgSettingsOrgId: orgId }),
  closeOrgSettings: () => set({ orgSettingsOpen: false, orgSettingsOrgId: null }),
}));