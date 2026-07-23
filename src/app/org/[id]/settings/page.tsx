'use client';

import React from 'react';
import { OrgSettingsProvider, useOrgSettings } from '@/components/org-settings/org-settings-provider';
import { OrgSettingsSidebar } from '@/components/org-settings/org-settings-sidebar';
import { OrgSettingsLayout } from '@/components/org-settings/org-settings-layout';
import { OrgMembersTab } from '@/components/org-settings/tabs/org-members';
import { OrgStructureTab } from '@/components/org-settings/tabs/org-structure';
import { OrgBrandingTab } from '@/components/org-settings/tabs/org-branding';
import { OrgWorkflowsTab } from '@/components/org-settings/tabs/org-workflows';
import { OrgContactsTab } from '@/components/org-settings/tabs/org-contacts';
import { OrgWebhooksTab } from '@/components/org-settings/tabs/org-webhooks';
import { OrgApiKeysTab } from '@/components/org-settings/tabs/org-api-keys';
import { OrgEmailTemplatesTab } from '@/components/org-settings/tabs/org-email-templates';
import { Skeleton } from '@/components/ui/skeleton';

function OrgSettingsContent() {
  const { activeTab, loading } = useOrgSettings();

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-64 border-r bg-card/50 p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'members': return <OrgMembersTab />;
      case 'structure': return <OrgStructureTab />;
      case 'branding': return <OrgBrandingTab />;
      case 'workflows': return <OrgWorkflowsTab />;
      case 'contacts': return <OrgContactsTab />;
      case 'webhooks': return <OrgWebhooksTab />;
      case 'api-keys': return <OrgApiKeysTab />;
      case 'email-templates': return <OrgEmailTemplatesTab />;
      default: return <OrgMembersTab />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <OrgSettingsSidebar />
      <OrgSettingsLayout>
        {renderTab()}
      </OrgSettingsLayout>
    </div>
  );
}

export default function OrgSettingsPage() {
  return (
    <OrgSettingsProvider>
      <OrgSettingsContent />
    </OrgSettingsProvider>
  );
}
