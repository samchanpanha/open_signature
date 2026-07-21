'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export type SettingsTab = 'overview' | 'general' | 'security' | 'notifications' | 'branding' | 'integrations' | 'team' | 'compliance' | 'system' | 'workflows' | 'advanced';

export interface SystemSettings {
  general: {
    appName: string;
    appDescription: string;
    maintenanceMode: boolean;
    allowRegistration: boolean;
    defaultLanguage: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    itemsPerPage: number;
    sessionWarningMinutes: number;
  };
  security: {
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireNumbers: boolean;
    passwordRequireSymbols: boolean;
    passwordRequireMixedCase: boolean;
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
    requireEmailVerification: boolean;
    enable2FA: boolean;
    ipWhitelist: string;
    enforceHttps: boolean;
    csrfProtection: boolean;
    rateLimitRequests: number;
    rateLimitWindowMs: number;
    allowPasswordReset: boolean;
    passwordHistoryCount: number;
    minPasswordAge: number;
    maxPasswordAge: number;
  };
  notifications: {
    emailEnabled: boolean;
    telegramEnabled: boolean;
    smsEnabled: boolean;
    dailyDigestEnabled: boolean;
    digestTime: string;
    reminderIntervalDays: number;
    notifyOnDocumentSent: boolean;
    notifyOnDocumentCompleted: boolean;
    notifyOnDocumentRejected: boolean;
    notifyOnDocumentExpiring: boolean;
    notifyOnMemberJoined: boolean;
    notifyOnSystemAlerts: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    notificationRetentionDays: number;
  };
  branding: {
    logoUrl: string;
    faviconUrl: string;
    brandColor: string;
    darkModeEnabled: boolean;
    customCss: string;
    emailHeaderHtml: string;
    emailFooterHtml: string;
    loginBackground: string;
    companyName: string;
    supportEmail: string;
    termsUrl: string;
    privacyUrl: string;
  };
  integrations: {
    telegramBotToken: string;
    telegramBotUsername: string;
    webhookRetryAttempts: number;
    webhookTimeoutMs: number;
    s3Endpoint: string;
    s3Bucket: string;
    s3AccessKey: string;
    s3SecretKey: string;
    s3Region: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    smtpSecure: boolean;
    smtpFromName: string;
    smtpFromEmail: string;
    twilioSid: string;
    twilioAuthToken: string;
    twilioPhone: string;
    openaiApiKey: string;
    googleClientId: string;
    googleClientSecret: string;
  };
  compliance: {
    auditLogRetentionDays: number;
    dataRetentionDays: number;
    enableTamperProofAudit: boolean;
    enableSigningCertificates: boolean;
    gdprModeEnabled: boolean;
    hipaaModeEnabled: boolean;
    soc2ModeEnabled: boolean;
    requireConsentOnSigning: boolean;
    dataResidency: string;
    encryptionAtRest: boolean;
    autoAnonymizeData: boolean;
    exportFormats: string[];
  };
  workflows: {
    maxWorkflowsPerOrg: number;
    maxStepsPerWorkflow: number;
    allowConditionalLogic: boolean;
    allowParallelBranches: boolean;
    defaultWorkflowTimeout: number;
    enableWorkflowTemplates: boolean;
    enableWorkflowVersioning: boolean;
    enableWorkflowAnalytics: boolean;
    autoArchiveCompleted: boolean;
    archiveAfterDays: number;
    requireApprovalForActivation: boolean;
    enableWorkflowComments: boolean;
    enableSLATracking: boolean;
    slaWarningHours: number;
    slaEscalationHours: number;
  };
  advanced: {
    enableApiKeys: boolean;
    enableWebhooks: boolean;
    enablePublicForms: boolean;
    enableDocumentComparison: boolean;
    enableVersionControl: boolean;
    enableBatchOperations: boolean;
    enableAuditExport: boolean;
    cacheTtlSeconds: number;
    maxUploadSizeMb: number;
    allowedFileTypes: string;
    enableDebugMode: boolean;
    enablePerformanceMetrics: boolean;
    logLevel: string;
    backupEnabled: boolean;
    backupFrequencyHours: number;
    backupRetentionDays: number;
  };
  system: {
    databaseSize: string;
    storageUsed: string;
    uptime: string;
    nodeVersion: string;
    nextVersion: string;
    prismaVersion: string;
    totalDocuments: number;
    totalUsers: number;
    totalWorkflows: number;
    activeSessions: number;
    apiCallsToday: number;
    storageTotal: string;
    lastBackup: string;
  };
}

