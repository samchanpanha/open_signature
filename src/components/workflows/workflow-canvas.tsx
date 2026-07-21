'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Plus, Trash2, Save, Loader2, ArrowDown, GitBranch, Zap,
  CheckCircle2, FileText, MessageCircle, Eye, X, Workflow,
  ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, Grid3X3, Map,
} from 'lucide-react';

// Types
interface WorkflowNode {
  id: string;
  type: 'start' | 'end' | 'sign' | 'approve' | 'review' | 'cc' | 'condition' | 'parallel';
  name: string;
  x: number;
  y: number;
  config: {
    userId?: string;
    userName?: string;
    conditionField?: string;
    conditionOperator?: string;
    conditionValue?: string;
    conditionValue2?: string;
    trueLabel?: string;
    falseLabel?: string;
    email?: string;
    timeoutHours?: number;
    required?: boolean;
    description?: string;
    slaHours?: number;
    escalateTo?: string;
    notifyEmail?: boolean;
    notifyTelegram?: boolean;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'default' | 'true' | 'false' | 'parallel';
}

interface WorkflowCanvasProps {
  workflowId?: string;
  initialNodes?: WorkflowNode[];
  initialEdges?: WorkflowEdge[];
  orgMembers?: { id: string; name: string; email: string }[];
  onSave?: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  readonly?: boolean;
}

const NODE_TYPES = [
  { type: 'sign' as const, label: 'Sign', icon: <FileText className="w-4 h-4" />, color: 'bg-emerald-500', borderColor: 'border-emerald-500', description: 'Requires signature' },
  { type: 'approve' as const, label: 'Approve', icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-blue-500', borderColor: 'border-blue-500', description: 'Requires approval' },
  { type: 'review' as const, label: 'Review', icon: <Eye className="w-4 h-4" />, color: 'bg-purple-500', borderColor: 'border-purple-500', description: 'Review only' },
  { type: 'cc' as const, label: 'CC', icon: <MessageCircle className="w-4 h-4" />, color: 'bg-amber-500', borderColor: 'border-amber-500', description: 'Receive copy' },
  { type: 'condition' as const, label: 'Condition', icon: <GitBranch className="w-4 h-4" />, color: 'bg-orange-500', borderColor: 'border-orange-500', description: 'If/else branch' },
  { type: 'parallel' as const, label: 'Parallel', icon: <Zap className="w-4 h-4" />, color: 'bg-cyan-500', borderColor: 'border-cyan-500', description: 'Run simultaneously' },
];

const CONDITION_FIELDS = [
  { value: 'amount', label: 'Document Amount', type: 'number' },
  { value: 'department', label: 'Department', type: 'string' },
  { value: 'signer_count', label: 'Number of Signers', type: 'number' },
  { value: 'document_type', label: 'Document Type', type: 'string' },
  { value: 'custom_field', label: 'Custom Field', type: 'string' },
  { value: 'document_title', label: 'Document Title', type: 'string' },
  { value: 'date_created', label: 'Date Created', type: 'date' },
  { value: 'priority', label: 'Priority Level', type: 'string' },
  { value: 'region', label: 'Region', type: 'string' },
  { value: 'contract_value', label: 'Contract Value', type: 'number' },
];

const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals', types: ['string', 'number', 'date'] },
  { value: 'not_equals', label: 'Not Equals', types: ['string', 'number', 'date'] },
  { value: '>', label: 'Greater Than', types: ['number', 'date'] },
  { value: '<', label: 'Less Than', types: ['number', 'date'] },
  { value: '>=', label: 'Greater or Equal', types: ['number', 'date'] },
  { value: '<=', label: 'Less or Equal', types: ['number', 'date'] },
  { value: 'contains', label: 'Contains', types: ['string'] },
  { value: 'not_contains', label: 'Does Not Contain', types: ['string'] },
  { value: 'starts_with', label: 'Starts With', types: ['string'] },
  { value: 'ends_with', label: 'Ends With', types: ['string'] },
  { value: 'is_empty', label: 'Is Empty', types: ['string', 'number'] },
  { value: 'is_not_empty', label: 'Is Not Empty', types: ['string', 'number'] },
  { value: 'between', label: 'Between', types: ['number'] },
];

export function WorkflowCanvas({
  workflowId,
  initialNodes = [],
  initialEdges = [],
  orgMembers = [],
  onSave,
  readonly = false,
}: WorkflowCanvasProps) {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes.length > 0 ? initialNodes : [
    { id: 'start', type: 'start', name: 'Start', x: 300, y: 50, config: {} },
  ]);
  const [edges, setEdges] = useState<WorkflowEdge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{ from: string; type: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);
  const [history, setHistory] = useState<{ nodes: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [conditionLogicMode, setConditionLogicMode] = useState<'simple' | 'compound'>('simple');
  const [compoundConditions, setCompoundConditions] = useState<Array<{ field: string; operator: string; value: string; logic: 'AND' | 'OR' }>>([]);

  // Initialize with start/end nodes if empty
  useEffect(() => {
    if (initialNodes.length === 0 && nodes.length === 1) {
      const endNode: WorkflowNode = {
        id: 'end',
        type: 'end',
        name: 'End',
        x: 300,
        y: 500,
        config: {},
      };
      setNodes(prev => [...prev, endNode]);
      setEdges(prev => [...prev, {
        id: 'edge-start-end',
        source: 'start',
        target: 'end',
        type: 'default',
      }]);
    }
  }, []);

  const addNode = useCallback((type: WorkflowNode['type'], x?: number, y?: number) => {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const typeInfo = NODE_TYPES.find(t => t.type === type);
    const newNode: WorkflowNode = {
      id,
      type,
      name: typeInfo?.label || type,
      x: x ?? 300,
      y: y ?? 250,
      config: {},
    };
    setNodes(prev => [...prev, newNode]);
    setShowNodeMenu(false);
    return id;
  }, []);

  // History (undo/redo)
  const pushHistory = useCallback(() => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [nodes, edges, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setHistoryIndex(prev => prev - 1);
    toast.info('Undo');
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setNodes(next.nodes);
    setEdges(next.edges);
    setHistoryIndex(prev => prev + 1);
    toast.info('Redo');
  }, [history, historyIndex]);

  const deleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'start' || nodeId === 'end') return;
    pushHistory();
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [selectedNode, pushHistory]);

  const updateNode = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, ...updates } : n));
  }, []);

  const updateNodeConfig = useCallback((nodeId: string, configUpdates: Partial<WorkflowNode['config']>) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, config: { ...n.config, ...configUpdates } } : n));
  }, []);

  const addEdge = useCallback((source: string, target: string, type: WorkflowEdge['type'] = 'default', label?: string) => {
    // Prevent duplicate edges
    const exists = edges.some(e => e.source === source && e.target === target);
    if (exists) return;

    const id = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setEdges(prev => [...prev, { id, source, target, type, label }]);
  }, [edges]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  }, []);

  const autoLayout = useCallback(() => {
    const startNode = nodes.find(n => n.type === 'start');
    if (!startNode) return;

    // BFS to assign positions
    const visited = new Set<string>();
    const queue: { id: string; x: number; y: number }[] = [{ id: startNode.id, x: 300, y: 50 }];
    const positions: Record<string, { x: number; y: number }> = {};
    const levelWidth = 200;
    const levelHeight = 120;

    while (queue.length > 0) {
      const { id, x, y } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      positions[id] = { x, y };

      const outgoing = edges.filter(e => e.source === id);
      const children = [...new Set(outgoing.map(e => e.target))].filter(t => !visited.has(t));

      children.forEach((childId, index) => {
        const childX = x + (index - (children.length - 1) / 2) * levelWidth;
        const childY = y + levelHeight;
        queue.push({ id: childId, x: childX, y: childY });
      });
    }

    // Position unvisited nodes
    let maxY = Math.max(...Object.values(positions).map(p => p.y), 0);
    nodes.forEach(n => {
      if (!positions[n.id]) {
        maxY += levelHeight;
        positions[n.id] = { x: 300, y: maxY };
      }
    });

    setNodes(prev => prev.map(n => ({
      ...n,
      x: positions[n.id]?.x ?? n.x,
      y: positions[n.id]?.y ?? n.y,
    })));
  }, [nodes, edges]);

  // Mouse handlers for drag
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if (readonly) return;
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setSelectedNode(nodeId);
    setDraggingNode(nodeId);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - node.x,
        y: e.clientY - rect.top - node.y,
      });
    }
  }, [nodes, readonly]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - dragOffset.x);
    const y = Math.max(0, e.clientY - rect.top - dragOffset.y);
    updateNode(draggingNode, { x, y });
  }, [draggingNode, dragOffset, updateNode]);

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
      setSelectedNode(null);
      setConnecting(null);
    }
  }, []);

  const startConnecting = useCallback((nodeId: string, edgeType: string) => {
    setConnecting({ from: nodeId, type: edgeType });
  }, []);

  const finishConnecting = useCallback((targetId: string) => {
    if (!connecting) return;
    if (connecting.from === targetId) {
      setConnecting(null);
      return;
    }

    const sourceNode = nodes.find(n => n.id === connecting.from);
    if (!sourceNode) {
      setConnecting(null);
      return;
    }

    const edgeType = connecting.type as WorkflowEdge['type'];
    let label: string | undefined;

    if (sourceNode.type === 'condition') {
      if (edgeType === 'true') label = sourceNode.config.trueLabel || 'Yes';
      else if (edgeType === 'false') label = sourceNode.config.falseLabel || 'No';
    }

    addEdge(connecting.from, targetId, edgeType, label);
    setConnecting(null);
  }, [connecting, nodes, addEdge]);

  const renderEdge = useCallback((edge: WorkflowEdge) => {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);
    if (!source || !target) return null;

    const x1 = source.x + 60;
    const y1 = source.y + 30;
    const x2 = target.x + 60;
    const y2 = target.y;

    const midY = (y1 + y2) / 2;

    const strokeColor = edge.type === 'true' ? '#10b981' : edge.type === 'false' ? '#ef4444' : '#6b7280';

    return (
      <g key={edge.id}>
        <path
          d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          markerEnd="url(#arrowhead)"
          className="cursor-pointer hover:stroke-width-3"
          onClick={() => !readonly && deleteEdge(edge.id)}
        />
        {edge.label && (
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 8}
            textAnchor="middle"
            fill={strokeColor}
            fontSize={12}
            fontWeight={500}
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  }, [nodes, readonly, deleteEdge]);

  const renderNode = useCallback((node: WorkflowNode) => {
    const isSelected = selectedNode === node.id;
    const typeInfo = NODE_TYPES.find(t => t.type === node.type);

    const width = node.type === 'condition' ? 160 : 120;
    const height = node.type === 'condition' ? 80 : 60;
    const radius = node.type === 'start' || node.type === 'end' ? 30 : 8;

    const fillColor = node.type === 'start' ? '#10b981' : node.type === 'end' ? '#ef4444' : typeInfo?.color || '#6b7280';
    const textColor = 'white';

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        className={`cursor-move ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
        onMouseDown={(e) => handleMouseDown(e, node.id)}
      >
        {/* Node shape */}
        {node.type === 'condition' ? (
          <g transform={`translate(${width/2}, 0) rotate(45, ${width/2}, ${height/2})`}>
            <rect
              x={0} y={0}
              width={height} height={height}
              fill={fillColor}
              rx={4}
              stroke={isSelected ? '#3b82f6' : 'transparent'}
              strokeWidth={2}
            />
          </g>
        ) : node.type === 'start' || node.type === 'end' ? (
          <circle
            cx={width/2} cy={height/2} r={30}
            fill={fillColor}
            stroke={isSelected ? '#3b82f6' : 'transparent'}
            strokeWidth={2}
          />
        ) : (
          <rect
            x={0} y={0}
            width={width} height={height}
            fill={fillColor}
            rx={radius}
            stroke={isSelected ? '#3b82f6' : 'transparent'}
            strokeWidth={2}
          />
        )}

        {/* Node label */}
        <text
          x={node.type === 'condition' ? width/2 : width/2}
          y={node.type === 'condition' ? height/2 : height/2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={12}
          fontWeight={600}
        >
          {node.name}
        </text>

        {/* User label */}
        {node.config.userName && (
          <text
            x={width/2}
            y={height + 16}
            textAnchor="middle"
            fill="#6b7280"
            fontSize={10}
          >
            {node.config.userName}
          </text>
        )}

        {/* Connection points */}
        {!readonly && (
          <>
            {/* Input point */}
            {node.type !== 'start' && (
              <circle
                cx={width/2} cy={-4} r={6}
                fill="white"
                stroke="#6b7280"
                strokeWidth={2}
                className="cursor-pointer hover:fill-blue-500"
                onClick={(e) => {
                  e.stopPropagation();
                  finishConnecting(node.id);
                }}
              />
            )}
            {/* Output points */}
            {node.type !== 'end' && (
              <>
                {node.type === 'condition' ? (
                  <>
                    <circle
                      cx={width + 10} cy={height/2} r={6}
                      fill="#10b981"
                      stroke="white"
                      strokeWidth={2}
                      className="cursor-pointer hover:fill-green-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        startConnecting(node.id, 'true');
                      }}
                    />
                    <text x={width + 24} y={height/2 + 4} fill="#10b981" fontSize={10}>Yes</text>
                    <circle
                      cx={width/2} cy={height + 10} r={6}
                      fill="#ef4444"
                      stroke="white"
                      strokeWidth={2}
                      className="cursor-pointer hover:fill-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        startConnecting(node.id, 'false');
                      }}
                    />
                    <text x={width/2 + 14} y={height + 14} fill="#ef4444" fontSize={10}>No</text>
                  </>
                ) : (
                  <circle
                    cx={width/2} cy={height + 4} r={6}
                    fill="white"
                    stroke="#6b7280"
                    strokeWidth={2}
                    className="cursor-pointer hover:fill-blue-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      startConnecting(node.id, 'default');
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </g>
    );
  }, [selectedNode, readonly, handleMouseDown, startConnecting, finishConnecting]);

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(nodes, edges);
      toast.success('Workflow saved');
    } catch {
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, onSave]);

  // Zoom controls
  const zoomIn = useCallback(() => setZoom(z => Math.min(z + 0.1, 2)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 0.1, 0.3)), []);
  const resetZoom = useCallback(() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
        if (e.key === '=') { e.preventDefault(); zoomIn(); }
        if (e.key === '-') { e.preventDefault(); zoomOut(); }
        if (e.key === '0') { e.preventDefault(); resetZoom(); }
      }
      if (e.key === 'Delete' && selectedNode && selectedNode !== 'start' && selectedNode !== 'end') {
        pushHistory();
        deleteNode(selectedNode);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, zoomIn, zoomOut, resetZoom, selectedNode, deleteNode, pushHistory]);

  // Pan handling
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(z => Math.min(Math.max(z + delta, 0.3), 2));
    }
  }, []);



  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden bg-white dark:bg-gray-950">
      {/* Sidebar - Node Palette */}
      {!readonly && (
        <div className="w-56 border-r bg-muted/30 p-3 space-y-3 overflow-y-auto">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Workflow className="w-4 h-4" />
            Components
          </h3>
          <div className="space-y-2">
            {NODE_TYPES.map((type) => (
              <button
                key={type.type}
                onClick={() => {
                  pushHistory();
                  const id = addNode(type.type, 300, 250);
                  const nearest = nodes.reduce((closest, n) => {
                    const dist = Math.abs(n.x - 300) + Math.abs(n.y - 250);
                    return dist < closest.dist ? { id: n.id, dist } : closest;
                  }, { id: '', dist: Infinity });
                  if (nearest.id) {
                    addEdge(nearest.id, id, 'default');
                  }
                }}
                className="w-full text-left px-3 py-2 rounded-lg border bg-background hover:bg-accent transition-colors flex items-center gap-2"
              >
                <div className={`w-6 h-6 rounded ${type.color} flex items-center justify-center text-white`}>
                  {type.icon}
                </div>
                <div>
                  <p className="text-xs font-medium">{type.label}</p>
                  <p className="text-[10px] text-muted-foreground">{type.description}</p>
                </div>
              </button>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <Button variant="outline" size="sm" className="w-full" onClick={() => { pushHistory(); autoLayout(); }}>
              <ArrowDown className="w-3 h-3 mr-1" />
              Auto Layout
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              pushHistory();
              const parallelId = addNode('parallel', 300, 200);
              const sign1 = addNode('sign', 150, 320);
              const sign2 = addNode('sign', 450, 320);
              addEdge(parallelId, sign1, 'parallel');
              addEdge(parallelId, sign2, 'parallel');
              addEdge(sign1, 'end', 'default');
              addEdge(sign2, 'end', 'default');
            }}>
              <Zap className="w-3 h-3 mr-1" />
              Add Parallel
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => {
              pushHistory();
              const condId = addNode('condition', 300, 200);
              const sign1 = addNode('sign', 150, 320);
              const sign2 = addNode('sign', 450, 320);
              addEdge(condId, sign1, 'true', 'Yes');
              addEdge(condId, sign2, 'false', 'No');
              addEdge(sign1, 'end', 'default');
              addEdge(sign2, 'end', 'default');
            }}>
              <GitBranch className="w-3 h-3 mr-1" />
              Add Condition
            </Button>
          </div>

          <Separator />

          {/* Zoom & View Controls */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">View</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={zoomOut}>
                <ZoomOut className="w-3 h-3" />
              </Button>
              <div className="flex-1 text-center text-xs font-mono">{Math.round(zoom * 100)}%</div>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={zoomIn}>
                <ZoomIn className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={resetZoom}>
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={undo} disabled={historyIndex <= 0}>
                <Undo2 className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={redo} disabled={historyIndex >= history.length - 1}>
                <Redo2 className="w-3 h-3" />
              </Button>
              <Button variant={showGrid ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => setShowGrid(!showGrid)}>
                <Grid3X3 className="w-3 h-3" />
              </Button>
              <Button variant={showMinimap ? 'default' : 'outline'} size="icon" className="h-7 w-7" onClick={() => setShowMinimap(!showMinimap)}>
                <Map className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{nodes.length} nodes, {edges.length} edges</p>
            <p>{nodes.filter(n => n.type === 'condition').length} conditions</p>
            <p className="text-[10px] opacity-60">Ctrl+Z/Y to undo/redo</p>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {/* Zoom toolbar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-background/80 backdrop-blur rounded-lg border p-1 shadow-sm">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut}>
            <ZoomOut className="w-3 h-3" />
          </Button>
          <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn}>
            <ZoomIn className="w-3 h-3" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetZoom}>
            <Maximize2 className="w-3 h-3" />
          </Button>
          {!readonly && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={undo} disabled={historyIndex <= 0}>
                <Undo2 className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={redo} disabled={historyIndex >= history.length - 1}>
                <Redo2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>

        {/* Minimap */}
        {showMinimap && (
          <div className="absolute top-3 right-3 z-10 w-48 h-32 bg-background/90 backdrop-blur rounded-lg border shadow-sm overflow-hidden">
            <div className="p-1 border-b flex items-center justify-between">
              <span className="text-[10px] font-medium">Minimap</span>
              <Button variant="ghost" size="icon" className="h-4 w-4" onClick={() => setShowMinimap(false)}>
                <X className="w-2.5 h-2.5" />
              </Button>
            </div>
            <svg className="w-full h-[calc(100%-20px)]" viewBox={`0 0 800 600`}>
              {edges.map(edge => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (!source || !target) return null;
                return (
                  <line key={edge.id} x1={source.x + 60} y1={source.y + 30} x2={target.x + 60} y2={target.y}
                    stroke="#9ca3af" strokeWidth={0.5} />
                );
              })}
              {nodes.map(node => (
                <rect key={node.id} x={node.x} y={node.y} width={120} height={60}
                  fill={node.type === 'start' ? '#10b981' : node.type === 'end' ? '#ef4444' : '#6b7280'}
                  rx={2} opacity={0.8} />
              ))}
            </svg>
          </div>
        )}

        <div
          ref={canvasRef}
          className="w-full h-full canvas-bg relative"
          style={{
            minWidth: 800,
            minHeight: 600,
            background: showGrid ? 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)' : 'transparent',
            backgroundSize: '20px 20px',
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
        >
          {/* SVG layer for edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minWidth: 800, minHeight: 600 }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
            </defs>
            {edges.map(renderEdge)}
            {connecting && (
              <line
                x1={nodes.find(n => n.id === connecting.from)?.x || 0 + 60}
                y1={nodes.find(n => n.id === connecting.from)?.y || 0 + 30}
                x2={nodes.find(n => n.id === connecting.from)?.x || 0 + 60}
                y2={nodes.find(n => n.id === connecting.from)?.y || 0 + 30}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5,5"
              />
            )}
          </svg>

          {/* Node layer */}
          <svg className="absolute inset-0 w-full h-full" style={{ minWidth: 800, minHeight: 600 }}>
            {nodes.map(renderNode)}
          </svg>
        </div>
      </div>

      {/* Property Panel */}
      {!readonly && selectedNodeData && (
        <div className="w-72 border-l bg-background p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Node Properties</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Name</label>
              <Input
                value={selectedNodeData.name}
                onChange={(e) => updateNode(selectedNodeData.id, { name: e.target.value })}
              />
            </div>

            {selectedNodeData.type !== 'start' && selectedNodeData.type !== 'end' && (
              <div className="space-y-2">
                <label className="text-xs font-medium">Type</label>
                <Select
                  value={selectedNodeData.type}
                  onValueChange={(v) => updateNode(selectedNodeData.id, { type: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NODE_TYPES.map(t => (
                      <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(selectedNodeData.type === 'sign' || selectedNodeData.type === 'approve' || selectedNodeData.type === 'review' || selectedNodeData.type === 'cc') && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Assign To</label>
                  <Select
                    value={selectedNodeData.config.userId || ''}
                    onValueChange={(v) => {
                      const member = orgMembers.find(m => m.id === v);
                      updateNodeConfig(selectedNodeData.id, { userId: v, userName: member?.name });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>
                      {orgMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name} ({m.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Email (optional)</label>
                  <Input
                    placeholder="external@email.com"
                    value={selectedNodeData.config.email || ''}
                    onChange={(e) => updateNodeConfig(selectedNodeData.id, { email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Description</label>
                  <Input
                    placeholder="Instructions for this step"
                    value={selectedNodeData.config.description || ''}
                    onChange={(e) => updateNodeConfig(selectedNodeData.id, { description: e.target.value })}
                  />
                </div>
                <Separator />
                <p className="text-[10px] font-medium text-muted-foreground uppercase">SLA & Timeout</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Timeout (hours)</label>
                    <Input
                      type="number"
                      min={1}
                      value={selectedNodeData.config.timeoutHours || 72}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, { timeoutHours: parseInt(e.target.value) || 72 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">SLA (hours)</label>
                    <Input
                      type="number"
                      min={0}
                      value={selectedNodeData.config.slaHours || 0}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, { slaHours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Escalate To</label>
                  <Select
                    value={selectedNodeData.config.escalateTo || ''}
                    onValueChange={(v) => updateNodeConfig(selectedNodeData.id, { escalateTo: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    <SelectContent>
                      {orgMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <p className="text-[10px] font-medium text-muted-foreground uppercase">Notifications</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Email Notification</span>
                  <Switch
                    checked={selectedNodeData.config.notifyEmail !== false}
                    onCheckedChange={(v) => updateNodeConfig(selectedNodeData.id, { notifyEmail: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Telegram Notification</span>
                  <Switch
                    checked={selectedNodeData.config.notifyTelegram || false}
                    onCheckedChange={(v) => updateNodeConfig(selectedNodeData.id, { notifyTelegram: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Required</span>
                  <Switch
                    checked={selectedNodeData.config.required !== false}
                    onCheckedChange={(v) => updateNodeConfig(selectedNodeData.id, { required: v })}
                  />
                </div>
              </>
            )}

            {selectedNodeData.type === 'condition' && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Condition Mode</label>
                  <Select value={conditionLogicMode} onValueChange={(v) => setConditionLogicMode(v as 'simple' | 'compound')}>
                    <SelectTrigger className="w-24 h-7"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="compound">Compound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {conditionLogicMode === 'simple' ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Field</label>
                      <Select
                        value={selectedNodeData.config.conditionField || ''}
                        onValueChange={(v) => updateNodeConfig(selectedNodeData.id, { conditionField: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                        <SelectContent>
                          {CONDITION_FIELDS.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Operator</label>
                      <Select
                        value={selectedNodeData.config.conditionOperator || ''}
                        onValueChange={(v) => updateNodeConfig(selectedNodeData.id, { conditionOperator: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPERATORS.map(op => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedNodeData.config.conditionOperator !== 'is_empty' && selectedNodeData.config.conditionOperator !== 'is_not_empty' && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Value</label>
                        <Input
                          placeholder={selectedNodeData.config.conditionOperator === 'between' ? 'From value' : 'Comparison value'}
                          value={selectedNodeData.config.conditionValue || ''}
                          onChange={(e) => updateNodeConfig(selectedNodeData.id, { conditionValue: e.target.value })}
                        />
                      </div>
                    )}
                    {selectedNodeData.config.conditionOperator === 'between' && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium">To Value</label>
                        <Input
                          placeholder="To value"
                          value={selectedNodeData.config.conditionValue2 || ''}
                          onChange={(e) => updateNodeConfig(selectedNodeData.id, { conditionValue2: e.target.value })}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Compound Conditions</label>
                    {compoundConditions.map((cond, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-xs">
                        {idx > 0 && (
                          <Select value={cond.logic} onValueChange={(v) => {
                            const updated = [...compoundConditions];
                            updated[idx] = { ...updated[idx], logic: v as 'AND' | 'OR' };
                            setCompoundConditions(updated);
                          }}>
                            <SelectTrigger className="w-12 h-6"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="AND">AND</SelectItem>
                              <SelectItem value="OR">OR</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        <Select value={cond.field} onValueChange={(v) => {
                          const updated = [...compoundConditions];
                          updated[idx] = { ...updated[idx], field: v };
                          setCompoundConditions(updated);
                        }}>
                          <SelectTrigger className="h-6"><SelectValue placeholder="Field" /></SelectTrigger>
                          <SelectContent>
                            {CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={cond.operator} onValueChange={(v) => {
                          const updated = [...compoundConditions];
                          updated[idx] = { ...updated[idx], operator: v };
                          setCompoundConditions(updated);
                        }}>
                          <SelectTrigger className="w-20 h-6"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONDITION_OPERATORS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input className="h-6 flex-1" value={cond.value} onChange={(e) => {
                          const updated = [...compoundConditions];
                          updated[idx] = { ...updated[idx], value: e.target.value };
                          setCompoundConditions(updated);
                        }} />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                          setCompoundConditions(prev => prev.filter((_, i) => i !== idx));
                        }}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => {
                      setCompoundConditions(prev => [...prev, { field: '', operator: 'equals', value: '', logic: 'AND' }]);
                    }}>
                      <Plus className="w-3 h-3 mr-1" /> Add Condition
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-emerald-600">Yes Label</label>
                    <Input
                      value={selectedNodeData.config.trueLabel || 'Yes'}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, { trueLabel: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-red-600">No Label</label>
                    <Input
                      value={selectedNodeData.config.falseLabel || 'No'}
                      onChange={(e) => updateNodeConfig(selectedNodeData.id, { falseLabel: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {selectedNodeData.id !== 'start' && selectedNodeData.id !== 'end' && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => deleteNode(selectedNodeData.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Node
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Save button */}
      {!readonly && onSave && (
        <div className="absolute bottom-4 right-4">
          <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white shadow-lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Workflow
          </Button>
        </div>
      )}
    </div>
  );
}
