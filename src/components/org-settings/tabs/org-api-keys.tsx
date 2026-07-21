'use client';

import React from 'react';
import { useOrgSettings } from '../org-settings-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Key, Loader2, Copy, Check } from 'lucide-react';

export function OrgApiKeysTab() {
  const {
    apiKeys, showCreateKey, setShowCreateKey,
    newKeyName, setNewKeyName, newKeyScopes, setNewKeyScopes,
    newKeyPlain, setNewKeyPlain, createApiKey, loadApiKeys,
  } = useOrgSettings();

  const [copied, setCopied] = React.useState(false);

  const handleCopyKey = () => {
    if (newKeyPlain) {
      navigator.clipboard.writeText(newKeyPlain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" /> API Keys
          </CardTitle>
          <CardDescription>Manage API keys for programmatic access to your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setNewKeyName(''); setNewKeyScopes([]); setNewKeyPlain(null); setShowCreateKey(true); }}
          >
            <Plus className="w-4 h-4 mr-2" /> Create API Key
          </Button>

          {apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No API keys</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">Created {new Date(k.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={k.isActive ? 'default' : 'secondary'}>{k.isActive ? 'Active' : 'Revoked'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateKey} onOpenChange={(v) => { if (!v) setShowCreateKey(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Use this key in the <code>x-api-key</code> header to authenticate API requests.
            </DialogDescription>
          </DialogHeader>
          {newKeyPlain ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Copy your key now. It will not be shown again.</p>
              <div className="relative">
                <div className="p-3 bg-muted rounded-lg break-all text-xs font-mono pr-10">{newKeyPlain}</div>
                <button onClick={handleCopyKey} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-background rounded">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <Button className="w-full gradient-primary text-white" onClick={() => { setShowCreateKey(false); loadApiKeys(); }}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. CI Pipeline" />
              </div>
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="flex flex-wrap gap-2">
                  {['document:read', 'document:create', 'document:update', 'document:delete', 'template:read', 'template:create'].map((scope) => {
                    const active = newKeyScopes.includes(scope);
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => setNewKeyScopes(active ? newKeyScopes.filter((s) => s !== scope) : [...newKeyScopes, scope])}
                        className={`text-xs px-2 py-1 rounded-full border transition-colors ${active ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700' : 'text-muted-foreground hover:bg-muted'}`}
                      >
                        {scope}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                className="w-full gradient-primary text-white"
                disabled={!newKeyName.trim()}
                onClick={createApiKey}
              >
                <Plus className="w-4 h-4 mr-2" /> Generate Key
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
