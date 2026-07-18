'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, MoreVertical, Shield, Users, Trash2, Edit, Copy, Eye, Mail, Clock, CheckCircle, XCircle, AlertCircle, Activity, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { orgApi, permissionsApi, activityApi, documentsApi, userPermissionsApi, expiringPermissionsApi, permissionExtensionApi, orgPermissionsApi, documentPermissionsApi, templatePermissionsApi, permissionTemplatesApi, type OrgMember, type ActivityLogEntry, type UserDocumentPermission, type UserTemplatePermission, type ExpiringPermission, type OrgPermission, type PermissionHistoryEntry, type PermissionTemplate } from '@/lib/api';

const ROLE_CONFIG: Record<string, { label: string; color: string; description: string; icon: React.ReactNode }> = {
  owner: { label: 'Owner', color: 'bg-purple-100 text-purple-800 border-purple-200', description: 'Full control', icon: <Shield className="w-3 h-3" /> },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-800 border-blue-200', description: 'Manage members & resources', icon: <Shield className="w-3 h-3" /> },
  editor: { label: 'Editor', color: 'bg-green-100 text-green-800 border-green-200', description: 'Create & edit documents', icon: <Edit className="w-3 h-3" /> },
  signer: { label: 'Signer', color: 'bg-orange-100 text-orange-800 border-orange-200', description: 'View & sign documents', icon: <CheckCircle className="w-3 h-3" /> },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-800 border-gray-200', description: 'Read-only access', icon: <Eye className="w-3 h-3" /> },
  member: { label: 'Member', color: 'bg-slate-100 text-slate-800 border-slate-200', description: 'Basic member', icon: <Users className="w-3 h-3" /> },
};

const MANAGEABLE_ROLES = ['admin', 'editor', 'signer', 'viewer', 'member'];

interface TeamMemberManagerProps {
  orgId: string;
  currentUserId: string;
  currentUserRole: string;
}

