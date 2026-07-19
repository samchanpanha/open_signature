'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Share2, Trash2, UserPlus, Shield, Eye, Edit, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { templatePermissionsApi, type DocumentPermission, type OrgMemberForDoc } from '@/lib/api';

interface ShareTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
}

const ACTION_OPTIONS = [
  { value: 'read', label: 'View', icon: <Eye className="w-3 h-3" /> },
  { value: 'edit', label: 'Edit', icon: <Edit className="w-3 h-3" /> },
  { value: 'manage', label: 'Manage', icon: <Shield className="w-3 h-3" /> },
];

export function ShareTemplateDialog({ open, onOpenChange, templateId, templateName }: ShareTemplateDialogProps) {
  const [permissions, setPermissions] = useState<DocumentPermission[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberForDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedAction, setSelectedAction] = useState('read');
  const [adding, setAdding] = useState(false);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await templatePermissionsApi.get(templateId);
      setPermissions(data.permissions);
      setOrgMembers(data.orgMembers);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadPermissions();
      setSelectedMember('');
      setSelectedAction('read');
    }
  }, [open, templateId]);

  const handleAdd = async () => {
    if (!selectedMember) { toast.error('Select a member'); return; }
    setAdding(true);
    try {
      await templatePermissionsApi.add(templateId, selectedMember, selectedAction);
      toast.success('Permission added');
      setSelectedMember('');
      loadPermissions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add permission');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string, action: string) => {
    try {
      await templatePermissionsApi.remove(templateId, userId, action);
      toast.success('Permission removed');
      loadPermissions();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove permission');
    }
  };

  const availableMembers = orgMembers.filter(
    m => !permissions.some(p => p.userId === m.userId && p.action === selectedAction)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Template
          </DialogTitle>
          <DialogDescription>Manage access for &quot;{templateName}&quot;</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* People with Access */}
          <div className="space-y-2">
            <label className="text-sm font-medium">People with Access ({permissions.length})</label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No explicit permissions set. Only owner has access.</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {permissions.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                        {p.userName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <span className="text-sm">{p.userName}</span>
                        <span className="text-xs text-muted-foreground ml-1">({p.userEmail})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {ACTION_OPTIONS.find(a => a.value === p.action)?.label || p.action}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(p.userId, p.action)} className="h-6 w-6 p-0 text-destructive" aria-label="Remove permission">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Permission */}
          {orgMembers.length > 0 && (
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">Grant Specific Access</label>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select value={selectedMember} onValueChange={setSelectedMember}>
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>
                      {availableMembers.length === 0 ? (
                        <SelectItem value="none" disabled>No available members</SelectItem>
                      ) : (
                        availableMembers.map(m => (
                          <SelectItem key={m.userId} value={m.userId}>{m.name} ({m.email})</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Select value={selectedAction} onValueChange={setSelectedAction}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={adding || !selectedMember} size="sm">
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {orgMembers.length === 0 && (
            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">Share this template with organization members by joining an organization first.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
