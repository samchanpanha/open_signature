'use client';

import React from 'react';
import { useOrgSettings } from '../org-settings-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Mail, Eye, Loader2 } from 'lucide-react';

export function OrgEmailTemplatesTab() {
  const {
    emailTemplates, seedEmailTemplates,
    previewEmailTemplate, setPreviewEmailTemplate,
    emailPreviewHtml, emailPreviewSubject, emailPreviewLoading,
    previewEmailTemplateFn,
  } = useOrgSettings();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" /> Email Templates
          </CardTitle>
          <CardDescription>Customize the email templates sent to signers and collaborators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailTemplates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">No email templates configured</p>
              <Button variant="outline" onClick={seedEmailTemplates}>
                <Plus className="w-4 h-4 mr-2" /> Seed Default Templates
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {emailTemplates.map(et => (
                <div key={et.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{et.name}</p>
                      {et.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Subject: {et.subject}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => previewEmailTemplateFn(et)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Preview Dialog */}
      <Dialog open={!!previewEmailTemplate} onOpenChange={(v) => { if (!v) setPreviewEmailTemplate(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview: {previewEmailTemplate?.name}</DialogTitle>
          </DialogHeader>
          {emailPreviewSubject && (
            <div className="px-4 py-2 bg-muted rounded-lg text-sm">
              <span className="font-medium">Subject: </span>{emailPreviewSubject}
            </div>
          )}
          {emailPreviewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={emailPreviewHtml}
                className="w-full min-h-[400px]"
                sandbox="allow-same-origin"
                title="Email preview"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
