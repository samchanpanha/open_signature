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

  // Toast
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info';
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
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

  toastMessage: null,
  toastType: 'info',
  showToast: (message, type = 'info') => set({ toastMessage: message, toastType: type }),
  hideToast: () => set({ toastMessage: null }),
}));