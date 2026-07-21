'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Loader2, Workflow, Play, Pause, Trash2,
  FileText, BarChart3,
  Clock, CheckCircle2, XCircle, TrendingUp, History, Plus,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import { workflowsApi, orgApi, type OrgMember } from '@/lib/api';
import { WorkflowCanvas } from '@/components/workflows/workflow-canvas';

export default function WorkflowDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;

  const [mounted, setMounted] = useState(false);
  const [workflow, setWorkflow] = useState<any>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string>('');

  useEffect(() => { setMounted(true); }, []);
  const [orgRole, setOrgRole] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [activeView, setActiveView] = useState('canvas');
  const [analytics, setAnalytics] = useState<any>(null);
  const [versions, setVersions] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const canManage = orgRole === 'owner' || orgRole === 'admin';

  useEffect(() => {
    const storedOrg = localStorage.getItem('selectedOrg');
    if (storedOrg) {
      const parsed = JSON.parse(storedOrg);
      setOrgId(parsed.id);
      setOrgRole(parsed.role);
    }
  }, []);

  const loadWorkflow = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      const data = await workflowsApi.get(workflowId);
      setWorkflow(data);
      setEditName(data.name);
      setEditDescription(data.description || '');

      if (data.createdBy) {
        try {
          const storedOrg = localStorage.getItem('selectedOrg');
          if (storedOrg) {
            const parsed = JSON.parse(storedOrg);
            const memList = await orgApi.listMembers(parsed.id);
            setMembers(memList);
          }
        } catch (e) {
          console.error('Failed to load members:', e);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load workflow');
      router.push('/workflows');
    } finally {
      setLoading(false);
    }
  }, [workflowId, router]);

  useEffect(() => { loadWorkflow(); }, [loadWorkflow]);

  const loadAnalytics = useCallback(async () => {
    if (!workflowId || analytics) return;
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/analytics`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch {
      // Use empty data
    } finally {
      setLoadingAnalytics(false);
    }
  }, [workflowId, analytics]);

  const loadVersions = useCallback(async () => {
    if (!workflowId || versions) return;
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch {
      // Use empty data
    } finally {
      setLoadingVersions(false);
    }
  }, [workflowId, versions]);

  const handleSave = async (nodes: any[], edges: any[]) => {
    if (!canManage) return;
    setSaving(true);
    try {
      await workflowsApi.update(workflowId, {
        name: editName || workflow.name,
        description: editDescription || undefined,
        steps: nodes.map(n => ({
          id: n.id,
          name: n.name,
          stepType: n.type || 'sign',
          userId: n.config?.userId,
          x: n.x,
          y: n.y,
          config: n.config,
          conditionRules: n.type === 'condition' ? {
            field: n.config.conditionField,
            operator: n.config.conditionOperator,
            value: n.config.conditionValue,
            trueLabel: n.config.trueLabel,
            falseLabel: n.config.falseLabel,
          } : null,
        })),
        edges: edges.map(e => ({
          source: e.source,
          target: e.target,
          label: e.label,
          type: e.type,
        })),
      });
      toast.success('Workflow saved!');
      loadWorkflow();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!workflow) return;
    try {
      await workflowsApi.update(workflowId, { isActive: !workflow.isActive });
      toast.success(workflow.isActive ? 'Workflow deactivated' : 'Workflow activated');
      loadWorkflow();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workflow');
    }
  };

  const handleDelete = async () => {
    if (!workflow) return;
    if (!confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return;
    try {
      await workflowsApi.delete(workflowId);
      toast.success('Workflow deleted');
      router.push('/workflows');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workflow');
    }
  };

  const handleCreateVersion = async () => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ label: `Version at ${new Date().toLocaleString()}` }),
      });
      if (res.ok) {
        toast.success('Version created');
        setVersions(null);
        loadVersions();
      } else {
        toast.error('Failed to create version');
      }
    } catch {
      toast.error('Failed to create version');
    }
  };

  const exportWorkflow = () => {
    if (!workflow) return;
    const exportData = {
      name: workflow.name,
      description: workflow.description,
      steps: workflow.steps,
      edges: workflow.edges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${workflow.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workflow exported');
  };

  if (loading || !mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Workflow not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/workflows')}>
            Back to Workflows
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-muted/30">
        <div className="max-w-full mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push('/workflows')}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${workflow.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                <div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 w-64 font-medium"
                        placeholder="Workflow name"
                      />
                    </div>
                  ) : (
                    <h1 className="text-lg font-bold">{workflow.name}</h1>
                  )}
                  {canManage ? (
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="h-6 text-xs text-muted-foreground w-64"
                      placeholder="Description (optional)"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{workflow.description || 'No description'}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                {workflow.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="outline">{workflow.steps.length} nodes</Badge>
              <Button variant="ghost" size="sm" onClick={exportWorkflow}>
                <Download className="w-3 h-3 mr-1" /> Export
              </Button>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={handleToggleActive}>
                    {workflow.isActive ? (
                      <><Pause className="w-3 h-3 mr-1" /> Deactivate</>
                    ) : (
                      <><Play className="w-3 h-3 mr-1" /> Activate</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content with tabs */}
      <div className="flex-1 flex flex-col">
        <Tabs value={activeView} onValueChange={(v) => {
          setActiveView(v);
          if (v === 'analytics') loadAnalytics();
          if (v === 'versions') loadVersions();
        }} className="flex-1 flex flex-col">
          <div className="border-b px-6">
            <TabsList className="h-10">
              <TabsTrigger value="canvas" className="text-sm">
                <Workflow className="w-3.5 h-3.5 mr-1.5" /> Canvas
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-sm">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Analytics
              </TabsTrigger>
              <TabsTrigger value="versions" className="text-sm">
                <History className="w-3.5 h-3.5 mr-1.5" /> Versions
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-sm">
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Documents
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="canvas" className="flex-1 p-6 mt-0">
            <WorkflowCanvas
              workflowId={workflowId}
              initialNodes={workflow.steps.map((s: any) => ({
                id: s.id,
                type: s.stepType || 'sign',
                name: s.name,
                x: s.positionX || 0,
                y: s.positionY || 0,
                config: s.config || {},
              }))}
              initialEdges={workflow.edges || []}
              orgMembers={members.map(m => ({ id: m.user.id, name: m.user.name, email: m.user.email }))}
              onSave={handleSave}
              readonly={!canManage}
            />
          </TabsContent>

          <TabsContent value="analytics" className="flex-1 p-6 mt-0 overflow-auto">
            {loadingAnalytics ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : analytics ? (
              <div className="space-y-6 max-w-5xl">
                <div>
                  <h2 className="text-2xl font-bold">Workflow Analytics</h2>
                  <p className="text-muted-foreground text-sm mt-1">Performance metrics for {analytics.workflow.name}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Documents', value: analytics.analytics.totalDocuments, icon: <FileText className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Completed', value: analytics.analytics.completedDocuments, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'Pending', value: analytics.analytics.pendingDocuments, icon: <Clock className="w-5 h-5" />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
                    { label: 'Completion Rate', value: `${analytics.analytics.completionRate}%`, icon: <TrendingUp className="w-5 h-5" />, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
                  ].map(stat => (
                    <Card key={stat.label}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                          </div>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                            {stat.icon}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Status Distribution */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Status Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 h-8">
                      {[
                        { label: 'Completed', count: analytics.analytics.statusDistribution.completed, color: 'bg-emerald-500' },
                        { label: 'Pending', count: analytics.analytics.statusDistribution.pending, color: 'bg-amber-500' },
                        { label: 'Rejected', count: analytics.analytics.statusDistribution.rejected, color: 'bg-red-500' },
                        { label: 'Draft', count: analytics.analytics.statusDistribution.draft, color: 'bg-gray-400' },
                      ].map(status => {
                        const total = analytics.analytics.totalDocuments || 1;
                        const pct = (status.count / total) * 100;
                        return (
                          <div key={status.label} className="flex-1">
                            <div className="h-full rounded-full overflow-hidden bg-muted">
                              <div className={`h-full ${status.color} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{status.label}: {status.count}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Average Time */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Performance</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-3xl font-bold text-emerald-600">{analytics.analytics.avgCompletionTimeHours}h</p>
                        <p className="text-xs text-muted-foreground mt-1">Avg Completion Time</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-3xl font-bold text-blue-600">{analytics.analytics.rejectedDocuments}</p>
                        <p className="text-xs text-muted-foreground mt-1">Rejected Documents</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader><CardTitle className="text-sm">Recent Documents</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analytics.analytics.recentActivity.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No documents yet</p>
                      ) : (
                        analytics.analytics.recentActivity.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{doc.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Badge variant={doc.status === 'Completed' ? 'default' : doc.status === 'Rejected' ? 'destructive' : 'secondary'}>
                              {doc.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No analytics data</p>
                <p className="text-sm mt-1">Analytics will appear once documents are processed through this workflow</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="versions" className="flex-1 p-6 mt-0 overflow-auto">
            {loadingVersions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : versions ? (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Version History</h2>
                    <p className="text-muted-foreground text-sm mt-1">Track changes to this workflow</p>
                  </div>
                  {canManage && (
                    <Button onClick={handleCreateVersion}>
                      <Plus className="w-4 h-4 mr-2" /> Create Version
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {versions.versions.map((version: any) => (
                    <Card key={version.version}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 font-bold">
                              v{version.version}
                            </div>
                            <div>
                              <p className="font-medium">{version.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {version.nodeCount} nodes, {version.edgeCount} edges
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={version.isActive ? 'default' : 'secondary'}>
                              {version.isActive ? 'Current' : 'Historical'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(version.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No versions yet</p>
                <p className="text-sm mt-1">Create a version to track workflow changes</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="flex-1 p-6 mt-0 overflow-auto">
            <div className="space-y-6 max-w-5xl">
              <div>
                <h2 className="text-2xl font-bold">Workflow Documents</h2>
                <p className="text-muted-foreground text-sm mt-1">Documents processed through this workflow</p>
              </div>
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Documents using this workflow will appear here</p>
                  <p className="text-sm mt-1">Send a document through this workflow to see it listed</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
