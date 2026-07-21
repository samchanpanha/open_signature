'use client';

import React from 'react';
import { useOrgSettings } from '../org-settings-provider';
import { WebhookManager } from '@/components/webhook-manager';
import { Badge } from '@/components/ui/badge';

export function OrgWebhooksTab() {
  const { webhooks } = useOrgSettings();

  return (
    <div className="space-y-6">
      <WebhookManager />

      {webhooks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Configured Webhooks</h3>
          {webhooks.map(wh => (
            <div key={wh.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{wh.url}</p>
                <p className="text-xs text-muted-foreground">{JSON.parse(wh.events).join(', ')}</p>
              </div>
              <Badge variant={wh.isActive ? 'default' : 'secondary'}>{wh.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>
          ))}
        </div>
      )}

      {webhooks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">No webhooks configured</p>
      )}
    </div>
  );
}
