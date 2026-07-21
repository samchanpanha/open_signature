'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { orgApi, brandingApi, webhooksApi, emailTemplatesApi, apiKeysApi, type OrgDetail, type Webhook, type EmailTemplate, type ApiKey } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type OrgTab = 'members' | 'branding' | 'workflows' | 'contacts' | 'webhooks' | 'api-keys' | 'email-templates';

interface OrgSettingsContextType {
  orgId: string;
  activeTab: OrgTab;
  setActiveTab: (tab: OrgTab) => void;
  loading: boolean;
  orgDetail: OrgDetail | null;
  currentRole: string;
  isOwner: boolean;

  // Branding
  brandingForm: { name: string; logoUrl: string; brandColor: string; customDomain: string };
  setBrandingForm: (f: { name: string; logoUrl: string; brandColor: string; customDomain: string }) => void;
  brandingSaving: boolean;
  saveBranding: () => Promise<void>;

  // Members
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: string;
  setInviteRole: (v: string) => void;
  inviting: boolean;
  inviteMember: () => Promise<void>;
  updateMemberRole: (memberId: string, newRole: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  deleteOrgConfirm: boolean;
  setDeleteOrgConfirm: (v: boolean) => void;
  deletingOrg: boolean;
  deleteOrg: () => Promise<void>;

  // Webhooks
  webhooks: Webhook[];
  loadWebhooks: () => Promise<void>;

  // API Keys
  apiKeys: ApiKey[];
  showCreateKey: boolean;
  setShowCreateKey: (v: boolean) => void;
  newKeyName: string;
  setNewKeyName: (v: string) => void;
  newKeyScopes: string[];
  setNewKeyScopes: (v: string[]) => void;
  newKeyPlain: string | null;
  setNewKeyPlain: (v: string | null) => void;
  createApiKey: () => Promise<void>;
  loadApiKeys: () => Promise<void>;

  // Email Templates
  emailTemplates: EmailTemplate[];
  loadEmailTemplates: () => Promise<void>;
  seedEmailTemplates: () => Promise<void>;
  previewEmailTemplate: EmailTemplate | null;
  setPreviewEmailTemplate: (v: EmailTemplate | null) => void;
  emailPreviewHtml: string;
  emailPreviewSubject: string;
  emailPreviewLoading: boolean;
  previewEmailTemplateFn: (template: EmailTemplate) => Promise<void>;

  refresh: () => void;
}

const OrgSettingsContext = createContext<OrgSettingsContextType | null>(null);

export function useOrgSettings() {
  const ctx = useContext(OrgSettingsContext);
  if (!ctx) throw new Error('useOrgSettings must be used within OrgSettingsProvider');
  return ctx;
}

export function OrgSettingsProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const store = useAppStore();
  const orgId = params.id as string;

