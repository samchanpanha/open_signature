'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Plus, Trash2, GripVertical, ArrowRight, ArrowDown,
  X, Settings, Play, Pause, Eye, Workflow, LayoutGrid
} from 'lucide-react';
import { toast } from 'sonner';
import { workflowsApi, orgApi, type WorkflowListItem, type WorkflowDetail, type OrgMember } from '@/lib/api';
import { WorkflowCanvas } from './workflow-canvas';

interface WorkflowManagerProps {
  orgId: string;
  orgRole: string;
}

export function WorkflowManager({ orgId, orgRole }: WorkflowManagerProps) {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  const [editorMode, setEditorMode] = useState<'list' | 'visual'>('list');
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSteps, setNewSteps] = useState<{ name: string; stepType: string; userId: string }[]>([]);
  const [creating, setCreating] = useState(false);

  const canManage = orgRole === 'owner' || orgRole === 'admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wfList, memList] = await Promise.all([
        workflowsApi.list(orgId),
        orgApi.listMembers(orgId),
      ]);
      setWorkflows(wfList);
      setMembers(memList);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const addStep = () => {
    setNewSteps([...newSteps, { name: `Step ${newSteps.length + 1}`, stepType: 'sign', userId: '' }]);
  };

  const removeStep = (index: number) => {
    setNewSteps(newSteps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: string) => {
    setNewSteps(newSteps.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= newSteps.length) return;
    const arr = [...newSteps];
    [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
    setNewSteps(arr);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Workflow name is required'); return; }
    if (newSteps.length === 0) { toast.error('Add at least one step'); return; }
    const incomplete = newSteps.find(s => !s.userId);
    if (incomplete) { toast.error('Each step must have a user assigned'); return; }

    setCreating(true);
    try {
      await workflowsApi.create({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        orgId,
        steps: newSteps,
      });
      toast.success('Workflow created!');
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create workflow');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (wf: WorkflowListItem) => {
    try {
      await workflowsApi.update(wf.id, { isActive: !wf.isActive });
      toast.success(wf.isActive ? 'Workflow deactivated' : 'Workflow activated');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workflow');
    }
  };

  const handleDelete = async (wf: WorkflowListItem) => {
    if (!confirm(`Delete workflow "${wf.name}"? This cannot be undone.`)) return;
    try {
      await workflowsApi.delete(wf.id);
      toast.success('Workflow deleted');
      setDetailOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workflow');
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewDescription('');
    setNewSteps([]);
  };

  const getMemberName = (userId: string) => {
    const m = members.find(m => m.user.id === userId);
    return m ? m.user.name : 'Unknown';
  };

  const getMemberEmail = (userId: string) => {
    const m = members.find(m => m.user.id === userId);
    return m ? m.user.email : '';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Loading workflows...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Signature Workflows</CardTitle>
            <CardDescription>Configure multi-step signing workflows for documents</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={editorMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('list')}
                  className="h-7 px-2"
                >
                  <Settings className="w-3 h-3 mr-1" />
                  List
                </Button>
                <Button
                  variant={editorMode === 'visual' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setEditorMode('visual')}
                  className="h-7 px-2"
                >
                  <LayoutGrid className="w-3 h-3 mr-1" />
                  Visual
                </Button>
              </div>
            )}
            {canManage && (
              <Button size="sm" onClick={() => { resetForm(); setCreateOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" /> New Workflow
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editorMode === 'visual' ? (
            <div className="space-y-4">
              {workflows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Workflow className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No workflows created yet.</p>
                  {canManage && <p className="text-sm mt-1">Create a workflow to start designing.</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {workflows.map(wf => (
                    <div key={wf.id} className="border rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between p-3 bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${wf.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          <div>
                            <h4 className="font-medium text-sm">{wf.name}</h4>
                            {wf.description && <p className="text-xs text-muted-foreground">{wf.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={wf.isActive ? 'default' : 'secondary'} className="text-xs">
                            {wf.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{wf.steps.length} nodes</Badge>
                          {editingWorkflowId === wf.id ? (
                            <Button size="sm" variant="ghost" onClick={() => setEditingWorkflowId(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setEditingWorkflowId(wf.id)}>
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {(editingWorkflowId === wf.id || wf.steps.some((s: any) => s.positionX || s.positionY)) && (
                        <div className="border-t">
                          <WorkflowCanvas
                            workflowId={wf.id}
                            initialNodes={(wf as any).steps?.map((s: any) => ({
                              id: s.id,
                              type: s.stepType || 'sign',
                              name: s.name,
                              x: s.positionX || 0,
                              y: s.positionY || 0,
                              config: s.config || {},
                            })) || []}
                            initialEdges={(wf as any).edges || []}
                            orgMembers={members.map(m => ({ id: m.user.id, name: m.user.name, email: m.user.email }))}
                            readonly={!canManage}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {workflows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No workflows created yet.</p>
                  {canManage && <p className="text-sm mt-1">Create a workflow to define multi-step signing processes.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {workflows.map(wf => (
                    <div
                      key={wf.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedWorkflow(wf as WorkflowDetail); setDetailOpen(true); }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${wf.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          <div>
                            <h4 className="font-medium">{wf.name}</h4>
                            {wf.description && <p className="text-sm text-muted-foreground">{wf.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={wf.isActive ? 'default' : 'secondary'}>
                            {wf.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline">{wf.steps.length} steps</Badge>
                          <Badge variant="outline">{wf.documentCount} docs</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mt-3 overflow-x-auto">
                        {wf.steps.map((step, i) => (
                          <div key={step.id} className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              {step.order}. {step.user.name}
                            </Badge>
                            {i < wf.steps.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Workflow Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Create Signature Workflow</DialogTitle>
            <DialogDescription>
              Define the signing order. Each step user will be notified when it's their turn.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Workflow Name *</Label>
                <Input
                  placeholder="e.g. Contract Approval Flow"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input
                  placeholder="Optional description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Signing Steps</Label>
                  <Button size="sm" variant="outline" onClick={addStep}>
                    <Plus className="w-3 h-3 mr-1" /> Add Step
                  </Button>
                </div>
                {newSteps.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                    <ArrowDown className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click "Add Step" to define the signing order</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {newSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            disabled={i === 0}
                            onClick={() => moveStep(i, 'up')}
                            aria-label="Move step up"
                          >
                            <GripVertical className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            disabled={i === newSteps.length - 1}
                            onClick={() => moveStep(i, 'down')}
                            aria-label="Move step down"
                          >
                            <GripVertical className="w-3 h-3" />
                          </Button>
                        </div>
                        <Badge variant="secondary" className="shrink-0 w-7 h-7 flex items-center justify-center">
                          {i + 1}
                        </Badge>
                        <Input
                          placeholder="Step name"
                          value={step.name}
                          onChange={(e) => updateStep(i, 'name', e.target.value)}
                          className="flex-1"
                        />
                        <Select value={step.stepType} onValueChange={(v) => updateStep(i, 'stepType', v)}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sign">Sign</SelectItem>
                            <SelectItem value="approve">Approve</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="cc">CC Only</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={step.userId} onValueChange={(v) => updateStep(i, 'userId', v)}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select member" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map(m => (
                              <SelectItem key={m.user.id} value={m.user.id}>
                                {m.user.name} ({m.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive"
                          onClick={() => removeStep(i)}
                          aria-label="Remove step"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          {selectedWorkflow && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedWorkflow.name}
                  <Badge variant={selectedWorkflow.isActive ? 'default' : 'secondary'}>
                    {selectedWorkflow.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{selectedWorkflow.description || 'No description'}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[50vh] pr-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Signing Steps ({selectedWorkflow.steps.length})</Label>
                    <div className="mt-2 space-y-2">
                      {selectedWorkflow.steps.map((step, i) => (
                        <div key={step.id} className="flex items-center gap-3 p-3 border rounded-lg">
                          <Badge variant="secondary" className="shrink-0">
                            {step.order}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{step.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {step.user.name} ({step.user.email})
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">{step.stepType}</Badge>
                          {i < selectedWorkflow.steps.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedWorkflow.documents.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-sm font-medium">
                          Recent Documents ({selectedWorkflow.documents.length})
                        </Label>
                        <div className="mt-2 space-y-1">
                          {selectedWorkflow.documents.map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-2 text-sm border rounded">
                              <span>{doc.title}</span>
                              <Badge variant="outline" className="text-xs">{doc.status}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                {canManage && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(selectedWorkflow)}
                    >
                      {selectedWorkflow.isActive ? (
                        <><Pause className="w-3 h-3 mr-1" /> Deactivate</>
                      ) : (
                        <><Play className="w-3 h-3 mr-1" /> Activate</>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(selectedWorkflow)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
