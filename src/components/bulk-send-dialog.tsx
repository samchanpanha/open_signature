'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CopyPlus, Plus, Trash2, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { bulkSendApi, type DocumentListItem } from '@/lib/api';

interface BulkSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: DocumentListItem[];
  onSent: () => void;
}

interface Recipient {
  email: string;
  name: string;
}

export function BulkSendDialog({ open, onOpenChange, documents, onSent }: BulkSendDialogProps) {
  const [selectedDocId, setSelectedDocId] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([{ email: '', name: '' }]);
  const [sending, setSending] = useState(false);

  const draftDocs = documents.filter(d => d.status === 'Draft');

  useEffect(() => {
    if (open) {
      setSelectedDocId('');
      setRecipients([{ email: '', name: '' }]);
    }
  }, [open]);

  const addRecipient = () => {
    setRecipients([...recipients, { email: '', name: '' }]);
  };

  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  const updateRecipient = (index: number, field: 'email' | 'name', value: string) => {
    const updated = [...recipients];
    updated[index][field] = value;
    setRecipients(updated);
  };

  const handleSend = async () => {
    if (!selectedDocId) {
      toast.error('Select a document');
      return;
    }

    const validRecipients = recipients.filter(r => r.email.trim());
    if (validRecipients.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }

    setSending(true);
    try {
      const result = await bulkSendApi.send(selectedDocId, validRecipients);
      toast.success(`Bulk sent to ${result.totalSent} recipients`);
      onSent();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Bulk send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CopyPlus className="w-5 h-5" />
            Bulk Send Documents
          </DialogTitle>
          <DialogDescription>Send a document to multiple recipients at once</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document Selection */}
          <div className="space-y-2">
            <label htmlFor="bulk-doc-select" className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Select Document
            </label>
            <Select value={selectedDocId} onValueChange={setSelectedDocId}>
              <SelectTrigger id="bulk-doc-select">
                <SelectValue placeholder="Choose a draft document" />
              </SelectTrigger>
              <SelectContent>
                {draftDocs.length === 0 ? (
                  <SelectItem value="none" disabled>No draft documents available</SelectItem>
                ) : (
                  draftDocs.map(doc => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Recipients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="bulk-recipients" className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Recipients ({recipients.filter(r => r.email.trim()).length})
              </label>
              <Button variant="outline" size="sm" onClick={addRecipient} type="button">
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            
            <div className="space-y-2 max-h-[40vh] sm:max-h-[200px] overflow-y-auto">
              {recipients.map((recipient, index) => (
                <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    placeholder="email@example.com"
                    value={recipient.email}
                    onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Name (optional)"
                    value={recipient.name}
                    onChange={(e) => updateRecipient(index, 'name', e.target.value)}
                    className="w-32"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRecipient(index)}
                    disabled={recipients.length === 1}
                    className="h-9 w-9 p-0 text-destructive"
                    aria-label="Remove recipient"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleSend} 
            disabled={sending || !selectedDocId || recipients.filter(r => r.email.trim()).length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? 'Sending...' : `Send to ${recipients.filter(r => r.email.trim()).length} recipient(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
