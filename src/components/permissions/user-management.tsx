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
import { Plus, MoreVertical, Shield, UserPlus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

interface Permission {
  id: string;
  resource: string;
  action: string;
  granted: boolean;
  userId: string;
  user?: { email: string; name: string };
}

const RESOURCES = ['document', 'template', 'form', 'report', 'user', 'organization'];
const ACTIONS = ['create', 'read', 'update', 'delete'];

export function UserManagement({ orgId }: { orgId: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'member' | 'admin'>('member');
  const [selectedPermissionResource, setSelectedPermissionResource] = useState('document');
  const [selectedPermissionAction, setSelectedPermissionAction] = useState('read');

  const loadData = async () => {
    try {
      const [usersRes, permissionsRes] = await Promise.all([
        fetch(`/api/users?orgId=${orgId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/permissions?orgId=${orgId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }

      if (permissionsRes.ok) {
        setPermissions(await permissionsRes.json());
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load users and permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  const handleAddUser = async () => {
    if (!newUserEmail) {
      toast.error('Email is required');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          email: newUserEmail,
          orgId,
          role: newUserRole
        })
      });

      if (res.ok) {
        toast.success('User added successfully');
        setNewUserEmail('');
        setNewUserRole('member');
        setAddUserDialogOpen(false);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add user');
      }
    } catch (error) {
      console.error('Add user error:', error);
      toast.error('Failed to add user');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId,
          orgId,
          role: newRole
        })
      });

      if (res.ok) {
        toast.success('Role updated successfully');
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Update role error:', error);
      toast.error('Failed to update role');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;

    try {
      const res = await fetch(`/api/users?userId=${userId}&orgId=${orgId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (res.ok) {
        toast.success('User removed successfully');
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove user');
      }
    } catch (error) {
      console.error('Remove user error:', error);
      toast.error('Failed to remove user');
    }
  };

  const handleGrantPermission = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    try {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          orgId,
          resource: selectedPermissionResource,
          action: selectedPermissionAction,
          granted: true
        })
      });

      if (res.ok) {
        toast.success('Permission granted successfully');
        setPermissionDialogOpen(false);
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to grant permission');
      }
    } catch (error) {
      console.error('Grant permission error:', error);
      toast.error('Failed to grant permission');
    }
  };

  const handleRevokePermission = async (permissionId: string) => {
    try {
      const res = await fetch(`/api/permissions?id=${permissionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (res.ok) {
        toast.success('Permission revoked successfully');
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to revoke permission');
      }
    } catch (error) {
      console.error('Revoke permission error:', error);
      toast.error('Failed to revoke permission');
    }
  };

  const getUserPermissions = (userId: string) => {
    return permissions.filter(p => p.userId === userId);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Users Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage users and their roles in your organization</CardDescription>
          </div>
          <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add a new member to your organization. If the user doesn't exist, an account will be created.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'member' | 'admin')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddUser}>Add Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>{new Date(user.joinedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {user.role !== 'owner' && (
                          <>
                            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'member')}>
                              Set as Member
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, 'admin')}>
                              Set as Admin
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleRemoveUser(user.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Permissions Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Permissions
            </CardTitle>
            <CardDescription>Grant or revoke specific permissions for team members</CardDescription>
          </div>
          <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Grant Permission
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Permission</DialogTitle>
                <DialogDescription>
                  Grant a specific permission to a team member.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="user">User</Label>
                  <Select 
                    value={selectedUser?.id} 
                    onValueChange={(value) => setSelectedUser(users.find(u => u.id === value) || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="resource">Resource</Label>
                  <Select 
                    value={selectedPermissionResource} 
                    onValueChange={setSelectedPermissionResource}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCES.map((resource) => (
                        <SelectItem key={resource} value={resource}>
                          {resource.charAt(0).toUpperCase() + resource.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="action">Action</Label>
                  <Select 
                    value={selectedPermissionAction} 
                    onValueChange={setSelectedPermissionAction}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIONS.map((action) => (
                        <SelectItem key={action} value={action}>
                          {action.charAt(0).toUpperCase() + action.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPermissionDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleGrantPermission}>Grant Permission</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No custom permissions set. Owners and admins have full access by default.
                  </TableCell>
                </TableRow>
              ) : (
                permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell className="font-medium">
                      {permission.user?.name || permission.user?.email || 'Unknown'}
                    </TableCell>
                    <TableCell className="capitalize">{permission.resource}</TableCell>
                    <TableCell className="capitalize">{permission.action}</TableCell>
                    <TableCell>
                      <Badge variant={permission.granted ? 'default' : 'secondary'}>
                        {permission.granted ? 'Granted' : 'Denied'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRevokePermission(permission.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
