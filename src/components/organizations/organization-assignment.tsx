'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Users, FileText, Calendar, MoreVertical, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface Assignment {
  id: string;
  status: string;
  dueDate?: string;
  completedAt?: string;
  notes?: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  document: {
    id: string;
    title: string;
    status: string;
  };
  assigner: {
    id: string;
    email: string;
    name: string;
  };
  createdAt: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  schema: any;
  createdBy: {
    id: string;
    email: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
  fieldCount: number;
}

interface Document {
  id: string;
  title: string;
  status: string;
}

interface OrganizationAssignmentProps {
  orgId: string;
}

export function OrganizationAssignment({ orgId }: OrganizationAssignmentProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assignments');
  
  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  
  // Form states
  const [selectedDocument, setSelectedDocument] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  useEffect(() => {
    loadData();
  }, [orgId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMembers(),
        loadAssignments(),
        loadTemplates(),
        loadDocuments(),
      ]);
    } catch (error) {
      console.error('Load data error:', error);
      toast.error('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    const res = await fetch(`/api/organizations/${orgId}/members`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setMembers(data);
    }
  };

  const loadAssignments = async () => {
    const res = await fetch(`/api/organizations/${orgId}/assignments`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setAssignments(data);
    }
  };

  const loadTemplates = async () => {
    const res = await fetch(`/api/organizations/${orgId}/templates`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data);
    }
  };

  const loadDocuments = async () => {
    const res = await fetch(`/api/documents?organizationId=${orgId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedDocument || !selectedUser) {
      toast.error('Please select both a document and a user');
      return;
    }

    try {
      const res = await fetch(`/api/organizations/${orgId}/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          documentId: selectedDocument,
          userId: selectedUser,
          dueDate: dueDate || null,
          notes: notes || null,
        })
      });

      if (res.ok) {
        toast.success('Assignment created successfully');
        setAssignDialogOpen(false);
        resetAssignmentForm();
        loadAssignments();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to create assignment');
      }
    } catch (error) {
      console.error('Create assignment error:', error);
      toast.error('Failed to create assignment');
    }
  };

  const handleUpdateAssignmentStatus = async (assignmentId: string, status: string) => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        toast.success('Assignment updated');
        loadAssignments();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to update assignment');
      }
    } catch (error) {
      console.error('Update assignment error:', error);
      toast.error('Failed to update assignment');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      const res = await fetch(`/api/organizations/${orgId}/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (res.ok) {
        toast.success('Assignment deleted');
        loadAssignments();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to delete assignment');
      }
    } catch (error) {
      console.error('Delete assignment error:', error);
      toast.error('Failed to delete assignment');
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Template name is required');
      return;
    }

    try {
      const res = await fetch(`/api/organizations/${orgId}/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          schema: { fields: [] }, // Basic schema
        })
      });

      if (res.ok) {
        toast.success('Template created successfully');
        setTemplateDialogOpen(false);
        setTemplateName('');
        setTemplateDescription('');
        loadTemplates();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to create template');
      }
    } catch (error) {
      console.error('Create template error:', error);
      toast.error('Failed to create template');
    }
  };

  const resetAssignmentForm = () => {
    setSelectedDocument('');
    setSelectedUser('');
    setDueDate('');
    setNotes('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Overdue</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading organization data...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Organization Management
        </CardTitle>
        <CardDescription>
          Manage assignments and templates for your organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="assignments">Assignments ({assignments.length})</TabsTrigger>
            <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          </TabsList>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Track document assignments and signing progress
              </div>
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Assignment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Assignment</DialogTitle>
                    <DialogDescription>
                      Assign a document to a team member for signing.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="document">Document *</Label>
                      <Select value={selectedDocument} onValueChange={setSelectedDocument}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a document" />
                        </SelectTrigger>
                        <SelectContent>
                          {documents.map(doc => (
                            <SelectItem key={doc.id} value={doc.id}>
                              {doc.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="user">Team Member *</Label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.filter(m => m.role !== 'owner').map(member => (
                            <SelectItem key={member.user.id} value={member.user.id}>
                              {member.user.name} ({member.user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dueDate">Due Date (Optional)</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Input
                        id="notes"
                        placeholder="Additional instructions"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setAssignDialogOpen(false);
                      resetAssignmentForm();
                    }}>Cancel</Button>
                    <Button onClick={handleCreateAssignment}>Create Assignment</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No assignments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.document.title}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{assignment.user.name}</div>
                          <div className="text-xs text-muted-foreground">{assignment.user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                      <TableCell>
                        {assignment.dueDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(assignment.dueDate).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No due date</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Update Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleUpdateAssignmentStatus(assignment.id, 'pending')}>
                              Mark as Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateAssignmentStatus(assignment.id, 'in_progress')}>
                              Mark as In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateAssignmentStatus(assignment.id, 'completed')}>
                              Mark as Completed
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="text-red-600"
                            >
                              Delete Assignment
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Create reusable form templates for your organization
              </div>
              <Dialog open={templateDialogOpen} onValueChange={setTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Template</DialogTitle>
                    <DialogDescription>
                      Create a reusable form template with custom fields.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="templateName">Template Name *</Label>
                      <Input
                        id="templateName"
                        placeholder="Employee Onboarding Form"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="templateDescription">Description (Optional)</Label>
                      <Input
                        id="templateDescription"
                        placeholder="Brief description of the template"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setTemplateDialogOpen(false);
                      setTemplateName('');
                      setTemplateDescription('');
                    }}>Cancel</Button>
                    <Button onClick={handleCreateTemplate}>Create Template</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No templates yet
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {template.description || <span className="text-muted-foreground">No description</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{template.fieldCount} fields</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{template.createdBy.name}</div>
                          <div className="text-xs text-muted-foreground">{template.createdBy.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(template.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