interface SettingChange {
  category: string;
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  general: { appName: 'OpenSign', appDescription: 'Electronic Signature Platform', maintenanceMode: false, allowRegistration: true, defaultLanguage: 'en', timezone: 'UTC', dateFormat: 'MM/DD/YYYY', timeFormat: '24h', itemsPerPage: 20, sessionWarningMinutes: 5 },
  security: { passwordMinLength: 6, passwordRequireUppercase: false, passwordRequireNumbers: false, passwordRequireSymbols: false, passwordRequireMixedCase: false, sessionTimeoutMinutes: 1440, maxLoginAttempts: 5, lockoutDurationMinutes: 15, requireEmailVerification: false, enable2FA: false, ipWhitelist: '', enforceHttps: false, csrfProtection: true, rateLimitRequests: 100, rateLimitWindowMs: 60000, allowPasswordReset: true, passwordHistoryCount: 0, minPasswordAge: 0, maxPasswordAge: 90 },
  notifications: { emailEnabled: true, telegramEnabled: false, smsEnabled: false, dailyDigestEnabled: false, digestTime: '09:00', reminderIntervalDays: 3, notifyOnDocumentSent: true, notifyOnDocumentCompleted: true, notifyOnDocumentRejected: true, notifyOnDocumentExpiring: true, notifyOnMemberJoined: true, notifyOnSystemAlerts: true, quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00', notificationRetentionDays: 90 },
  branding: { logoUrl: '', faviconUrl: '', brandColor: '#10b981', darkModeEnabled: true, customCss: '', emailHeaderHtml: '', emailFooterHtml: '', loginBackground: '', companyName: '', supportEmail: '', termsUrl: '', privacyUrl: '' },
  integrations: { telegramBotToken: '', telegramBotUsername: '', webhookRetryAttempts: 3, webhookTimeoutMs: 10000, s3Endpoint: '', s3Bucket: '', s3AccessKey: '', s3SecretKey: '', s3Region: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPassword: '', smtpSecure: true, smtpFromName: '', smtpFromEmail: '', twilioSid: '', twilioAuthToken: '', twilioPhone: '', openaiApiKey: '', googleClientId: '', googleClientSecret: '' },
  compliance: { auditLogRetentionDays: 365, dataRetentionDays: 2555, enableTamperProofAudit: true, enableSigningCertificates: true, gdprModeEnabled: false, hipaaModeEnabled: false, soc2ModeEnabled: false, requireConsentOnSigning: false, dataResidency: 'us', encryptionAtRest: true, autoAnonymizeData: false, exportFormats: ['pdf', 'csv'] },
  workflows: { maxWorkflowsPerOrg: 50, maxStepsPerWorkflow: 20, allowConditionalLogic: true, allowParallelBranches: true, defaultWorkflowTimeout: 72, enableWorkflowTemplates: true, enableWorkflowVersioning: true, enableWorkflowAnalytics: true, autoArchiveCompleted: true, archiveAfterDays: 30, requireApprovalForActivation: false, enableWorkflowComments: true, enableSLATracking: false, slaWarningHours: 24, slaEscalationHours: 48 },
  advanced: { enableApiKeys: true, enableWebhooks: true, enablePublicForms: false, enableDocumentComparison: true, enableVersionControl: true, enableBatchOperations: true, enableAuditExport: true, cacheTtlSeconds: 300, maxUploadSizeMb: 50, allowedFileTypes: 'pdf,doc,docx,jpg,png', enableDebugMode: false, enablePerformanceMetrics: false, logLevel: 'info', backupEnabled: false, backupFrequencyHours: 24, backupRetentionDays: 30 },
  system: { databaseSize: '0 MB', storageUsed: '0 MB', uptime: '0s', nodeVersion: '', nextVersion: '', prismaVersion: '', totalDocuments: 0, totalUsers: 0, totalWorkflows: 0, activeSessions: 0, apiCallsToday: 0, storageTotal: '10 GB', lastBackup: 'Never' },
};

interface SettingsContextType {
  settings: SystemSettings;
  originalSettings: SystemSettings;
  loading: boolean;
  saving: boolean;
  hasChanges: boolean;
  changeHistory: SettingChange[];
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  updateSetting: <K extends keyof SystemSettings>(category: K, key: keyof SystemSettings[K], value: any) => void;
  saveSettings: () => Promise<void>;
  resetTab: (tab: SettingsTab) => void;
  resetAll: () => void;
  exportSettings: () => void;
  importSettings: (file: File) => void;
  getChangedCount: () => number;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [changeHistory, setChangeHistory] = useState<SettingChange[]>([]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          const merged = { ...DEFAULT_SETTINGS };
          for (const [cat, vals] of Object.entries(data.settings)) {
            if (cat in merged && typeof vals === 'object' && vals !== null) {
              (merged as any)[cat] = { ...(merged as any)[cat], ...vals };
            }
          }
          setSettings(merged);
          setOriginalSettings(merged);
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    const changed = getChangedCount();
    setHasChanges(changed > 0);
  }, [settings, originalSettings]);

