'use client';

import React from 'react';
import { useSettings } from '../settings-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export function SettingsWorkflows() {
  const { settings, updateSetting } = useSettings();
  const s = settings.workflows;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Engine Configuration</CardTitle>
          <CardDescription>Limits and timeout settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Workflows Per Org</label>
              <Input type="number" min={1} max={500} value={s.maxWorkflowsPerOrg} onChange={e => updateSetting('workflows', 'maxWorkflowsPerOrg', Math.max(1, Math.min(500, parseInt(e.target.value) || 50)))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Steps Per Workflow</label>
              <Input type="number" min={2} max={100} value={s.maxStepsPerWorkflow} onChange={e => updateSetting('workflows', 'maxStepsPerWorkflow', Math.max(2, Math.min(100, parseInt(e.target.value) || 20)))} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Default Timeout (hours)</label>
            <Input type="number" min={1} max={720} value={s.defaultWorkflowTimeout} onChange={e => updateSetting('workflows', 'defaultWorkflowTimeout', Math.max(1, Math.min(720, parseInt(e.target.value) || 72)))} />
            <p className="text-xs text-muted-foreground">Auto-expire workflow if not completed within this time</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Feature Flags</CardTitle>
          <CardDescription>Enable or disable workflow features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'allowConditionalLogic' as const, label: 'Conditional Logic', desc: 'Allow if/else branching in workflows' },
            { key: 'allowParallelBranches' as const, label: 'Parallel Branches', desc: 'Allow simultaneous execution paths' },
            { key: 'enableWorkflowTemplates' as const, label: 'Workflow Templates', desc: 'Allow creating workflows from templates' },
            { key: 'enableWorkflowVersioning' as const, label: 'Version History', desc: 'Track workflow changes over time' },
            { key: 'enableWorkflowAnalytics' as const, label: 'Analytics', desc: 'Track workflow performance metrics' },
            { key: 'enableWorkflowComments' as const, label: 'Comments', desc: 'Allow comments on workflow steps' },
            { key: 'requireApprovalForActivation' as const, label: 'Activation Approval', desc: 'Require admin approval to activate workflows' },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={s[item.key]} onCheckedChange={v => updateSetting('workflows', item.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SLA Tracking</CardTitle>
          <CardDescription>Monitor and alert on workflow SLA violations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Enable SLA Tracking</p>
              <p className="text-xs text-muted-foreground">Track response times against SLA targets</p>
            </div>
            <Switch checked={s.enableSLATracking} onCheckedChange={v => updateSetting('workflows', 'enableSLATracking', v)} />
          </div>
          {s.enableSLATracking && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Warning Threshold (hours)</label>
                <Input type="number" min={1} value={s.slaWarningHours} onChange={e => updateSetting('workflows', 'slaWarningHours', Math.max(1, parseInt(e.target.value) || 24))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Escalation Threshold (hours)</label>
                <Input type="number" min={1} value={s.slaEscalationHours} onChange={e => updateSetting('workflows', 'slaEscalationHours', Math.max(1, parseInt(e.target.value) || 48))} />
              </div>
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium">Auto-Archive Completed</p>
              <p className="text-xs text-muted-foreground">Automatically archive completed workflows</p>
            </div>
            <Switch checked={s.autoArchiveCompleted} onCheckedChange={v => updateSetting('workflows', 'autoArchiveCompleted', v)} />
          </div>
          {s.autoArchiveCompleted && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Archive After (days)</label>
              <Input type="number" min={1} max={365} value={s.archiveAfterDays} onChange={e => updateSetting('workflows', 'archiveAfterDays', Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
