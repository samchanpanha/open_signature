'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Share2, Mail, X, Plus, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface QuickShareDialogProps {
  documentId: string;
  documentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickShareDialog({ documentId, documentTitle, open, onOpenChange }: QuickShareDialogProps) {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const addEmail = () => {
    const email = newEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Invalid email address');
      return;
    }
    if (emails.includes(email)) {
      toast.error('Email already added');
      return;
    }
    setEmails([...emails, email]);
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email));
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/sign/${documentId}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (emails.length === 0) return toast.error('Add at least one email');
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      for (const email of emails) {
        await fetch(`/api/documents/${documentId}/share-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email, message }),
        });
      }
      toast.success(`Sent to ${emails.length} recipient${emails.length !== 1 ? 's' : ''}`);
      setEmails([]);
      setMessage('');
      onOpenChange(false);
    } catch {
      toast.error('Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Document
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document info */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">{documentTitle}</p>
          </div>

          {/* Email input */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Recipients</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                className="flex-1"
              />
              <Button size="icon" onClick={addEmail}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {emails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {emails.map(email => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button onClick={() => removeEmail(email)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none h-20 bg-background"
            />
          </div>

          {/* Copy link */}
          <Button variant="outline" className="w-full" onClick={handleCopyLink}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy Signing Link'}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={emails.length === 0 || sending}>
            <Mail className="w-4 h-4 mr-1" />
            {sending ? 'Sending...' : `Send to ${emails.length || ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
