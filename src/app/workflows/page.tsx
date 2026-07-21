'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Plus, Trash2, ArrowLeft, Loader2, Save, Workflow, LayoutGrid,
  CheckCircle2, GitBranch, Zap, FileText, Users, Eye, Play, Pause,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { workflowsApi, orgApi, type OrgMember } from '@/lib/api';
import { WorkflowCanvas } from '@/components/workflows/workflow-canvas';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  steps: any[];
  edges: any[];
  usageCount: number;
}

const TEMPLATE_CATEGORIES = [
  { value: 'all', label: 'All Templates' },
  { value: 'general', label: 'General' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finance' },
  { value: 'legal', label: 'Legal' },
  { value: 'sales', label: 'Sales' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  general: <FileText className="w-5 h-5" />,
  hr: <Users className="w-5 h-5" />,
  finance: <Zap className="w-5 h-5" />,
  legal: <CheckCircle2 className="w-5 h-5" />,
  sales: <GitBranch className="w-5 h-5" />,
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>('');
  const [orgRole, setOrgRole] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [createFromTemplateOpen, setCreateFromTemplateOpen] = useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false);
  const [templateCategory, setTemplateCategory] = useState('all');
  const [workflowName, setWorkflowName] = useState('');

  const canManage = orgRole === 'owner' || orgRole === 'admin';

  useEffect(() => { setMounted(true); }, []);

  // Load initial data
  useEffect(() => {
    const storedOrg = localStorage.getItem('selectedOrg');
    if (storedOrg) {
      const parsed = JSON.parse(storedOrg);
      setOrgId(parsed.id);
      setOrgRole(parsed.role);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [wfList, memList, tplList] = await Promise.all([
        workflowsApi.list(orgId),
        orgApi.listMembers(orgId),
        fetch('/api/workflows/templates').then(r => r.json()),
      ]);
      setWorkflows(wfList);
      setMembers(memList);
      setTemplates(Array.isArray(tplList) ? tplList : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !workflowName.trim()) {
      toast.error('Please enter a workflow name');
      return;
    }
    setCreatingFromTemplate(true);
    try {
      const res = await fetch('/api/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          orgId,
          workflowName: workflowName.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create workflow');
      }
      toast.success('Workflow created from template!');
      setCreateFromTemplateOpen(false);
      setSelectedTemplate(null);
      setWorkflowName('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create workflow');
    } finally {
      setCreatingFromTemplate(false);
    }
  };

  const filteredTemplates = templates.filter(
    t => templateCategory === 'all' || t.category === templateCategory
  );

  if (loading || !mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Workflow className="w-5 h-5" />
                Workflow Builder
              </h1>
              <p className="text-sm text-muted-foreground">
                Design and manage document signing workflows
              </p>
            </div>
            {canManage && (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setCreateFromTemplateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  From Template
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Templates Section */}
        {templates.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Workflow Templates</CardTitle>
                <CardDescription>Start with a pre-built workflow template</CardDescription>
              </div>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredTemplates.map(template => (
                  <div
                    key={template.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setWorkflowName(template.name);
                      setCreateFromTemplateOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {CATEGORY_ICONS[template.category] || <FileText className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{template.name}</h4>
                        <Badge variant="secondary" className="text-xs">{template.category}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{template.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{template.steps.length} nodes</span>
                      <span>{template.usageCount} uses</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workflows Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Workflows</CardTitle>
            <CardDescription>Manage your organization's signing workflows</CardDescription>
          </CardHeader>
          <CardContent>
            {workflows.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Workflow className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No workflows yet</p>
                <p className="text-sm mt-1">Create a workflow from a template or build one from scratch</p>
                {canManage && (
                  <Button className="mt-4" onClick={() => setCreateFromTemplateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Workflow
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {workflows.map(wf => (
                  <div key={wf.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-muted/20">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${wf.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        <div>
                          <h4 className="font-medium">{wf.name}</h4>
                          {wf.description && <p className="text-sm text-muted-foreground">{wf.description}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={wf.isActive ? 'default' : 'secondary'}>
                          {wf.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">{wf.steps.length} nodes</Badge>
                        <Badge variant="outline">{wf.documentCount} docs</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/workflows/${wf.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                    {/* Show canvas preview if has positions */}
                    {wf.steps.some((s: any) => s.x || s.y) ? (
                      <div className="border-t p-2 bg-muted/10">
                        <WorkflowCanvas
                          workflowId={wf.id}
                          initialNodes={wf.steps.map((s: any) => ({
                            id: s.id,
                            type: s.stepType || 'sign',
                            name: s.name,
                            x: s.x || 0,
                            y: s.y || 0,
                            config: s.config || {},
                          }))}
                          initialEdges={wf.edges || []}
                          orgMembers={members.map(m => ({ id: m.user.id, name: m.user.name, email: m.user.email }))}
                          readonly={!canManage}
                        />
                      </div>
                    ) : (
                      <div className="border-t p-3">
                        <div className="flex items-center gap-2 overflow-x-auto">
                          {wf.steps.map((step: any, i: number) => (
                            <React.Fragment key={step.id}>
                              <Badge variant="outline" className="whitespace-nowrap">
                                {step.order}. {step.user?.name || 'Unassigned'}
                              </Badge>
                              {i < wf.steps.length - 1 && (
                                <span className="text-muted-foreground">→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create from Template Dialog */}
      <Dialog open={createFromTemplateOpen} onOpenChange={setCreateFromTemplateOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? `Create "${selectedTemplate.name}" Workflow` : 'Create Workflow from Template'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? 'Name your new workflow based on this template'
                : 'Select a template to start with'
              }
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Workflow Name *</Label>
                <Input
                  placeholder="Enter workflow name"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                />
              </div>
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {CATEGORY_ICONS[selectedTemplate.category] || <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-medium">{selectedTemplate.name}</h4>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedTemplate.steps.length} nodes • {selectedTemplate.edges.length} connections
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedTemplate(template);
                    setWorkflowName(template.name);
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                      {CATEGORY_ICONS[template.category] || <FileText className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{template.name}</h4>
                      <Badge variant="secondary" className="text-xs">{template.category}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateFromTemplateOpen(false); setSelectedTemplate(null); }}>
              Cancel
            </Button>
            {selectedTemplate && (
              <Button onClick={handleCreateFromTemplate} disabled={creatingFromTemplate || !workflowName.trim()}>
                {creatingFromTemplate ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Create Workflow</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