  const updateSetting = useCallback(<K extends keyof SystemSettings>(category: K, key: keyof SystemSettings[K], value: any) => {
    setSettings(prev => {
      const old = (prev as any)[category][key as string];
      if (old !== value) {
        setChangeHistory(prev => [
          ...prev.slice(-49),
          { category: String(category), key: String(key), oldValue: old, newValue: value, timestamp: new Date() }
        ]);
      }
      return { ...prev, [category]: { ...prev[category], [key]: value } };
    });
  }, []);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
        setOriginalSettings(settings);
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const resetTab = useCallback((tab: SettingsTab) => {
    if (tab === 'overview' || tab === 'system') return;
    const cat = tab as keyof SystemSettings;
    if (cat in DEFAULT_SETTINGS) {
      setSettings(prev => ({ ...prev, [cat]: DEFAULT_SETTINGS[cat] }));
      toast.info(`Reset ${tab} settings to defaults`);
    }
  }, []);

  const resetAll = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    toast.info('All settings reset to defaults');
  }, []);

  const exportSettings = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: '1.0', exportedAt: new Date().toISOString(), settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opensign-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Settings exported');
  }, [settings]);

  const importSettings = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.settings) {
          setSettings(data.settings);
          toast.success('Settings imported — save to apply');
        } else {
          toast.error('Invalid settings file');
        }
      } catch {
        toast.error('Failed to parse settings file');
      }
    };
    reader.readAsText(file);
  }, []);

  const getChangedCount = useCallback(() => {
    let count = 0;
    for (const cat of Object.keys(settings)) {
      const catKey = cat as keyof SystemSettings;
      for (const key of Object.keys(settings[catKey])) {
        if ((settings[catKey] as any)[key] !== (originalSettings[catKey] as any)[key]) {
          count++;
        }
      }
    }
    return count;
  }, [settings, originalSettings]);

  return (
    <SettingsContext.Provider value={{
      settings, originalSettings, loading, saving, hasChanges, changeHistory,
      activeTab, setActiveTab, updateSetting, saveSettings, resetTab, resetAll,
      exportSettings, importSettings, getChangedCount,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
