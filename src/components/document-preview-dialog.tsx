'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Send, Eye, Users, FileText, Clock, Mail, CheckCircle2 } from 'lucide-react';

interface PreviewSigner {
  name: string;
  email: string;
  role: string;
  order: number;
}

interface PreviewField {
  type: string;
  label?: string;
  pageNumber: number;
  signerName?: string;
  required?: boolean;
}

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  signers: PreviewSigner[];
  fields: PreviewField[];
  expiresInDays?: number;
  onConfirm: () => void;
  sending?: boolean;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  title,
  signers,
  fields,
  expiresInDays,
  onConfirm,
  sending,
}: DocumentPreviewDialogProps) {
  const fieldsBySigner = fields.reduce((acc, f) => {
    const key = f.signerName || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {} as Record<string, PreviewField[]>);

  const totalPages = [...new Set(fields.map(f => f.pageNumber))].length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Preview Before Sending
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Document Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">
                {fields.length} field{fields.length !== 1 ? 's' : ''} across {totalPages} page{totalPages !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Signers */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Recipients ({signers.length})
            </h4>
            <div className="space-y-2">
              {signers.map((signer, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-700">
                    {signer.name?.charAt(0)?.toUpperCase() || signer.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{signer.name || 'Unnamed'}</p>
                    <p className="text-xs text-muted-foreground truncate">{signer.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{signer.role}</Badge>
                    <Badge variant="secondary" className="text-xs">#{signer.order}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Fields by Signer */}
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Fields
            </h4>
            <div className="space-y-3">
              {Object.entries(fieldsBySigner).map(([signerName, signerFields]) => (
                <div key={signerName}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{signerName}</p>
                  <div className="flex flex-wrap gap-1">
                    {signerFields.map((f, i) => (
                      <Badge key={i} variant={f.required ? 'default' : 'secondary'} className="text-xs">
                        {f.type}{f.label ? `: ${f.label}` : ''} (p{f.pageNumber})
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          {(expiresInDays || true) && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {expiresInDays ? `Expires in ${expiresInDays} days` : 'No expiration set'}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                Email notifications will be sent to all recipients
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={sending} className="gradient-primary text-white">
            {sending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send Document
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
