'use client';

import React, { useState } from 'react';
import { useSettings, type SettingsTab } from './settings-provider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Settings, Shield, Bell, Palette, Puzzle, Users,
  Workflow, Lock, Server, Cog, ChevronRight, PanelLeftClose, PanelLeftOpen,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface NavItem {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  description: string;
  group: 'main' | 'management' | 'system';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" />, description: 'Dashboard & stats', group: 'main' },
  { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" />, description: 'App, locale, display', group: 'main' },
  { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" />, description: 'Auth, passwords, 2FA', group: 'main' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, description: 'Channels, alerts', group: 'main' },
  { id: 'branding', label: 'Branding', icon: <Palette className="w-4 h-4" />, description: 'Logo, colors, themes', group: 'main' },
  { id: 'integrations', label: 'Integrations', icon: <Puzzle className="w-4 h-4" />, description: 'SMTP, S3, APIs', group: 'management' },
  { id: 'team', label: 'Team & Roles', icon: <Users className="w-4 h-4" />, description: 'Members, permissions', group: 'management' },
  { id: 'workflows', label: 'Workflows', icon: <Workflow className="w-4 h-4" />, description: 'Engine, templates, SLA', group: 'management' },
  { id: 'compliance', label: 'Compliance', icon: <Lock className="w-4 h-4" />, description: 'Audit, GDPR, HIPAA', group: 'management' },
  { id: 'system', label: 'System', icon: <Server className="w-4 h-4" />, description: 'Health, storage, runtime', group: 'system' },
  { id: 'advanced', label: 'Advanced', icon: <Cog className="w-4 h-4" />, description: 'API, caching, debug', group: 'system' },
];

const GROUPS = [
  { id: 'main' as const, label: 'Core Settings' },
  { id: 'management' as const, label: 'Management' },
  { id: 'system' as const, label: 'System & Advanced' },
];

export function SettingsSidebar() {
  const { activeTab, setActiveTab, hasChanges } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ main: true, management: true, system: true });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  return (
    <nav className={`flex-shrink-0 border-r bg-card/50 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b">
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm">Settings</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        {GROUPS.map((group, gi) => {
          const items = NAV_ITEMS.filter(i => i.group === group.id);
          const isExpanded = expandedGroups[group.id];

          return (
            <div key={group.id}>
              {gi > 0 && <Separator className="my-2 mx-3" />}
              {!collapsed && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                >
                  {group.label}
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
              {(isExpanded || collapsed) && items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 mx-1 rounded-lg text-sm font-medium transition-all ${
                    activeTab === item.id
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-l-2 border-emerald-500'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </ScrollArea>

      {/* Footer */}
      {!collapsed && hasChanges && (
        <div className="p-3 border-t">
          <Badge variant="outline" className="w-full justify-center text-xs py-1">
            Unsaved changes
          </Badge>
        </div>
      )}
    </nav>
  );
}
