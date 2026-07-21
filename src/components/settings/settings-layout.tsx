'use client';

import React from 'react';
import { useSettings, type SettingsTab } from './settings-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Download, Upload, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TAB_INFO: Record<SettingsTab, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'Platform health and configuration summary' },
  general: { title: 'General', description: 'Application name, locale, and display preferences' },
  security: { title: 'Security', description: 'Authentication, passwords, and access controls' },
  notifications: { title: 'Notifications', description: 'Email, Telegram, and alert preferences' },
  branding: { title: 'Branding', description: 'Logo, colors, and visual customization' },
  integrations: { title: 'Integrations', description: 'SMTP, S3, Telegram, and third-party APIs' },
  team: { title: 'Team & Roles', description: 'Member management and role permissions' },
  workflows: { title: 'Workflows', description: 'Engine configuration, templates, and SLA tracking' },
  compliance: { title: 'Compliance', description: 'Audit logs, GDPR, HIPAA, and data retention' },
  system: { title: 'System', description: 'Health status, storage, and runtime information' },
  advanced: { title: 'Advanced', description: 'API keys, caching, debug mode, and backups' },
};

interface SettingsLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
}

export function SettingsLayout({ children, header }: SettingsLayoutProps) {
  const { activeTab, saving, hasChanges, saveSettings, exportSettings, resetTab, getChangedCount } = useSettings();
  const info = TAB_INFO[activeTab];
  const changedCount = getChangedCount();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Bar */}
      <header className="h-14 flex items-center justify-between px-6 border-b bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Settings</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{info.title}</span>
          </div>
          {hasChanges && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {changedCount} unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={exportSettings}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const data = JSON.parse(ev.target?.result as string);
                    if (data.settings) {
                      // Import is handled by provider
                      const event = new CustomEvent('settings-import', { detail: data.settings });
                      window.dispatchEvent(event);
                    }
                  } catch {}
                };
                reader.readAsText(file);
              }
            };
            input.click();
          }}>
            <Upload className="w-3.5 h-3.5" /> Import
          </Button>
          {activeTab !== 'overview' && activeTab !== 'system' && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => resetTab(activeTab)}>
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
          <Button
            size="sm"
            className="gradient-primary text-white gap-1.5"
            onClick={saveSettings}
            disabled={saving || !hasChanges}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Page Title */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="text-2xl font-bold">{info.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">{info.description}</p>
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Header slot for extra content */}
      {header}
    </div>
  );
}
