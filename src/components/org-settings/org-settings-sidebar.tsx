'use client';

import React from 'react';
import Link from 'next/link';
import { useOrgSettings } from './org-settings-provider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Users, Palette, Workflow, Contact as ContactIcon, Send, Key, Mail,
  ArrowLeft, Building2, ChevronRight, GitBranch,
} from 'lucide-react';

type OrgTab = 'members' | 'structure' | 'branding' | 'workflows' | 'contacts' | 'webhooks' | 'api-keys' | 'email-templates';

const NAV_ITEMS: { id: OrgTab; label: string; icon: React.ElementType; group: string }[] = [
  { id: 'members', label: 'Members', icon: Users, group: 'Management' },
  { id: 'structure', label: 'Structure', icon: GitBranch, group: 'Management' },
  { id: 'branding', label: 'Branding', icon: Palette, group: 'Management' },
  { id: 'workflows', label: 'Workflows', icon: Workflow, group: 'Management' },
  { id: 'contacts', label: 'Contacts', icon: ContactIcon, group: 'Management' },
  { id: 'webhooks', label: 'Webhooks', icon: Send, group: 'Integrations' },
  { id: 'api-keys', label: 'API Keys', icon: Key, group: 'Integrations' },
  { id: 'email-templates', label: 'Email Templates', icon: Mail, group: 'Integrations' },
];

export function OrgSettingsSidebar() {
  const { orgId, activeTab, setActiveTab, orgDetail } = useOrgSettings();

  const groups = [...new Set(NAV_ITEMS.map(i => i.group))];

  return (
    <div className="w-64 border-r bg-card/50 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to App
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-sm truncate">{orgDetail?.name || 'Organization'}</h2>
            <p className="text-xs text-muted-foreground">Settings</p>
          </div>
        </div>
        {orgDetail && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{orgDetail.members.length} members</Badge>
            <Badge variant="secondary">{orgDetail.documentCount} docs</Badge>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-3 space-y-4">
          {groups.map(group => (
            <div key={group}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1.5">{group}</p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter(i => i.group === group).map(item => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {active && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}
