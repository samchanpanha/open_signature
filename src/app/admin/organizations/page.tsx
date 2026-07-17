'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Search, Building2, Users, Trash2, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  memberCount?: number;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  
  // Form state
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        // Fetch member counts for each organization
        const orgsWithCounts = await Promise.all(
          data.map(async (org: Organization) => {
            try {
              const membersRes = await fetch(`/api/organizations/${org.id}/members`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
              });
              if (membersRes.ok) {
                const members = await membersRes.json();
                return { ...org, memberCount: members.length };
              }
            } catch (e) {
              console.error('Failed to load members for org:', org.id);
            }
            return { ...org, memberCount: 0 };
          })
        );
        setOrganizations(orgsWithCounts);
      } else {
        toast.error('Failed to load organizations');
      }
    } catch (error) {
      console.error('Load organizations error:', error);
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: orgName.trim(),
          description: orgDescription.trim() || undefined
        })
      });

      if (res.ok) {
        toast.success('Organization created successfully');
        setCreateDialogOpen(false);
        resetForm();
        loadOrganizations();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to create organization');
      }
    } catch (error) {
      console.error('Create organization error:', error);
      toast.error('Failed to create organization');
    }
  };

  const handleUpdateOrganization = async () => {
    if (!selectedOrg || !orgName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: orgName.trim(),
          description: orgDescription.trim() || undefined
        })
      });

      if (res.ok) {
        toast.success('Organization updated successfully');
        setEditDialogOpen(false);
        resetForm();
        setSelectedOrg(null);
        loadOrganizations();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to update organization');
      }
    } catch (error) {
      console.error('Update organization error:', error);
      toast.error('Failed to update organization');
    }
  };

  const handleDeleteOrganization = async (orgId: string) => {
    if (!confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (res.ok) {
        toast.success('Organization deleted successfully');
        loadOrganizations();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to delete organization');
      }
    } catch (error) {
      console.error('Delete organization error:', error);
      toast.error('Failed to delete organization');
    }
  };

  const openEditDialog = (org: Organization) => {
    setSelectedOrg(org);
    setOrgName(org.name);
    setOrgDescription(org.description || '');
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setOrgName('');
    setOrgDescription('');
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (org.description && org.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading organizations...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organization Management</h1>
          <p className="text-muted-foreground">Manage your organizations and their settings</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to manage users and documents.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Organization Name *</Label>
                <Input
                  id="name"
                  placeholder="Acme Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateOrganization}>Create Organization</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            All Organizations ({filteredOrganizations.length})
          </CardTitle>
          <CardDescription>
            View and manage all organizations in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrganizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No organizations found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrganizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {org.description || <span className="text-muted-foreground">No description</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Users className="w-3 h-3" />
                        {org.memberCount || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
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
                          <DropdownMenuItem onClick={() => openEditDialog(org)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteOrganization(org.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Organization Name *</Label>
              <Input
                id="edit-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateOrganization}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
