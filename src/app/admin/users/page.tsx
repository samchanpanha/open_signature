'use client';

import { useState, useEffect } from 'react';
import { UserManagement } from '@/components/permissions/user-management';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  orgId: string;
  orgName?: string;
  createdAt: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOrg, setFilterOrg] = useState<string>('all');
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // New user form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserOrg, setNewUserOrg] = useState('');
  const [newUserRole, setNewUserRole] = useState<'member' | 'admin' | 'owner'>('member');

  useEffect(() => {
    loadUsers();
    loadOrganizations();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        toast.error('Failed to load users');
      }
    } catch (error) {
      console.error('Load users error:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
        if (data.length > 0 && !newUserOrg) {
          setNewUserOrg(data[0].id);
        }
      }
    } catch (error) {
      console.error('Load organizations error:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserOrg) {
      toast.error('Email and organization are required');
      return;
    }

    try {
      // First, create the user account
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName || newUserEmail.split('@')[0],
          password: newUserPassword || Math.random().toString(36).slice(-8),
        }),
      });

      let userId: string;

      if (registerRes.ok) {
        const userData = await registerRes.json();
        userId = userData.id;
      } else if (registerRes.status === 409) {
        // User already exists, find their ID
        const existingUser = users.find(u => u.email === newUserEmail);
        if (existingUser) {
          userId = existingUser.id;
        } else {
          toast.error('User already exists');
          return;
        }
      } else {
        const errorData = await registerRes.json();
        toast.error(errorData.error || 'Failed to create user');
        return;
      }

      // Then, add user to organization
      const addRes = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          email: newUserEmail,
          orgId: newUserOrg,
          role: newUserRole
        })
      });

      if (addRes.ok) {
        toast.success('User created and added to organization successfully');
        setAddUserDialogOpen(false);
        resetForm();
        loadUsers();
      } else {
        const errorData = await addRes.json();
        toast.error(errorData.error || 'Failed to add user to organization');
      }
    } catch (error) {
      console.error('Create user error:', error);
      toast.error('Failed to create user');
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    try {
      // Find user's current organization
      const user = users.find(u => u.id === userId);
      if (!user) {
        toast.error('User not found');
        return;
      }

      if (updates.role) {
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            userId,
            orgId: user.orgId,
            role: updates.role
          })
        });

        if (res.ok) {
          toast.success('User role updated successfully');
          loadUsers();
        } else {
          const errorData = await res.json();
          toast.error(errorData.error || 'Failed to update user role');
        }
      }
    } catch (error) {
      console.error('Update user error:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string, orgId: string) => {
    if (!confirm('Are you sure you want to delete this user? This will remove them from all organizations.')) {
      return;
    }

    try {
      const res = await fetch(`/api/users?userId=${userId}&orgId=${orgId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (res.ok) {
        toast.success('User removed successfully');
        loadUsers();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to remove user');
      }
    } catch (error) {
      console.error('Delete user error:', error);
      toast.error('Failed to delete user');
    }
  };

  const resetForm = () => {
    setNewUserEmail('');
    setNewUserName('');
    setNewUserPassword('');
    setNewUserRole('member');
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = filterOrg === 'all' || user.orgId === filterOrg;
    return matchesSearch && matchesOrg;
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage all users in your organization</p>
        </div>
        <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account and add them to an organization.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Leave empty for auto-generated"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organization">Organization *</Label>
                <Select value={newUserOrg} onValueChange={setNewUserOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as 'member' | 'admin' | 'owner')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateUser}>Create User</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Users ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            View and manage all users across your organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={`${user.id}-${user.orgId}`}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.orgName || user.orgId}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <span className="sr-only">Actions</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {user.role !== 'owner' && (
                            <>
                              <DropdownMenuItem onClick={() => handleUpdateUser(user.id, { role: 'member' })}>
                                Set as Member
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleUpdateUser(user.id, { role: 'admin' })}>
                                Set as Admin
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleDeleteUser(user.id, user.orgId)}
                            className="text-red-600"
                          >
                            Remove User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Organization-specific User Management */}
      {organizations.map((org) => (
        <UserManagement key={org.id} orgId={org.id} />
      ))}
    </div>
  );
}
