'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus, Trash2, Clock, Mail, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Reminder {
  id: string;
  email: string;
  name?: string;
  intervalDays: number;
  lastSentAt?: string;
  nextSendAt: string;
  enabled: boolean;
}

interface DocumentRemindersProps {
  documentId: string;
  documentTitle: string;
}

export function DocumentReminders({ documentId, documentTitle }: DocumentRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [intervalDays, setIntervalDays] = useState(3);

  useEffect(() => {
    loadReminders();
  }, [documentId]);

  const loadReminders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/documents/${documentId}/reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReminders(data.reminders || []);
    } catch {}
  };

  const handleAdd = async () => {
    if (!newEmail) return toast.error('Email is required');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/documents/${documentId}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, name: newName, intervalDays }),
      });
      if (res.ok) {
        toast.success('Reminder added');
        setShowAdd(false);
        setNewEmail('');
        setNewName('');
        setIntervalDays(3);
        loadReminders();
      }
    } catch {
      toast.error('Failed to add reminder');
    }
  };

  const handleDelete = async (reminderId: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/documents/${documentId}/reminders`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reminderId }),
      });
      toast.success('Reminder removed');
      loadReminders();
    } catch {
      toast.error('Failed to remove reminder');
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-8 gap-1">
        <Bell className="w-3.5 h-3.5" />
        {reminders.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">{reminders.length}</Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Reminders
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {reminders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No reminders set</p>
              </div>
            ) : (
              reminders.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.name || r.email}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">Every {r.intervalDays}d</Badge>
                      {r.lastSentAt && (
                        <span className="text-[10px] text-muted-foreground">
                          Last: {new Date(r.lastSentAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {showAdd ? (
            <div className="border rounded-lg p-3 space-y-3 mt-2">
              <input
                type="email"
                placeholder="Email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Remind every</label>
                <select
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(Number(e.target.value))}
                  className="px-2 py-1 border rounded text-sm"
                >
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={5}>5 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" onClick={handleAdd}>Add</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full mt-2" onClick={() => setShowAdd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Reminder
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
