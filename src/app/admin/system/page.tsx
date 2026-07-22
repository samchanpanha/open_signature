'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Users, Building2, FileText, Activity, Shield, ShieldCheck,
  Search, ChevronLeft, ChevronRight, UserMinus, UserPlus,
  RefreshCw, Download, Clock, ArrowLeft, Crown
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  totalOrgs: number;
  totalDocuments: number;
  totalSigners: number;
  totalAuditLogs: number;
  usersLast7Days: number;
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  createdAt: string;
  _count: { documents: number; organizationMembers: number; auditLogs: number };
}

interface OrgRecord {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  owner: { name: string; email: string } | null;
  _count: { members: number; documents: number };
}

interface AuditLogRecord {
  id: string;
  action: string;
  details: string | null;
  resourceType: string | null;
  createdAt: string;
  userName: string;
}

interface OverviewData {
  stats: SystemStats;
  documentsByStatus: Record<string, number>;
  recentAuditLogs: AuditLogRecord[];
}

export default function SystemAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState('');
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [orgsTotal, setOrgsTotal] = useState(0);
  const [orgsPage, setOrgsPage] = useState(1);
  const [orgsSearch, setOrgsSearch] = useState('');
  const [impersonateDialog, setImpersonateDialog] = useState<{ open: boolean; userId: string; userName: string }>({ open: false, userId: '', userName: '' });
  const [activeTab, setActiveTab] = useState('overview');

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'orgs') loadOrgs();
  }, [activeTab, usersPage, orgsPage]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin', { headers: headers() });
      if (res.status === 403) { toast.error('Super admin access required'); router.push('/'); return; }
      if (res.ok) setOverview(await res.json());
      else toast.error('Failed to load overview');
    } catch { toast.error('Failed to load overview'); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams({ page: String(usersPage), limit: '20' });
      if (usersSearch) params.set('search', usersSearch);
      const res = await fetch(`/api/super-admin/users?${params}`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setUsers(d.users); setUsersTotal(d.total); }
    } catch { toast.error('Failed to load users'); }
  };

  const loadOrgs = async () => {
    try {
      const params = new URLSearchParams({ page: String(orgsPage), limit: '20' });
      if (orgsSearch) params.set('search', orgsSearch);
      const res = await fetch(`/api/super-admin/orgs?${params}`, { headers: headers() });
      if (res.ok) { const d = await res.json(); setOrgs(d.orgs); setOrgsTotal(d.total); }
    } catch { toast.error('Failed to load organizations'); }
  };

  const toggleSuperAdmin = async (userId: string, current: boolean) => {
    try {
      const res = await fetch('/api/super-admin/users', {
        method: 'PUT',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isSuperAdmin: !current }),
      });
      if (res.ok) { toast.success(current ? 'Revoked super admin' : 'Granted super admin'); loadUsers(); }
      else toast.error('Failed to update');
    } catch { toast.error('Failed to update'); }
  };

  const handleImpersonate = async () => {
    try {
      const res = await fetch('/api/super-admin/impersonate', {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: impersonateDialog.userId }),
      });
      if (res.ok) {
        const d = await res.json();
        localStorage.setItem('token', d.token);
        toast.success(`Now viewing as ${impersonateDialog.userName}`);
        setImpersonateDialog({ open: false, userId: '', userName: '' });
        router.push('/');
      } else toast.error('Failed to impersonate');
    } catch { toast.error('Failed to impersonate'); }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/super-admin/users?userId=${userId}`, { method: 'DELETE', headers: headers() });
      if (res.ok) { toast.success('User deleted'); loadUsers(); }
      else { const d = await res.json(); toast.error(d.error || 'Failed to delete'); }
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold">System Administration</h1>
          </div>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <ShieldCheck className="w-3 h-3 mr-1" /> Super Admin
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview"><Activity className="w-4 h-4 mr-1" /> Overview</TabsTrigger>
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" /> Users</TabsTrigger>
            <TabsTrigger value="orgs"><Building2 className="w-4 h-4 mr-1" /> Organizations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {overview && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { label: 'Users', value: overview.stats.totalUsers, icon: Users, color: 'text-blue-600' },
                    { label: 'Organizations', value: overview.stats.totalOrgs, icon: Building2, color: 'text-purple-600' },
                    { label: 'Documents', value: overview.stats.totalDocuments, icon: FileText, color: 'text-emerald-600' },
                    { label: 'Signers', value: overview.stats.totalSigners, icon: Users, color: 'text-amber-600' },
                    { label: 'Audit Logs', value: overview.stats.totalAuditLogs, icon: Activity, color: 'text-slate-600' },
                    { label: 'New Users (7d)', value: overview.stats.usersLast7Days, icon: UserPlus, color: 'text-cyan-600' },
                  ].map((s) => (
                    <Card key={s.label}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                            <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
                          </div>
                          <s.icon className={`w-8 h-8 ${s.color} opacity-20`} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Documents by Status</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(overview.documentsByStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <Badge variant="outline">{status}</Badge>
                            <span className="font-mono text-sm">{count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-sm">Recent Activity</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {overview.recentAuditLogs.map((log) => (
                          <div key={log.id} className="flex items-start gap-2 text-xs">
                            <Clock className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <span className="font-medium">{log.userName}</span>{' '}
                              <span className="text-muted-foreground">{log.action}</span>
                              {log.details && <span className="text-muted-foreground block truncate">{log.details}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Users ({usersTotal})</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={usersSearch}
                      onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(1); }}
                      onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={loadUsers}><RefreshCw className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Docs</TableHead>
                      <TableHead>Orgs</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{u.name || u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.isSuperAdmin ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                              <Crown className="w-3 h-3 mr-1" /> Super Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">User</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{u._count.documents}</TableCell>
                        <TableCell className="font-mono text-sm">{u._count.organizationMembers}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSuperAdmin(u.id, u.isSuperAdmin)}
                              title={u.isSuperAdmin ? 'Revoke super admin' : 'Grant super admin'}
                            >
                              {u.isSuperAdmin ? <Shield className="w-4 h-4 text-muted-foreground" /> : <ShieldCheck className="w-4 h-4 text-amber-500" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setImpersonateDialog({ open: true, userId: u.id, userName: u.name || u.email })}
                              title="Impersonate user"
                            >
                              <UserMinus className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteUser(u.id, u.email)}
                              title="Delete user"
                            >
                              <UserMinus className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(usersPage - 1) * 20 + 1}-{Math.min(usersPage * 20, usersTotal)} of {usersTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={usersPage <= 1} onClick={() => setUsersPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">{usersPage}</span>
                    <Button variant="outline" size="sm" disabled={usersPage * 20 >= usersTotal} onClick={() => setUsersPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orgs">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Organizations ({orgsTotal})</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search orgs..."
                      value={orgsSearch}
                      onChange={(e) => { setOrgsSearch(e.target.value); setOrgsPage(1); }}
                      onKeyDown={(e) => e.key === 'Enter' && loadOrgs()}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={loadOrgs}><RefreshCw className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{o.name}</p>
                            <p className="text-xs text-muted-foreground">{o.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{o.owner?.name || o.owner?.email || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{o._count.members}</TableCell>
                        <TableCell className="font-mono text-sm">{o._count.documents}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(orgsPage - 1) * 20 + 1}-{Math.min(orgsPage * 20, orgsTotal)} of {orgsTotal}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={orgsPage <= 1} onClick={() => setOrgsPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">{orgsPage}</span>
                    <Button variant="outline" size="sm" disabled={orgsPage * 20 >= orgsTotal} onClick={() => setOrgsPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={impersonateDialog.open} onOpenChange={(open) => setImpersonateDialog(prev => ({ ...prev, open }))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Impersonate User</DialogTitle>
              <DialogDescription>
                You will be logged in as <strong>{impersonateDialog.userName}</strong>. Your current session will be replaced. This action is logged.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImpersonateDialog({ open: false, userId: '', userName: '' })}>Cancel</Button>
              <Button onClick={handleImpersonate}>Impersonate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
