'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Webhook, Plus, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookItem {
  id: string;
  url: string;
  events: string;
  isActive: boolean;
  createdAt: string;
}

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState('document.completed,document.sent');
  const [showSecret, setShowSecret] = useState<string | null>(null);

  useEffect(() => { loadWebhooks(); }, []);

  const loadWebhooks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/webhooks', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch {}
  };

  const handleAdd = async () => {
    if (!newUrl) return toast.error('URL is required');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: newUrl, events: newEvents }),
      });
      if (res.ok) {
        toast.success('Webhook created');
        setShowAdd(false);
        setNewUrl('');
        loadWebhooks();
      }
    } catch {
      toast.error('Failed to create webhook');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/webhooks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ webhookId: id }),
      });
      toast.success('Webhook deleted');
      loadWebhooks();
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Webhook className="w-4 h-4" /> Webhooks
            <Badge variant="secondary" className="text-xs">{webhooks.length}</Badge>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No webhooks configured</p>
        ) : (
          <div className="space-y-2">
            {webhooks.map(w => (
              <div key={w.id} className="flex items-center gap-3 p-2 rounded-lg border">
                <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate">{w.url}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {(() => {
                      try {
                        const parsed = typeof w.events === 'string' ? JSON.parse(w.events) : w.events;
                        return (Array.isArray(parsed) ? parsed : String(w.events).split(',')).map((e: string) => (
                          <Badge key={e} variant="secondary" className="text-[10px]">{e.trim()}</Badge>
                        ));
                      } catch {
                        return String(w.events).split(',').map((e: string) => (
                          <Badge key={e} variant="secondary" className="text-[10px]">{e.trim()}</Badge>
                        ));
                      }
                    })()}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(w.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add Webhook</DialogTitle></DialogHeader>
            <input
              type="url"
              placeholder="https://example.com/webhook"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Events (comma-separated)</label>
              <input
                type="text"
                value={newEvents}
                onChange={(e) => setNewEvents(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Available: document.completed, document.sent, document.created, document.expired
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAdd}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
