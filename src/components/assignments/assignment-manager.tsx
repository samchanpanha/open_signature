'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Plus, MoreVertical, Edit, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Assignment {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  dueDate?: string;
  completedAt?: string;
  notes?: string;
  user: { id: string; name: string; email: string };
  document: { id: string; title: string };
  org: { id: string; name: string };
  assigner: { id: string; name: string; email: string };
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Document {
  id: string;
  title: string;
}

interface AssignmentManagerProps {
  orgId: string;
}

export function AssignmentManager({ orgId }: AssignmentManagerProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [formData, setFormData] = useState({
    userId: '',
    documentId: '',
    dueDate: '',
    notes: '',
    status: 'pending',
  });

  useEffect(() => {
    fetchAssignments();
    fetchUsers();
    fetchDocuments();
  }, [orgId]);

  async function fetchAssignments() {
    try {
      const res = await fetch(`/api/assignments?orgId=${orgId}`);
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch(`/api/users?orgId=${orgId}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }

  async function fetchDocuments() {
    try {
      const res = await fetch(`/api/documents?orgId=${orgId}`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      const url = editingAssignment 
        ? `/api/assignments/${editingAssignment.id}` 
        : '/api/assignments';
      
      const method = editingAssignment ? 'PUT' : 'POST';
      
      const body: any = {
        orgId,
        ...formData,
      };

      if (!editingAssignment) {
        delete body.status; // Status is set automatically on creation
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save assignment');

      await fetchAssignments();
      setDialogOpen(false);
      setEditingAssignment(null);
      setFormData({ userId: '', documentId: '', dueDate: '', notes: '', status: 'pending' });
    } catch (error) {
      console.error('Error saving assignment:', error);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      await fetchAssignments();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  async function deleteAssignment(id: string) {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete assignment');

      await fetchAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" /> In Progress</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500"><AlertCircle className="w-3 h-3 mr-1" /> Overdue</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  }

  if (loading) {
    return <div className="p-4">Loading assignments...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Document Assignments</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Assignment
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Assigned By</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No assignments found
              </TableCell>
            </TableRow>
          ) : (
            assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">{assignment.document.title}</TableCell>
                <TableCell>
                  <div>{assignment.user.name}</div>
                  <div className="text-sm text-muted-foreground">{assignment.user.email}</div>
                </TableCell>
                <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                <TableCell>
                  {assignment.dueDate 
                    ? format(new Date(assignment.dueDate), 'MMM dd, yyyy')
                    : 'Not set'}
                </TableCell>
                <TableCell>{assignment.assigner.name}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => updateStatus(assignment.id, 'in_progress')}>
                        Mark In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(assignment.id, 'completed')}>
                        Mark Completed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setEditingAssignment(assignment);
                        setFormData({
                          userId: assignment.user.id,
                          documentId: assignment.document.id,
                          dueDate: assignment.dueDate ? assignment.dueDate.split('T')[0] : '',
                          notes: assignment.notes || '',
                          status: assignment.status,
                        });
                        setDialogOpen(true);
                      }}>
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteAssignment(assignment.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit Assignment' : 'New Assignment'}
            </DialogTitle>
            <DialogDescription>
              {editingAssignment 
                ? 'Update the assignment details' 
                : 'Assign a document to a user for signing'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">User</Label>
              <Select 
                value={formData.userId} 
                onValueChange={(value) => setFormData({ ...formData, userId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
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

            <div className="space-y-2">
              <Label htmlFor="document">Document</Label>
              <Select 
                value={formData.documentId} 
                onValueChange={(value) => setFormData({ ...formData, documentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional instructions..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingAssignment ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
