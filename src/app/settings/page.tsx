'use client';

import React from 'react';
import { SettingsProvider, useSettings } from '@/components/settings/settings-provider';
import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { SettingsOverview } from '@/components/settings/tabs/settings-overview';
import { SettingsGeneral } from '@/components/settings/tabs/settings-general';
import { SettingsSecurity } from '@/components/settings/tabs/settings-security';
import { SettingsNotifications } from '@/components/settings/tabs/settings-notifications';
import { SettingsBranding } from '@/components/settings/tabs/settings-branding';
import { SettingsIntegrations } from '@/components/settings/tabs/settings-integrations';
import { SettingsTeam } from '@/components/settings/tabs/settings-team';
import { SettingsWorkflows } from '@/components/settings/tabs/settings-workflows';
import { SettingsCompliance } from '@/components/settings/tabs/settings-compliance';
import { SettingsSystem } from '@/components/settings/tabs/settings-system';
import { SettingsAdvanced } from '@/components/settings/tabs/settings-advanced';
import { Skeleton } from '@/components/ui/skeleton';

function SettingsContent() {
  const { activeTab, loading } = useSettings();

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-60 border-r bg-card/50 p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-2/3" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <SettingsOverview />;
      case 'general': return <SettingsGeneral />;
      case 'security': return <SettingsSecurity />;
      case 'notifications': return <SettingsNotifications />;
      case 'branding': return <SettingsBranding />;
      case 'integrations': return <SettingsIntegrations />;
      case 'team': return <SettingsTeam />;
      case 'workflows': return <SettingsWorkflows />;
      case 'compliance': return <SettingsCompliance />;
      case 'system': return <SettingsSystem />;
      case 'advanced': return <SettingsAdvanced />;
      default: return <SettingsOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <SettingsSidebar />
      <SettingsLayout>
        {renderTab()}
      </SettingsLayout>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  );
}
