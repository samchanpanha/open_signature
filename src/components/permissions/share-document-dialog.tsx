'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Share2, Trash2, UserPlus, Shield, Eye, Edit, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { documentPermissionsApi, type DocumentPermission, type OrgMemberForDoc, type DocAccessEntry } from '@/lib/api';

interface ShareDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle: string;
}

const ACTION_OPTIONS = [
  { value: 'read', label: 'View', icon: <Eye className="w-3 h-3" /> },
  { value: 'edit', label: 'Edit', icon: <Edit className="w-3 h-3" /> },
  { value: 'sign', label: 'Sign', icon: <CheckCircle className="w-3 h-3" /> },
  { value: 'manage', label: 'Manage', icon: <Shield className="w-3 h-3" /> },
];

const ROLE_ACCESS: Record<string, string> = {
  owner: 'Full Access',
  admin: 'Full Access',
  editor: 'Create & Edit',
  signer: 'View & Sign',
  viewer: 'View Only',
  member: 'Basic Access',
};

export function ShareDocumentDialog({ open, onOpenChange, documentId, documentTitle }: ShareDocumentDialogProps) {
  const [permissions, setPermissions] = useState<DocumentPermission[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberForDoc[]>([]);
  const [allAccess, setAllAccess] = useState<DocAccessEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedAction, setSelectedAction] = useState('read');
  const [adding, setAdding] = useState(false);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await documentPermissionsApi.get(documentId);
      setPermissions(data.permissions);
      setOrgMembers(data.orgMembers);
      setAllAccess(data.allAccess || []);
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
  }, [open, documentId]);

  const handleAdd = async () => {
    if (!selectedMember) { toast.error('Select a member'); return; }
    setAdding(true);
    try {
      await documentPermissionsApi.add(documentId, selectedMember, selectedAction);
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
      await documentPermissionsApi.remove(documentId, userId, action);
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
            Share Document
          </DialogTitle>
          <DialogDescription>Manage access for &quot;{documentTitle}&quot;</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* All Users with Access */}
          <div className="space-y-2">
            <label className="text-sm font-medium">People with Access ({allAccess.length})</label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : allAccess.length === 0 ? (
              <p className="text-sm text-muted-foreground">No access information available</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {allAccess.map(entry => (
                  <div key={entry.userId} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                        {entry.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div>
                        <span className="text-sm">{entry.name}</span>
                        <span className="text-xs text-muted-foreground ml-1">({entry.email})</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${
                      entry.accessType === 'owner' ? 'bg-purple-50 text-purple-700' :
                      entry.accessType === 'shared' ? 'bg-blue-50 text-blue-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {entry.accessType === 'shared' ? `Shared · ${entry.role}` : ROLE_ACCESS[entry.role] || entry.role}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Permission */}
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

          {/* Explicit Permissions */}
          {permissions.length > 0 && (
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">Explicit Permissions</label>
              <div className="space-y-1">
                {permissions.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{p.userName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {ACTION_OPTIONS.find(a => a.value === p.action)?.label || p.action}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(p.userId, p.action)} className="h-6 w-6 p-0 text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
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