export function TeamMemberManager({ orgId, currentUserId, currentUserRole }: TeamMemberManagerProps) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OrgMember | null>(null);
  const [showTempPassword, setShowTempPassword] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('members');
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityTotal, setActivityTotal] = useState(0);

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [invitePassword, setInvitePassword] = useState('');
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [editRole, setEditRole] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [memberDocsDialogOpen, setMemberDocsDialogOpen] = useState(false);
  const [memberDocs, setMemberDocs] = useState<{ id: string; title: string; status: string }[]>([]);
  const [memberDocsLoading, setMemberDocsLoading] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [userDocPerms, setUserDocPerms] = useState<UserDocumentPermission[]>([]);
  const [userTemplatePerms, setUserTemplatePerms] = useState<UserTemplatePermission[]>([]);
  const [userPermsLoading, setUserPermsLoading] = useState(false);
  const [expiringPerms, setExpiringPerms] = useState<ExpiringPermission[]>([]);
  const [expiringPermsLoading, setExpiringPermsLoading] = useState(false);
  const [orgPerms, setOrgPerms] = useState<OrgPermission[]>([]);
  const [orgPermsLoading, setOrgPermsLoading] = useState(false);
  const [permHistory, setPermHistory] = useState<PermissionHistoryEntry[]>([]);
  const [permHistoryLoading, setPermHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [permTemplates, setPermTemplates] = useState<PermissionTemplate[]>([]);
  const [permTemplatesLoading, setPermTemplatesLoading] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templatePermissions, setTemplatePermissions] = useState<Array<{ resource: string; action: string }>>([]);
  const [newPermResource, setNewPermResource] = useState('document');
  const [newPermAction, setNewPermAction] = useState('read');
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [applyTemplateId, setApplyTemplateId] = useState<string | null>(null);
  const [applyTemplateMemberId, setApplyTemplateMemberId] = useState('');

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';
  const pendingMembers = members.filter(m => m.inviteStatus === 'pending');

  const loadMembers = async () => {
    try {
      const data = await orgApi.listMembers(orgId);
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    setActivityLoading(true);
    try {
      const data = await activityApi.get(orgId, 50);
      setActivities(data.activities);
      setActivityTotal(data.totalCount);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const loadExpiringPermissions = async () => {
    setExpiringPermsLoading(true);
    try {
      const data = await expiringPermissionsApi.get(30, orgId);
      setExpiringPerms(data.permissions);
    } catch (error) {
      console.error('Failed to load expiring permissions:', error);
    } finally {
      setExpiringPermsLoading(false);
    }
  };

  const loadOrgPermissions = async () => {
    setOrgPermsLoading(true);
    try {
      const data = await orgPermissionsApi.get(orgId);
      setOrgPerms(data.permissions);
    } catch (error) {
      console.error('Failed to load org permissions:', error);
    } finally {
      setOrgPermsLoading(false);
    }
  };

  const loadPermHistory = async () => {
    setPermHistoryLoading(true);
    try {
      const data = await orgPermissionsApi.history(orgId, 50);
      setPermHistory(data.history);
    } catch (error) {
      console.error('Failed to load permission history:', error);
    } finally {
      setPermHistoryLoading(false);
    }
  };

  const loadPermTemplates = async () => {
    setPermTemplatesLoading(true);
    try {
      const data = await permissionTemplatesApi.list(orgId);
      setPermTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load permission templates:', error);
    } finally {
      setPermTemplatesLoading(false);
    }
  };

  useEffect(() => { loadMembers(); }, [orgId]);
  useEffect(() => { if (activeTab === 'activity') loadActivities(); }, [activeTab, orgId]);
  useEffect(() => { if (activeTab === 'expiring') loadExpiringPermissions(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'all-perms') loadOrgPermissions(); }, [activeTab]);
  useEffect(() => { if (showHistory) loadPermHistory(); }, [showHistory]);
  useEffect(() => { if (activeTab === 'templates') loadPermTemplates(); }, [activeTab]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error('Email is required'); return; }
    setInviteLoading(true);
    try {
      const result = await orgApi.inviteMember(orgId, inviteEmail.trim(), inviteRole, inviteName.trim() || undefined, useCustomPassword ? invitePassword : undefined);
      try { await orgApi.sendInviteNotification(orgId, result.id); } catch {}
      if (result.tempPassword) {
        setShowTempPassword(result.tempPassword);
        toast.success(`Member invited! Temp password: ${result.tempPassword}`);
      } else {
        toast.success('Member invited successfully');
      }
      setInviteName(''); setInviteEmail(''); setInviteRole('member'); setInvitePassword(''); setUseCustomPassword(false); setInviteDialogOpen(false);
      loadMembers();
    } catch (error: any) { toast.error(error.message || 'Failed to invite member'); }
    finally { setInviteLoading(false); }
  };

  const handleEditMember = async () => {
    if (!selectedMember) return;
    setEditLoading(true);
    try {
      await permissionsApi.applyRole(selectedMember.user.id, orgId, editRole);
      if (editActive !== selectedMember.isActive) { await orgApi.updateMember(orgId, selectedMember.id, { isActive: editActive }); }
      toast.success('Member updated successfully');
      setEditDialogOpen(false); setSelectedMember(null);
      loadMembers();
    } catch (error: any) { toast.error(error.message || 'Failed to update member'); }
    finally { setEditLoading(false); }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try { await orgApi.removeMember(orgId, memberId); toast.success('Member removed'); loadMembers(); }
    catch (error: any) { toast.error(error.message || 'Failed to remove member'); }
  };

  const openEditDialog = (member: OrgMember) => {
    setSelectedMember(member); setEditRole(member.role); setEditActive(member.isActive); setEditDialogOpen(true);
  };

  const openMemberDocs = async (member: OrgMember) => {
    setSelectedMember(member);
    setMemberDocsDialogOpen(true);
    setMemberDocsLoading(true);
    try {
      const docs = await documentsApi.list({ orgId });
      setMemberDocs(docs.map(d => ({ id: d.id, title: d.title, status: d.status })));
    } catch {
      setMemberDocs([]);
    } finally {
      setMemberDocsLoading(false);
    }
  };

  const openPermissionsOverview = async (member: OrgMember) => {
    setSelectedMember(member);
    setPermissionsDialogOpen(true);
    setUserPermsLoading(true);
    try {
      const data = await userPermissionsApi.get(member.user.id);
      setUserDocPerms(data.documentPermissions);
      setUserTemplatePerms(data.templatePermissions);
    } catch {
      setUserDocPerms([]);
      setUserTemplatePerms([]);
    } finally {
      setUserPermsLoading(false);
    }
  };

  const getStatusBadge = (member: OrgMember) => {
    if (member.inviteStatus === 'pending') return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    if (!member.isActive) return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>;
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
  };

  if (loading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading team members...</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="members"><Users className="w-4 h-4 mr-1" /> All ({members.length})</TabsTrigger>
          <TabsTrigger value="pending"><Clock className="w-4 h-4 mr-1" /> Pending ({pendingMembers.length})</TabsTrigger>
          <TabsTrigger value="roles"><Shield className="w-4 h-4 mr-1" /> Roles</TabsTrigger>
          <TabsTrigger value="all-perms"><Eye className="w-4 h-4 mr-1" /> Permissions</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="w-4 h-4 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="expiring"><AlertCircle className="w-4 h-4 mr-1" /> Expiring</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="w-4 h-4 mr-1" /> Activity</TabsTrigger>
        </TabsList>

        {/* All Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Team Members</CardTitle>
                <CardDescription>Manage your organization members, roles, and permissions</CardDescription>
              </div>
              {canManage && (
                <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><UserPlus className="w-4 h-4 mr-2" /> Add Member</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Team Member</DialogTitle>
                      <DialogDescription>Invite a new member or create an account for them.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="invite-name">Name</Label>
                        <Input id="invite-name" placeholder="John Doe" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="invite-email">Email *</Label>
                        <Input id="invite-email" type="email" placeholder="john@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MANAGEABLE_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                <div className="flex items-center gap-2">{ROLE_CONFIG[role].icon} <span>{ROLE_CONFIG[role].label}</span> <span className="text-muted-foreground text-xs">- {ROLE_CONFIG[role].description}</span></div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="invite-password">Custom Password</Label>
                          <Switch checked={useCustomPassword} onCheckedChange={setUseCustomPassword} />
                        </div>
                        {useCustomPassword && <Input id="invite-password" type="password" placeholder="Min 6 characters" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} />}
                        {!useCustomPassword && <p className="text-xs text-muted-foreground">A random password will be generated. You can share it with the member.</p>}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleInvite} disabled={inviteLoading}>{inviteLoading ? 'Inviting...' : 'Add Member'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No team members yet</p>
                  <p className="text-sm">Add members to start collaborating</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{member.user.name}</span>
                              <Badge variant="outline" className={`text-[10px] ${ROLE_CONFIG[member.role]?.color}`}>
                                {ROLE_CONFIG[member.role]?.icon}
                                <span className="ml-1">{ROLE_CONFIG[member.role]?.label}</span>
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">{member.user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ROLE_CONFIG[member.role]?.color}>
                            {ROLE_CONFIG[member.role]?.icon}
                            <span className="ml-1">{ROLE_CONFIG[member.role]?.label || member.role}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(member)}</TableCell>
                        <TableCell>
                          {member.inviter ? <span className="text-sm">{member.inviter.name}</span> : <span className="text-sm text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {member.lastLoginAt ? <span className="text-sm">{new Date(member.lastLoginAt).toLocaleDateString()}</span> : <span className="text-sm text-muted-foreground">Never</span>}
                        </TableCell>
                        <TableCell>
                          {member.role !== 'owner' && canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                  <Edit className="w-4 h-4 mr-2" /> Edit Role & Access
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openMemberDocs(member)}>
                                  <FileText className="w-4 h-4 mr-2" /> View Documents
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openPermissionsOverview(member)}>
                                  <Shield className="w-4 h-4 mr-2" /> All Permissions
                                </DropdownMenuItem>
                                {member.inviteStatus === 'pending' && (
                                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(member.user.email); toast.success('Email copied'); }}>
                                    <Copy className="w-4 h-4 mr-2" /> Copy Email
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleRemoveMember(member.id)} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" /> Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Invitations Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" /> Pending Invitations</CardTitle>
              <CardDescription>Members who haven&apos;t set their password yet</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p>No pending invitations</p>
                  <p className="text-sm">All members have set up their accounts</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Invited On</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{member.user.name}</div>
                            <div className="text-sm text-muted-foreground">{member.user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ROLE_CONFIG[member.role]?.color}>
                            {ROLE_CONFIG[member.role]?.icon}
                            <span className="ml-1">{ROLE_CONFIG[member.role]?.label || member.role}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{member.invitedAt ? new Date(member.invitedAt).toLocaleDateString() : '-'}</span>
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => { orgApi.sendInviteNotification(orgId, member.id); toast.success('Invite notification sent'); }} title="Resend invite">
                                <Mail className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.id)} className="text-red-600" title="Remove">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Descriptions Tab */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Role Descriptions</CardTitle>
              <CardDescription>What each role can do in the organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                  <div key={key} className="flex items-start gap-3 p-3 rounded-lg border">
                    <Badge variant="outline" className={config.color}>{config.icon}<span className="ml-1">{config.label}</span></Badge>
                    <span className="text-sm text-muted-foreground">{config.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Permissions Tab */}
        <TabsContent value="all-perms">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  All Permissions
                </CardTitle>
                <CardDescription>All granted permissions across documents and templates</CardDescription>
              </div>
              {canManage && orgPerms.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = orgPermissionsApi.export(orgId);
                      window.open(url, '_blank');
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {showHistory ? 'Hide History' : 'History'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {orgPermsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading permissions...</div>
              ) : orgPerms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No explicit permissions</p>
                  <p className="text-xs">Access is determined by roles</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {orgPerms.map(perm => (
                    <div key={perm.id} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          {perm.userName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{perm.userName}</span>
                            <Badge variant="outline" className="text-[10px]">{perm.action}</Badge>
                            <Badge variant="outline" className="text-[10px] bg-muted">{perm.resource}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {perm.documentTitle || perm.templateName || 'Unknown'}
                            {perm.expiresAt && ` · Expires ${new Date(perm.expiresAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">by {perm.grantedBy}</span>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-destructive"
                            onClick={async () => {
                              try {
                                if (perm.documentId) {
                                  await documentPermissionsApi.remove(perm.documentId, perm.userId, perm.action);
                                } else if (perm.templateId) {
                                  await templatePermissionsApi.remove(perm.templateId, perm.userId, perm.action);
                                }
                                toast.success('Permission revoked');
                                loadOrgPermissions();
                              } catch {
                                toast.error('Failed to revoke');
                              }
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Permission History Section */}
          {showHistory && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Permission Change History
                </CardTitle>
                <CardDescription>Recent permission grants, revocations, and extensions</CardDescription>
              </CardHeader>
              <CardContent>
                {permHistoryLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading history...</div>
                ) : permHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No permission changes recorded</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {permHistory.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between p-2 rounded border">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            {entry.userName?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{entry.userName}</span>
                              <Badge variant="outline" className={`text-[10px] ${
                                entry.action.includes('granted') ? 'bg-green-50 text-green-700' :
                                entry.action.includes('revoked') ? 'bg-red-50 text-red-700' :
                                'bg-blue-50 text-blue-700'
                              }`}>
                                {entry.action.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                            {entry.details && (
                              <p className="text-xs text-muted-foreground">{entry.details}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Permission Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Permission Templates
              </CardTitle>
              <CardDescription>Save and reuse common permission sets</CardDescription>
            </CardHeader>
            <CardContent>
              {permTemplatesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
              ) : permTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No templates created</p>
                  <p className="text-xs">Create a template to save common permission sets</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {permTemplates.map(template => {
                    const perms = JSON.parse(template.permissions) as Array<{ resource: string; action: string }>;
                    return (
                      <div key={template.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{template.name}</h4>
                            {template.description && (
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setApplyTemplateId(template.id);
                                setApplyTemplateMemberId('');
                              }}
                              disabled={applyingTemplate === template.id}
                            >
                              {applyingTemplate === template.id ? 'Applying...' : 'Apply'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (window.confirm(`Delete template "${template.name}"?`)) {
                                  try {
                                    await permissionTemplatesApi.delete(orgId, template.id);
                                    setPermTemplates(prev => prev.filter(t => t.id !== template.id));
                                    toast({ title: 'Template deleted' });
                                  } catch (error) {
                                    toast({ title: 'Failed to delete template', variant: 'destructive' });
                                  }
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {perms.map((perm, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px]">
                              {perm.resource}:{perm.action}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canManage && (
                <div className="mt-4 pt-4 border-t">
                  {!showCreateTemplate ? (
                    <Button variant="outline" onClick={() => setShowCreateTemplate(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Template
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        placeholder="Template name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <select
                          value={newPermResource}
                          onChange={(e) => setNewPermResource(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        >
                          <option value="document">Document</option>
                          <option value="template">Template</option>
                          <option value="report">Report</option>
                          <option value="user">User</option>
                          <option value="org">Organization</option>
                        </select>
                        <select
                          value={newPermAction}
                          onChange={(e) => setNewPermAction(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        >
                          <option value="create">Create</option>
                          <option value="read">Read</option>
                          <option value="update">Update</option>
                          <option value="delete">Delete</option>
                          <option value="share">Share</option>
                          <option value="sign">Sign</option>
                        </select>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setTemplatePermissions(prev => [
                              ...prev,
                              { resource: newPermResource, action: newPermAction },
                            ]);
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {templatePermissions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {templatePermissions.map((perm, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[10px] cursor-pointer"
                              onClick={() => {
                                setTemplatePermissions(prev => prev.filter((_, i) => i !== idx));
                              }}
                            >
                              {perm.resource}:{perm.action} ×
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            if (!templateName || templatePermissions.length === 0) {
                              toast({ title: 'Name and permissions required', variant: 'destructive' });
                              return;
                            }
                            try {
                              const data = await permissionTemplatesApi.create(orgId, {
                                name: templateName,
                                description: templateDescription || undefined,
                                permissions: templatePermissions,
                              });
                              setPermTemplates(prev => [...prev, data.template]);
                              setShowCreateTemplate(false);
                              setTemplateName('');
                              setTemplateDescription('');
                              setTemplatePermissions([]);
                              toast({ title: 'Template created' });
                            } catch (error) {
                              toast({ title: 'Failed to create template', variant: 'destructive' });
                            }
                          }}
                        >
                          Save Template
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCreateTemplate(false);
                            setTemplateName('');
                            setTemplateDescription('');
                            setTemplatePermissions([]);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expiring Permissions Tab */}
        <TabsContent value="expiring">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Expiring Permissions
              </CardTitle>
              <CardDescription>Permissions that will expire within 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringPermsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading expiring permissions...</div>
              ) : expiringPerms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-50" />
                  <p>No expiring permissions</p>
                  <p className="text-xs">All permissions are valid</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expiringPerms.map(perm => (
                    <div key={perm.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                          {perm.userName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{perm.userName}</span>
                            <Badge variant="outline" className="text-[10px]">{perm.action}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {perm.documentTitle || perm.templateName || 'Unknown resource'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${
                            perm.daysUntilExpiry <= 3 ? 'bg-red-50 text-red-700 border-red-200' :
                            perm.daysUntilExpiry <= 7 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                            {perm.daysUntilExpiry}d left
                          </Badge>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px]"
                              onClick={async () => {
                                try {
                                  await permissionExtensionApi.extend(perm.id, 30);
                                  toast.success('Extended by 30 days');
                                  loadExpiringPermissions();
                                } catch {
                                  toast.error('Failed to extend');
                                }
                              }}
                            >
                              +30d
                            </Button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Expires {new Date(perm.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Activity Log</CardTitle>
              <CardDescription>Recent activity from team members ({activityTotal} total)</CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading activities...</div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                        {activity.user.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{activity.user.name}</span>
                          <Badge variant="outline" className="text-[10px]">{activity.action.replace(/_/g, ' ')}</Badge>
                        </div>
                        {activity.details && <p className="text-xs text-muted-foreground mt-1 truncate">{activity.details}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{new Date(activity.createdAt).toLocaleString()}</span>
                          {activity.document && <span className="text-[10px] text-muted-foreground">· {activity.document.title}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update role and access for {selectedMember?.user.name}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANAGEABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">{ROLE_CONFIG[role].icon} <span>{ROLE_CONFIG[role].label}</span></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">Disable to block member access</p>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditMember} disabled={editLoading}>{editLoading ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Display Dialog */}
      <Dialog open={!!showTempPassword} onOpenChange={() => setShowTempPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-yellow-500" /> Save This Password</DialogTitle>
            <DialogDescription>This password will only be shown once. Share it securely with the member.</DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all">{showTempPassword}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTempPassword(null)}>Close</Button>
            <Button onClick={() => { if (showTempPassword) { navigator.clipboard.writeText(showTempPassword); toast.success('Password copied to clipboard'); } }}>
              <Copy className="w-4 h-4 mr-2" /> Copy Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Documents Dialog */}
      <Dialog open={memberDocsDialogOpen} onOpenChange={setMemberDocsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents - {selectedMember?.user.name}
            </DialogTitle>
            <DialogDescription>
              Documents accessible to this member based on their role
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {memberDocsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading documents...</div>
            ) : memberDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No documents accessible</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {memberDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{doc.title}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{doc.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberDocsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Permissions Overview Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Permissions - {selectedMember?.user.name}
            </DialogTitle>
            <DialogDescription>
              All explicit permissions granted to this user
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {userPermsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading permissions...</div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {userDocPerms.length === 0 && userTemplatePerms.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No explicit permissions</p>
                    <p className="text-xs">Access is determined by role</p>
                  </div>
                ) : (
                  <>
                    {userDocPerms.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Document Permissions</h4>
                        <div className="space-y-1">
                          {userDocPerms.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded border text-sm">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3 h-3 text-muted-foreground" />
                                <span>{p.documentTitle}</span>
                                <Badge variant="outline" className="text-[10px]">{p.action}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">by {p.grantedBy}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {userTemplatePerms.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Template Permissions</h4>
                        <div className="space-y-1">
                          {userTemplatePerms.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded border text-sm">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3 h-3 text-muted-foreground" />
                                <span>{p.templateName}</span>
                                <Badge variant="outline" className="text-[10px]">{p.action}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">by {p.grantedBy}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={!!applyTemplateId} onOpenChange={() => setApplyTemplateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Permission Template</DialogTitle>
            <DialogDescription>
              Select a team member to apply the "{permTemplates.find(t => t.id === applyTemplateId)?.name}" template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <select
              value={applyTemplateMemberId}
              onChange={(e) => setApplyTemplateMemberId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Select a member...</option>
              {members.map(member => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.name} ({member.user.email}) - {member.role}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyTemplateId(null)}>Cancel</Button>
            <Button
              disabled={!applyTemplateMemberId || applyingTemplate === applyTemplateId}
              onClick={async () => {
                if (!applyTemplateId || !applyTemplateMemberId) return;
                setApplyingTemplate(applyTemplateId);
                try {
                  await permissionTemplatesApi.apply(orgId, applyTemplateId, applyTemplateMemberId);
                  const template = permTemplates.find(t => t.id === applyTemplateId);
                  const perms = JSON.parse(template?.permissions || '[]');
                  toast({ title: 'Template applied', description: `${perms.length} permissions applied` });
                  setApplyTemplateId(null);
                } catch (error) {
                  toast({ title: 'Failed to apply template', variant: 'destructive' });
                } finally {
                  setApplyingTemplate(null);
                }
              }}
            >
              {applyingTemplate === applyTemplateId ? 'Applying...' : 'Apply Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