  const [activeTab, setActiveTab] = useState<OrgTab>('members');
  const [loading, setLoading] = useState(true);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);

  // Branding
  const [brandingForm, setBrandingForm] = useState({ name: '', logoUrl: '', brandColor: '#10b981', customDomain: '' });
  const [brandingSaving, setBrandingSaving] = useState(false);

  // Members
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);

  // Webhooks
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [newKeyPlain, setNewKeyPlain] = useState<string | null>(null);

  // Email Templates
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [previewEmailTemplate, setPreviewEmailTemplate] = useState<EmailTemplate | null>(null);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [emailPreviewSubject, setEmailPreviewSubject] = useState('');
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const currentRole = orgDetail?.members?.find(m => m.user.id === store.user?.id)?.role || 'member';
  const isOwner = currentRole === 'owner';

  const loadOrgDetail = useCallback(async () => {
    try {
      const detail = await orgApi.get(orgId);
      setOrgDetail(detail);
      setBrandingForm({
        name: detail.name || '',
        logoUrl: detail.logoUrl || '',
        brandColor: detail.brandColor || '#10b981',
        customDomain: detail.customDomain || '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load organization');
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [orgId, router]);

  const loadWebhooks = useCallback(async () => {
    try {
      const wh = await webhooksApi.list(orgId);
      setWebhooks(wh);
    } catch { /* ok */ }
  }, [orgId]);

  const loadApiKeys = useCallback(async () => {
    try {
      const keys = await apiKeysApi.list(orgId);
      setApiKeys(keys);
    } catch { /* ok */ }
  }, [orgId]);

  const loadEmailTemplates = useCallback(async () => {
    try {
      const et = await emailTemplatesApi.list(orgId);
      setEmailTemplates(et);
    } catch { /* ok */ }
  }, [orgId]);

  useEffect(() => {
    loadOrgDetail();
  }, [loadOrgDetail, refreshKey]);

  useEffect(() => {
    loadWebhooks();
    loadApiKeys();
    loadEmailTemplates();
  }, [loadWebhooks, loadApiKeys, loadEmailTemplates, refreshKey]);

  const saveBranding = async () => {
    setBrandingSaving(true);
    try {
      await brandingApi.update({
        ...(brandingForm.name.trim() ? { name: brandingForm.name.trim() } : {}),
        ...(brandingForm.logoUrl.trim() ? { logoUrl: brandingForm.logoUrl.trim() } : { logoUrl: '' }),
        brandColor: brandingForm.brandColor,
        ...(brandingForm.customDomain.trim() ? { customDomain: brandingForm.customDomain.trim() } : { customDomain: '' }),
      });
      toast.success('Branding updated');
      loadOrgDetail();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update branding');
    } finally {
      setBrandingSaving(false);
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await orgApi.inviteMember(orgId, inviteEmail.trim(), inviteRole);
      toast.success('Member invited successfully!');
      setInviteEmail('');
      setInviteRole('member');
      loadOrgDetail();
    } catch (err: any) {
      toast.error(err.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      await orgApi.updateMemberRole(orgId, memberId, newRole);
      toast.success('Role updated');
      loadOrgDetail();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await orgApi.removeMember(orgId, memberId);
      toast.success('Member removed');
      loadOrgDetail();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const deleteOrg = async () => {
    setDeletingOrg(true);
    try {
      await orgApi.delete(orgId);
      toast.success('Organization deleted');
      setDeleteOrgConfirm(false);
      if (store.currentOrgId === orgId) {
        store.setCurrentOrgId(null);
      }
      router.push('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete organization');
    } finally {
      setDeletingOrg(false);
    }
  };

  const createApiKey = async () => {
    try {
      const res = await apiKeysApi.create({
        name: newKeyName.trim(),
        permissions: newKeyScopes,
        orgId,
      });
      setNewKeyPlain(res.key);
      toast.success('API key created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create key');
    }
  };

  const seedEmailTemplates = async () => {
    try {
      await emailTemplatesApi.seed(orgId);
      loadEmailTemplates();
      toast.success('Default templates seeded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to seed templates');
    }
  };

  const previewEmailTemplateFn = async (template: EmailTemplate) => {
    setPreviewEmailTemplate(template);
    setEmailPreviewLoading(true);
    try {
      const res = await fetch(`/api/email-templates/${template.id}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setEmailPreviewHtml(data.html || '');
      setEmailPreviewSubject(data.subject || '');
    } catch {
      setEmailPreviewHtml('<p>Failed to load preview</p>');
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <OrgSettingsContext.Provider value={{
      orgId, activeTab, setActiveTab, loading, orgDetail, currentRole, isOwner,
      brandingForm, setBrandingForm, brandingSaving, saveBranding,
      inviteEmail, setInviteEmail, inviteRole, setInviteRole, inviting, inviteMember,
      updateMemberRole, removeMember, deleteOrgConfirm, setDeleteOrgConfirm, deletingOrg, deleteOrg,
      webhooks, loadWebhooks,
      apiKeys, showCreateKey, setShowCreateKey, newKeyName, setNewKeyName,
      newKeyScopes, setNewKeyScopes, newKeyPlain, setNewKeyPlain, createApiKey, loadApiKeys,
      emailTemplates, loadEmailTemplates, seedEmailTemplates,
      previewEmailTemplate, setPreviewEmailTemplate, emailPreviewHtml, emailPreviewSubject,
      emailPreviewLoading, previewEmailTemplateFn,
      refresh,
    }}>
      {children}
    </OrgSettingsContext.Provider>
  );
}
