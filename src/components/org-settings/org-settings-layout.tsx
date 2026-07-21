'use client';

import React, { type ReactNode } from 'react';
import { useOrgSettings } from './org-settings-provider';
import { ScrollArea } from '@/components/ui/scroll-area';

const TAB_TITLES: Record<string, string> = {
  members: 'Members',
  branding: 'Branding',
  workflows: 'Workflows',
  contacts: 'Contacts',
  webhooks: 'Webhooks',
  'api-keys': 'API Keys',
  'email-templates': 'Email Templates',
};

export function OrgSettingsLayout({ children }: { children: ReactNode }) {
  const { activeTab, orgDetail } = useOrgSettings();

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="px-8 pt-6 pb-4 border-b bg-card/30">
        <h1 className="text-xl font-bold">{TAB_TITLES[activeTab] || activeTab}</h1>
        {orgDetail && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {orgDetail.name} &middot; Organization Settings
          </p>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-8 max-w-4xl">
          {children}
        </div>
      </ScrollArea>
    </div>
  );
}
