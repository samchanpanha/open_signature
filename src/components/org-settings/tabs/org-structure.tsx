'use client';

import React, { useState } from 'react';
import { useOrgSettings } from '../org-settings-provider';
import { branchesApi, departmentsApi, positionsApi, type Branch, type Department, type Position } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, Building2, Briefcase, UserCog } from 'lucide-react';

export function OrgStructureTab() {
  const { orgId, branches, departments, positions, loadBranches, loadDepartments, loadPositions } = useOrgSettings();
  const [activeTab, setActiveTab] = useState('branches');

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="branches"><Building2 className="w-4 h-4 mr-1" /> Branches ({branches.length})</TabsTrigger>
          <TabsTrigger value="departments"><Briefcase className="w-4 h-4 mr-1" /> Departments ({departments.length})</TabsTrigger>
          <TabsTrigger value="positions"><UserCog className="w-4 h-4 mr-1" /> Positions ({positions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="branches">
          <BranchesSection orgId={orgId} branches={branches} loadBranches={loadBranches} />
        </TabsContent>

        <TabsContent value="departments">
          <DepartmentsSection orgId={orgId} departments={departments} loadDepartments={loadDepartments} />
        </TabsContent>

        <TabsContent value="positions">
          <PositionsSection orgId={orgId} positions={positions} loadPositions={loadPositions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BranchesSection({ orgId, branches, loadBranches }: { orgId: string; branches: Branch[]; loadBranches: () => Promise<void> }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setName(b.name);
    setCode(b.code || '');
    setDescription(b.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await branchesApi.update(orgId, editing.id, { name, code: code || undefined, description: description || undefined });
        toast.success('Branch updated');
      } else {
        await branchesApi.create(orgId, { name, code: code || undefined, description: description || undefined });
        toast.success('Branch created');
      }
      setDialogOpen(false);
      loadBranches();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: Branch) => {
    if (!confirm(`Delete branch "${b.name}"? Members assigned to it will be unassigned.`)) return;
    try {
      await branchesApi.delete(orgId, b.id);
      toast.success('Branch deleted');
      loadBranches();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete branch');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" /> Branches</CardTitle>
          <CardDescription>Manage organizational branches or offices</CardDescription>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Branch</Button>
      </CardHeader>
      <CardContent>
        {branches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No branches yet</p>
            <p className="text-sm">Create branches to organize members by office or location</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell><Badge variant="outline">{b.code || '-'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{b.description || '-'}</TableCell>
                  <TableCell>{b._count?.members ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={b.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(b)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Branch' : 'Create Branch'}</DialogTitle>
            <DialogDescription>{editing ? 'Update branch details' : 'Add a new branch or office location'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. Phnom Penh Office" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input placeholder="e.g. PP (optional short code)" value={code} onChange={e => setCode(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DepartmentsSection({ orgId, departments, loadDepartments }: { orgId: string; departments: Department[]; loadDepartments: () => Promise<void> }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setName(d.name);
    setCode(d.code || '');
    setDescription(d.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await departmentsApi.update(orgId, editing.id, { name, code: code || undefined, description: description || undefined });
        toast.success('Department updated');
      } else {
        await departmentsApi.create(orgId, { name, code: code || undefined, description: description || undefined });
        toast.success('Department created');
      }
      setDialogOpen(false);
      loadDepartments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Department) => {
    if (!confirm(`Delete department "${d.name}"? Members and workflows will be unassigned.`)) return;
    try {
      await departmentsApi.delete(orgId, d.id);
      toast.success('Department deleted');
      loadDepartments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete department');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5" /> Departments</CardTitle>
          <CardDescription>Manage departments and link workflows</CardDescription>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Department</Button>
      </CardHeader>
      <CardContent>
        {departments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No departments yet</p>
            <p className="text-sm">Create departments to organize members and assign workflows</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Workflows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Badge variant="outline">{d.code || '-'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{d.description || '-'}</TableCell>
                  <TableCell>{d._count?.members ?? 0}</TableCell>
                  <TableCell>{d._count?.workflows ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={d.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(d)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Department' : 'Create Department'}</DialogTitle>
            <DialogDescription>{editing ? 'Update department details' : 'Add a new department'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input placeholder="e.g. Engineering" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input placeholder="e.g. ENG (optional short code)" value={code} onChange={e => setCode(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const POSITION_LEVELS = ['junior', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'c-level'];

function PositionsSection({ orgId, positions, loadPositions }: { orgId: string; positions: Position[]; loadPositions: () => Promise<void> }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setLevel('');
    setDescription('');
    setDialogOpen(true);
  };

  const openEdit = (p: Position) => {
    setEditing(p);
    setTitle(p.title);
    setLevel(p.level || '');
    setDescription(p.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await positionsApi.update(orgId, editing.id, { title, level: level || undefined, description: description || undefined });
        toast.success('Position updated');
      } else {
        await positionsApi.create(orgId, { title, level: level || undefined, description: description || undefined });
        toast.success('Position created');
      }
      setDialogOpen(false);
      loadPositions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save position');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Position) => {
    if (!confirm(`Delete position "${p.title}"? Members and workflows will be unassigned.`)) return;
    try {
      await positionsApi.delete(orgId, p.id);
      toast.success('Position deleted');
      loadPositions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete position');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><UserCog className="w-5 h-5" /> Positions</CardTitle>
          <CardDescription>Manage job positions and link workflows</CardDescription>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Add Position</Button>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserCog className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No positions yet</p>
            <p className="text-sm">Create positions to assign to members and link workflows</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Workflows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell><Badge variant="outline">{p.level || '-'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{p.description || '-'}</TableCell>
                  <TableCell>{p._count?.members ?? 0}</TableCell>
                  <TableCell>{p._count?.workflows ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={p.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p)} className="text-red-600"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Position' : 'Create Position'}</DialogTitle>
            <DialogDescription>{editing ? 'Update position details' : 'Add a new job position'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input placeholder="e.g. Software Engineer" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue placeholder="Select level (optional)" /></SelectTrigger>
                <SelectContent>
                  {POSITION_LEVELS.map(l => (
                    <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input placeholder="Optional description" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
