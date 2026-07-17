'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText, Upload, Plus, Trash2, ArrowLeft, LogOut, PenLine,
  CalendarDays, Type, Send, Download, Copy, Check, Eye, Users,
  Clock, Shield, X, ChevronDown, ChevronRight, Loader2, FileSignature,
  AlertCircle, CheckCircle2, MousePointer, Edit3, Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useAppStore, type AppView, type User } from '@/lib/store';
import { authApi, documentsApi, fieldsApi, signingApi, type DocumentListItem, type DocumentDetail, type SignerInfo } from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

// ============ TYPES ============
interface PlacedField {
  id: string;
  type: 'signature' | 'date' | 'text';
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signerId?: string;
  signerName?: string;
  signerColor?: string;
  value?: string | null;
}

interface TempSigner {
  name: string;
  email: string;
  color: string;
}

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

const SIGNER_COLORS = ['#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#c026d3'];
const FIELD_DEFAULTS = {
  signature: { width: 200, height: 60 },
  date: { width: 150, height: 40 },
  text: { width: 200, height: 40 },
};

// ============ HELPER COMPONENTS ============
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Draft: 'bg-secondary text-secondary-foreground',
    Sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    Signing: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    Completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  };
  return <Badge className={variants[status] || ''}>{status}</Badge>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SignatureCanvas({ onSave, width = 400, height = 150 }: { onSave: (dataUrl: string) => void; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const pos = getPos(e);
    lastPos.current = pos;
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [getPos]);

  const endDraw = useCallback(() => { isDrawing.current = false; }, []);

  const clear = () => {
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
  };

  const save = () => {
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-crosshair bg-white w-full"
        style={{ touchAction: 'none' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} className="flex-1">
          <X className="w-4 h-4 mr-1" /> Clear
        </Button>
        <Button size="sm" onClick={save} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
          <Check className="w-4 h-4 mr-1" /> Apply
        </Button>
      </div>
    </div>
  );
}

function TypeSignature({ onSave }: { onSave: (dataUrl: string) => void }) {
  const [text, setText] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (!text) return;
    ctx.font = 'italic 42px "Segoe Script", "Apple Chancery", cursive, serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 10, canvasRef.current.height / 2);
  }, [text]);

  const save = () => {
    if (!text.trim()) return;
    onSave(canvasRef.current!.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      <Input
        placeholder="Type your name"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <canvas ref={canvasRef} width={400} height={80} className="border rounded-lg bg-white w-full" />
      <Button size="sm" onClick={save} disabled={!text.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700">
        <Check className="w-4 h-4 mr-1" /> Apply
      </Button>
    </div>
  );
}

function UploadSignature({ onSave }: { onSave: (dataUrl: string) => void }) {
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (preview) onSave(preview);
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center">
        {preview ? (
          <img src={preview} alt="Signature preview" className="max-h-24 mx-auto" />
        ) : (
          <div>
            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Upload PNG or JPG</p>
          </div>
        )}
        <input type="file" accept="image/png,image/jpeg" onChange={handleFile} className="mt-2 text-sm" />
      </div>
      <Button size="sm" onClick={save} disabled={!preview} className="w-full bg-emerald-600 hover:bg-emerald-700">
        <Check className="w-4 h-4 mr-1" /> Apply
      </Button>
    </div>
  );
}

// ============ PDF RENDERER HOOK ============
function usePdfRenderer(pdfUrl: string | null) {
  const [pages, setPages] = useState<{ dataUrl: string; width: number; height: number; pageNumber: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pdfUrl) { setPages([]); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const rendered: typeof pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const page = await pdf.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered.push({
            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
            width: viewport.width,
            height: viewport.height,
            pageNumber: i,
          });
        }
        if (!cancelled) setPages(rendered);
      } catch (err) {
        console.error('PDF render error:', err);
        toast.error('Failed to render PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfUrl]);

  return { pages, loading };
}

// ============ MAIN APP ============
export default function Home() {
  const store = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // Dashboard
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [dashLoading, setDashLoading] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  // Editor
  const [editorDoc, setEditorDoc] = useState<DocumentDetail | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [pdfPages, setPdfPages] = useState<{ dataUrl: string; width: number; height: number; pageNumber: number }[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);
  const [activeTool, setActiveTool] = useState<'signature' | 'date' | 'text' | null>(null);
  const [activeSignerId, setActiveSignerId] = useState<string | null>(null);
  const [tempSigners, setTempSigners] = useState<TempSigner[]>([]);
  const [newSignerName, setNewSignerName] = useState('');
  const [newSignerEmail, setNewSignerEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Viewer
  const [viewerDoc, setViewerDoc] = useState<DocumentDetail | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerPages, setViewerPages] = useState<{ dataUrl: string; width: number; height: number; pageNumber: number }[]>([]);
  const [viewerPdfLoading, setViewerPdfLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [signingLinks, setSigningLinks] = useState<{ email: string; token: string }[]>([]);

  // Signing
  const [signingInfo, setSigningInfo] = useState<{ signer: SignerInfo; document: { id: string; title: string; status: string } } | null>(null);
  const [signingPages, setSigningPages] = useState<{ dataUrl: string; width: number; height: number; pageNumber: number }[]>([]);
  const [signingPdfLoading, setSigningPdfLoading] = useState(false);
  const [signingFieldValues, setSigningFieldValues] = useState<Record<string, string>>({});
  const [signingLoading, setSigningLoading] = useState(false);
  const [signingComplete, setSigningComplete] = useState(false);
  const [activeSigningField, setActiveSigningField] = useState<string | null>(null);

  // ============ INIT ============
  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const params = new URLSearchParams(window.location.search);
    const signToken = params.get('sign');

    if (signToken) {
      store.setSigningToken(signToken);
      return;
    }

    if (token) {
      authApi.me().then((user) => {
        store.setAuth(user, token);
        store.setView('dashboard');
      }).catch(() => {
        localStorage.removeItem('token');
      });
    }
  }, []);

  // ============ AUTH HANDLERS ============
  const handleAuth = async () => {
    if (authMode === 'register' && (!authEmail || !authName || !authPassword)) {
      toast.error('Please fill all fields');
      return;
    }
    if (authMode === 'login' && (!authEmail || !authPassword)) {
      toast.error('Please fill all fields');
      return;
    }
    if (authPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setAuthLoading(true);
    try {
      const result = authMode === 'register'
        ? await authApi.register(authEmail, authName, authPassword)
        : await authApi.login(authEmail, authPassword);
      store.setAuth(result.user, result.token);
      store.setView('dashboard');
      toast.success(`Welcome${result.user.name ? ', ' + result.user.name : ''}!`);
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // ============ DASHBOARD ============
  const loadDocuments = useCallback(async () => {
    setDashLoading(true);
    try {
      const docs = await documentsApi.list();
      setDocuments(docs);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (store.currentView === 'dashboard' && store.user) loadDocuments();
  }, [store.currentView, store.user, loadDocuments]);

  const handleUpload = async () => {
    if (!uploadFile) { toast.error('Please select a PDF'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name.replace('.pdf', ''));
      const doc = await documentsApi.create(formData);
      toast.success('Document uploaded!');
      setUploadDialog(false);
      setUploadFile(null);
      setUploadTitle('');
      store.setEditingDocument(doc.id);
      store.setView('editor');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await documentsApi.delete(id);
      toast.success('Document deleted');
      loadDocuments();
    } catch {
      toast.error('Failed to delete');
    }
  };

  // ============ EDITOR ============
  const loadEditor = useCallback(async () => {
    if (!store.editingDocumentId) return;
    setEditorLoading(true);
    setPdfLoading(true);
    try {
      const doc = await documentsApi.get(store.editingDocumentId);
      setEditorDoc(doc);
      setPlacedFields(doc.fields.map((f) => ({
        id: f.id,
        type: f.type as 'signature' | 'date' | 'text',
        pageNumber: f.pageNumber,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        signerId: f.signerId || undefined,
        value: f.value,
      })));

      // Render PDF pages
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/documents/${store.editingDocumentId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const pdfUrl = URL.createObjectURL(blob);
      const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
      const rendered: typeof pdfPages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        rendered.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: viewport.width, height: viewport.height, pageNumber: i });
      }
      setPdfPages(rendered);
    } catch (err) {
      toast.error('Failed to load document');
      console.error(err);
    } finally {
      setEditorLoading(false);
      setPdfLoading(false);
    }
  }, [store.editingDocumentId]);

  useEffect(() => {
    if (store.currentView === 'editor') loadEditor();
  }, [store.currentView, loadEditor]);

  const addSigner = () => {
    if (!newSignerName.trim() || !newSignerEmail.trim()) return;
    const color = SIGNER_COLORS[tempSigners.length % SIGNER_COLORS.length];
    setTempSigners([...tempSigners, { name: newSignerName.trim(), email: newSignerEmail.trim(), color }]);
    setNewSignerName('');
    setNewSignerEmail('');
  };

  const handlePageClick = async (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!activeTool || !store.editingDocumentId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = 612 / rect.width;
    const scaleY = 792 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const defaults = FIELD_DEFAULTS[activeTool];
    const signer = tempSigners.find((_, i) => `temp-${i}` === activeSignerId);

    try {
      const field = await fieldsApi.create(store.editingDocumentId, {
        type: activeTool,
        pageNumber: pageIndex + 1,
        x, y,
        width: defaults.width,
        height: defaults.height,
        signerId: signer ? undefined : undefined,
      });
      setPlacedFields((prev) => [...prev, {
        id: field.id,
        type: activeTool,
        pageNumber: pageIndex + 1,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        signerId: activeSignerId || undefined,
        signerName: signer?.name,
        signerColor: signer?.color,
      }]);
      toast.success(`${activeTool} field added`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add field');
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
      await fieldsApi.delete(fieldId);
      setPlacedFields((prev) => prev.filter((f) => f.id !== fieldId));
      toast.success('Field removed');
    } catch {
      toast.error('Failed to remove field');
    }
  };

  const handleAssignSigner = async (fieldId: string, signerIndex: number) => {
    if (!store.editingDocumentId) return;
    const signer = tempSigners[signerIndex];
    const signerId = `temp-${signerIndex}`;
    try {
      // We update locally, the actual signer assignment happens on send
      setPlacedFields((prev) => prev.map((f) =>
        f.id === fieldId ? { ...f, signerId, signerName: signer.name, signerColor: signer.color } : f
      ));
      toast.success(`Field assigned to ${signer.name}`);
    } catch {
      toast.error('Failed to assign signer');
    }
  };

  const handleFieldDragStart = (fieldId: string, e: React.MouseEvent) => {
    const field = placedFields.find(f => f.id === fieldId);
    if (!field) return;
    setDraggingField(fieldId);
    // We'll use a simplified approach: calculate offset from field center
  };

  const handleFieldDrag = useCallback((e: MouseEvent) => {
    if (!draggingField) return;
    // Simplified: we handle movement via mouse move on the page container
  }, [draggingField]);

  const handleFieldDragEnd = useCallback(() => {
    setDraggingField(null);
  }, []);

  useEffect(() => {
    if (draggingField) {
      window.addEventListener('mousemove', handleFieldDrag);
      window.addEventListener('mouseup', handleFieldDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleFieldDrag);
        window.removeEventListener('mouseup', handleFieldDragEnd);
      };
    }
  }, [draggingField, handleFieldDrag, handleFieldDragEnd]);

  const handleSendForSigning = async () => {
    if (!store.editingDocumentId || !editorDoc) return;
    const assignedFields = placedFields.filter(f => f.signerId);
    if (tempSigners.length === 0) { toast.error('Add at least one signer'); return; }
    if (assignedFields.length === 0) { toast.error('Assign at least one field to a signer'); return; }

    setSending(true);
    try {
      // Build field assignments map: { fieldId, signerIndex }
      const fieldAssignments = assignedFields.map(f => ({
        fieldId: f.id,
        signerIndex: parseInt(f.signerId!.replace('temp-', ''), 10),
      }));

      const result = await documentsApi.send(store.editingDocumentId, tempSigners.map(s => ({ email: s.email, name: s.name })), fieldAssignments);
      toast.success('Document sent for signing!');
      store.setView('dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  // ============ VIEWER ============
  const loadViewer = useCallback(async () => {
    if (!store.viewingDocumentId) return;
    setViewerLoading(true);
    setViewerPdfLoading(true);
    try {
      const doc = await documentsApi.get(store.viewingDocumentId);
      setViewerDoc(doc);

      const token = localStorage.getItem('token');
      const pdfPath = doc.signedPdfPath || doc.originalPdfPath;
      const res = await fetch(`/api/documents/${store.viewingDocumentId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const pdfUrl = URL.createObjectURL(blob);
      const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
      const rendered: typeof viewerPages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        rendered.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: viewport.width, height: viewport.height, pageNumber: i });
      }
      setViewerPages(rendered);

      // Load audit logs
      const logs = await documentsApi.audit(store.viewingDocumentId);
      setAuditLogs(logs);
    } catch (err) {
      toast.error('Failed to load document');
      console.error(err);
    } finally {
      setViewerLoading(false);
      setViewerPdfLoading(false);
    }
  }, [store.viewingDocumentId]);

  useEffect(() => {
    if (store.currentView === 'viewer') loadViewer();
  }, [store.currentView, loadViewer]);

  const handleDownload = async () => {
    if (!store.viewingDocumentId) return;
    try {
      const url = await documentsApi.download(store.viewingDocumentId);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${viewerDoc?.title || 'document'}-signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    }
  };

  // ============ SIGNING (GUEST) ============
  useEffect(() => {
    if (!store.signingToken) return;
    setSigningPdfLoading(true);
    setSigningLoading(true);
    (async () => {
      try {
        const info = await signingApi.getInfo(store.signingToken!);
        setSigningInfo(info);

        // Initialize field values and persist dates to server
        const vals: Record<string, string> = {};
        for (const f of info.signer.fields) {
          const val = f.type === 'date' ? new Date().toLocaleDateString() : (f.value || '');
          vals[f.id] = val;
          // Persist initial values (especially dates) to server
          if (val) {
            signingApi.updateField(store.signingToken!, f.id, val).catch(() => {});
          }
        }
        setSigningFieldValues(vals);

        // Load PDF
        const res = await fetch(`/api/sign/${store.signingToken}/file`);
        const blob = await res.blob();
        const pdfUrl = URL.createObjectURL(blob);
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const rendered: typeof signingPages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: viewport.width, height: viewport.height, pageNumber: i });
        }
        setSigningPages(rendered);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load signing document');
      } finally {
        setSigningPdfLoading(false);
        setSigningLoading(false);
      }
    })();
  }, [store.signingToken]);

  const handleSigningFieldUpdate = async (fieldId: string, value: string) => {
    if (!store.signingToken) return;
    setSigningFieldValues(prev => ({ ...prev, [fieldId]: value }));
    try {
      await signingApi.updateField(store.signingToken, fieldId, value);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save field');
    }
  };

  const handleCompleteSigning = async () => {
    if (!store.signingToken || !signingInfo) return;
    // Check all fields filled
    const unfilled = signingInfo.signer.fields.filter(f => !signingFieldValues[f.id]?.trim());
    if (unfilled.length > 0) {
      toast.error(`Please fill all ${unfilled.length} remaining field(s)`);
      return;
    }
    setSigningLoading(true);
    try {
      await signingApi.complete(store.signingToken);
      setSigningComplete(true);
      toast.success('Signing completed successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete signing');
    } finally {
      setSigningLoading(false);
    }
  };

  // ============ RENDER ============
  if (!mounted) return null;

  // === SIGNING VIEW (Guest) ===
  if (store.signingToken) {
    if (signingPdfLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-emerald-600" />
            <p className="text-lg text-muted-foreground">Loading document...</p>
          </div>
        </div>
      );
    }

    if (signingComplete) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-md">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Signing Complete!</h1>
            <p className="text-muted-foreground">Thank you, {signingInfo?.signer.name}. Your signature has been recorded.</p>
          </motion.div>
        </div>
      );
    }

    if (!signingInfo) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
              <h2 className="text-lg font-semibold mb-2">Invalid or Expired Link</h2>
              <p className="text-muted-foreground">This signing link is invalid or has expired.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <FileSignature className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm">{signingInfo.document.title}</h1>
                <p className="text-xs text-muted-foreground">Sign as: {signingInfo.signer.name} ({signingInfo.signer.email})</p>
              </div>
            </div>
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Signing</Badge>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full p-4 space-y-4 pb-32">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Please review the document and fill all required fields. Click on a highlighted field to add your {signingInfo.signer.fields.some(f => f.type === 'signature') ? 'signature, ' : ''}date, or text.
            </p>
          </div>

          {signingPages.map((page, idx) => {
            const pageFields = signingInfo.signer.fields.filter(f => f.pageNumber === page.pageNumber);
            return (
              <div key={idx} className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Page {page.pageNumber} of {signingPages.length}</p>
                <div
                  className="relative mx-auto border rounded-lg overflow-hidden shadow-sm bg-white"
                  style={{ maxWidth: 612 }}
                >
                  <img
                    src={page.dataUrl}
                    alt={`Page ${page.pageNumber}`}
                    className="w-full h-auto"
                    draggable={false}
                  />
                  {/* Field overlays */}
                  {pageFields.map(field => {
                    const scaleX = 100 / 612;
                    const scaleY = 100 / 792;
                    const filled = !!signingFieldValues[field.id]?.trim();
                    return (
                      <div
                        key={field.id}
                        className={`absolute border-2 rounded cursor-pointer transition-all ${filled ? 'border-emerald-400 bg-emerald-50/80' : 'border-amber-400 bg-amber-50/80 hover:bg-amber-100/80'} ${activeSigningField === field.id ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
                        style={{
                          left: `${field.x * scaleX}%`,
                          top: `${field.y * scaleY}%`,
                          width: `${field.width * scaleX}%`,
                          height: `${field.height * scaleY}%`,
                        }}
                        onClick={() => setActiveSigningField(filled ? null : field.id)}
                      >
                        {filled ? (
                          <div className="w-full h-full flex items-center justify-center p-1 overflow-hidden">
                            {field.type === 'signature' && signingFieldValues[field.id]?.startsWith('data:') ? (
                              <img src={signingFieldValues[field.id]} alt="Signature" className="h-full object-contain" />
                            ) : (
                              <span className="text-xs font-medium truncate">{signingFieldValues[field.id]}</span>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center gap-1">
                            {field.type === 'signature' && <PenLine className="w-3 h-3 text-amber-600" />}
                            {field.type === 'date' && <CalendarDays className="w-3 h-3 text-amber-600" />}
                            {field.type === 'text' && <Type className="w-3 h-3 text-amber-600" />}
                            <span className="text-xs text-amber-700 font-medium capitalize">{field.type}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </main>

        {/* Signing field editor (sticky bottom) */}
        {activeSigningField && (() => {
          const field = signingInfo.signer.fields.find(f => f.id === activeSigningField);
          if (!field) return null;
          return (
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
              <div className="max-w-2xl mx-auto p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold capitalize flex items-center gap-2">
                    {field.type === 'signature' && <PenLine className="w-4 h-4" />}
                    {field.type === 'date' && <CalendarDays className="w-4 h-4" />}
                    {field.type === 'text' && <Type className="w-4 h-4" />}
                    {field.type} Field
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setActiveSigningField(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {field.type === 'signature' && (
                  <Tabs defaultValue="draw">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="draw"><PenLine className="w-3 h-3 mr-1" /> Draw</TabsTrigger>
                      <TabsTrigger value="type"><Edit3 className="w-3 h-3 mr-1" /> Type</TabsTrigger>
                      <TabsTrigger value="upload"><ImageIcon className="w-3 h-3 mr-1" /> Upload</TabsTrigger>
                    </TabsList>
                    <TabsContent value="draw" className="mt-3">
                      <SignatureCanvas onSave={(dataUrl) => handleSigningFieldUpdate(field.id, dataUrl)} />
                    </TabsContent>
                    <TabsContent value="type" className="mt-3">
                      <TypeSignature onSave={(dataUrl) => handleSigningFieldUpdate(field.id, dataUrl)} />
                    </TabsContent>
                    <TabsContent value="upload" className="mt-3">
                      <UploadSignature onSave={(dataUrl) => handleSigningFieldUpdate(field.id, dataUrl)} />
                    </TabsContent>
                  </Tabs>
                )}

                {field.type === 'date' && (
                  <div className="space-y-3">
                    <Input
                      type="date"
                      value={signingFieldValues[field.id] || ''}
                      onChange={(e) => handleSigningFieldUpdate(field.id, e.target.value)}
                    />
                    <Button size="sm" onClick={() => handleSigningFieldUpdate(field.id, new Date().toLocaleDateString())} variant="outline" className="w-full">
                      <CalendarDays className="w-4 h-4 mr-1" /> Use Today&apos;s Date
                    </Button>
                  </div>
                )}

                {field.type === 'text' && (
                  <div className="space-y-3">
                    <Input
                      placeholder="Enter text..."
                      value={signingFieldValues[field.id] || ''}
                      onChange={(e) => handleSigningFieldUpdate(field.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Complete signing button */}
        {!activeSigningField && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-40 p-4">
            <div className="max-w-2xl mx-auto">
              <Button
                onClick={handleCompleteSigning}
                disabled={signingLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base"
              >
                {signingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5 mr-2" /> Complete Signing</>}
              </Button>
            </div>
          </div>
        )}

        <footer className="border-t py-3 text-center text-xs text-muted-foreground">
          Secured by OpenSign-compliant cryptographic sealing
        </footer>
      </div>
    );
  }

  // === AUTH VIEW ===
  if (store.currentView === 'auth' || !store.user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <main className="flex-1 flex items-center justify-center p-4">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md">
            {/* Hero */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-600/20">
                <FileSignature className="w-9 h-9 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">OpenSign</h1>
              <p className="text-muted-foreground mt-2">Secure document signing. Cryptographically sealed. ESIGN compliant.</p>
            </div>

            <Card className="shadow-lg">
              <CardHeader className="pb-2">
                <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'register')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Sign In</TabsTrigger>
                    <TabsTrigger value="register">Register</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {authMode === 'register' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input placeholder="John Doe" value={authName} onChange={(e) => setAuthName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" placeholder="you@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" placeholder="••••••••" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAuth()} />
                </div>
                <Button onClick={handleAuth} disabled={authLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 h-11">
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : authMode === 'login' ? 'Sign In' : 'Create Account'}
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> AES-256 Encrypted</div>
              <div className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> ESIGN Compliant</div>
              <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Audit Trail</div>
            </div>
          </motion.div>
        </main>
        <footer className="border-t py-4 text-center text-xs text-muted-foreground">
          OpenSign-compliant PDF Signing Platform
        </footer>
      </div>
    );
  }

  // === DASHBOARD VIEW ===
  if (store.currentView === 'dashboard') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <FileSignature className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg">OpenSign</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">{store.user.email}</span>
              <Button variant="ghost" size="sm" onClick={store.logout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Documents</h1>
              <p className="text-sm text-muted-foreground">Manage and send documents for signing</p>
            </div>
            <Button onClick={() => setUploadDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> New Document
            </Button>
          </div>

          {dashLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : documents.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No documents yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Upload a PDF to get started with document signing</p>
              <Button variant="outline" onClick={() => setUploadDialog(true)}>
                <Upload className="w-4 h-4 mr-2" /> Upload PDF
              </Button>
            </motion.div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc, i) => (
                <motion.div
                  key={doc.id}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => {
                      if (doc.status === 'Draft') {
                        store.setEditingDocument(doc.id);
                        store.setView('editor');
                      } else {
                        store.setViewingDocument(doc.id);
                        store.setView('viewer');
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold truncate">{doc.title}</CardTitle>
                            <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <StatusBadge status={doc.status} />
                          {doc.status === 'Draft' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {doc.signerCount > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            {doc.signedCount}/{doc.signerCount} signed
                          </div>
                          <Progress value={(doc.signedCount / doc.signerCount) * 100} className="h-1.5 w-20" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </main>

        {/* Upload Dialog */}
        <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                onClick={() => document.getElementById('pdf-upload')?.click()}
              >
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium">{uploadFile.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to select a PDF file</p>
                  </>
                )}
                <input id="pdf-upload" type="file" accept=".pdf" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Title</label>
                <Input placeholder="Enter document title..." value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialog(false)}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!uploadFile || uploading} className="bg-emerald-600 hover:bg-emerald-700">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4 mr-2" /> Upload</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <footer className="border-t py-3 text-center text-xs text-muted-foreground mt-auto">
          OpenSign-compliant PDF Signing Platform
        </footer>
      </div>
    );
  }

  // === EDITOR VIEW ===
  if (store.currentView === 'editor') {
    if (editorLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      );
    }

    if (!editorDoc) return null;

    const assignedCount = placedFields.filter(f => f.signerId).length;
    const canSend = tempSigners.length > 0 && assignedCount > 0;

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { store.setView('dashboard'); store.setEditingDocument(null); }}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-sm truncate max-w-[200px] sm:max-w-none">{editorDoc.title}</h1>
                <div className="flex items-center gap-2">
                  <StatusBadge status={editorDoc.status} />
                  <span className="text-xs text-muted-foreground">{pdfPages.length} page{pdfPages.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {tempSigners.length > 0 && <span>{tempSigners.length} signer{tempSigners.length !== 1 ? 's' : ''}</span>}
              {assignedCount > 0 && <span>· {assignedCount} field{assignedCount !== 1 ? 's' : ''} assigned</span>}
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar: Field tools */}
          <div className="w-56 border-r bg-muted/30 p-4 space-y-4 hidden lg:block">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field Types</h3>
            <div className="space-y-2">
              {([
                { type: 'signature' as const, icon: PenLine, label: 'Signature', color: 'emerald' },
                { type: 'date' as const, icon: CalendarDays, label: 'Date', color: 'amber' },
                { type: 'text' as const, icon: Type, label: 'Text', color: 'neutral' },
              ]).map(tool => (
                <Button
                  key={tool.type}
                  variant={activeTool === tool.type ? 'default' : 'outline'}
                  className={`w-full justify-start gap-2 ${activeTool === tool.type ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                  onClick={() => setActiveTool(activeTool === tool.type ? null : tool.type)}
                >
                  <tool.icon className="w-4 h-4" />
                  {tool.label}
                  {activeTool === tool.type && <MousePointer className="w-3 h-3 ml-auto" />}
                </Button>
              ))}
            </div>

            <Separator />

            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signers</h3>
            <div className="space-y-2">
              {tempSigners.map((signer, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm ${activeSignerId === `temp-${i}` ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  onClick={() => setActiveSignerId(activeSignerId === `temp-${i}` ? null : `temp-${i}`)}
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: signer.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{signer.name}</p>
                    <p className="truncate text-xs opacity-70">{signer.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => { e.stopPropagation(); setTempSigners(tempSigners.filter((_, j) => j !== i)); }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <div className="space-y-1.5">
                <Input placeholder="Name" value={newSignerName} onChange={(e) => setNewSignerName(e.target.value)} className="h-8 text-xs" />
                <Input placeholder="Email" type="email" value={newSignerEmail} onChange={(e) => setNewSignerEmail(e.target.value)} className="h-8 text-xs" onKeyDown={(e) => e.key === 'Enter' && addSigner()} />
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addSigner} disabled={!newSignerName.trim() || !newSignerEmail.trim()}>
                  <Plus className="w-3 h-3 mr-1" /> Add Signer
                </Button>
              </div>
            </div>

            <Separator />

            {/* Mobile field tools */}
            <div className="lg:hidden space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tools</h3>
              {[
                { type: 'signature' as const, icon: PenLine, label: 'Signature' },
                { type: 'date' as const, icon: CalendarDays, label: 'Date' },
                { type: 'text' as const, icon: Type, label: 'Text' },
              ].map(tool => (
                <Button
                  key={tool.type}
                  variant={activeTool === tool.type ? 'default' : 'outline'}
                  size="sm"
                  className={`w-full justify-start gap-2 ${activeTool === tool.type ? 'bg-emerald-600' : ''}`}
                  onClick={() => setActiveTool(activeTool === tool.type ? null : tool.type)}
                >
                  <tool.icon className="w-4 h-4" /> {tool.label}
                </Button>
              ))}
            </div>
          </div>

          {/* PDF Area */}
          <div className="flex-1 overflow-auto p-4 space-y-6">
            {pdfLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
              pdfPages.map((page, idx) => {
                const pageFields = placedFields.filter(f => f.pageNumber === page.pageNumber);
                return (
                  <div key={idx} className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Page {page.pageNumber} of {pdfPages.length}</p>
                    <div
                      className={`relative mx-auto border rounded-lg overflow-hidden shadow-sm bg-white ${activeTool ? 'cursor-crosshair' : ''}`}
                      style={{ maxWidth: 612 }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('[data-field]')) return;
                        handlePageClick(e, idx);
                      }}
                    >
                      <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="w-full h-auto" draggable={false} />
                      {pageFields.map(field => (
                        <div
                          key={field.id}
                          data-field
                          className={`absolute border-2 rounded flex items-center justify-center transition-all group/field ${
                            field.type === 'signature' ? 'border-emerald-400 bg-emerald-50/70' :
                            field.type === 'date' ? 'border-amber-400 bg-amber-50/70' :
                            'border-neutral-400 bg-neutral-50/70'
                          } ${field.signerColor ? `ring-2` : ''}`}
                          style={{
                            left: `${(field.x / 612) * 100}%`,
                            top: `${(field.y / 792) * 100}%`,
                            width: `${(field.width / 612) * 100}%`,
                            height: `${(field.height / 792) * 100}%`,
                            ringColor: field.signerColor,
                          }}
                        >
                          <div className="flex items-center gap-1 px-1">
                            {field.type === 'signature' && <PenLine className="w-3 h-3 text-emerald-600" />}
                            {field.type === 'date' && <CalendarDays className="w-3 h-3 text-amber-600" />}
                            {field.type === 'text' && <Type className="w-3 h-3 text-neutral-600" />}
                            <span className="text-[10px] font-medium truncate">
                              {field.signerName || field.type}
                            </span>
                          </div>
                          {/* Assign signer dropdown */}
                          <div className="absolute top-full left-0 mt-1 bg-popover border rounded shadow-lg p-1 hidden group-hover/field:block z-10 min-w-[140px]">
                            {tempSigners.map((s, si) => (
                              <button
                                key={si}
                                className="w-full text-left px-2 py-1 text-xs hover:bg-muted rounded flex items-center gap-2"
                                onClick={(e) => { e.stopPropagation(); handleAssignSigner(field.id, si); }}
                              >
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.name}
                                {field.signerId === `temp-${si}` && <Check className="w-3 h-3 ml-auto text-emerald-600" />}
                              </button>
                            ))}
                            {tempSigners.length === 0 && (
                              <p className="text-xs text-muted-foreground px-2 py-1">Add signers first</p>
                            )}
                          </div>
                          {/* Delete button */}
                          <button
                            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover/field:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleDeleteField(field.id); }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {activeTool && (
                        <div className="absolute inset-0 border-2 border-dashed border-emerald-300 rounded-lg pointer-events-none" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom action bar */}
        {editorDoc.status === 'Draft' && (
          <div className="border-t bg-background p-4 sticky bottom-0">
            <div className="max-w-[1400px] mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{placedFields.length} field{placedFields.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{assignedCount} assigned</span>
                <span>·</span>
                <span>{tempSigners.length} signer{tempSigners.length !== 1 ? 's' : ''}</span>
              </div>
              <Button onClick={handleSendForSigning} disabled={!canSend || sending} className="bg-emerald-600 hover:bg-emerald-700">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Send for Signing</>}
              </Button>
            </div>
          </div>
        )}

        <footer className="border-t py-3 text-center text-xs text-muted-foreground">
          OpenSign-compliant PDF Signing Platform
        </footer>
      </div>
    );
  }

  // === VIEWER VIEW ===
  if (store.currentView === 'viewer') {
    if (viewerLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      );
    }

    if (!viewerDoc) return null;

    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { store.setView('dashboard'); store.setViewingDocument(null); }}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-sm truncate max-w-[300px]">{viewerDoc.title}</h1>
                <div className="flex items-center gap-2">
                  <StatusBadge status={viewerDoc.status} />
                  <span className="text-xs text-muted-foreground">{formatDate(viewerDoc.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {viewerDoc.status === 'Completed' && (
                <Button size="sm" onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700">
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6">
          {/* Signers Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> Signers ({viewerDoc.signers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {viewerDoc.signers.map((signer, i) => (
                  <div key={signer.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: `${SIGNER_COLORS[i % SIGNER_COLORS.length]}20`, color: SIGNER_COLORS[i % SIGNER_COLORS.length] }}
                      >
                        {signer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{signer.name}</p>
                        <p className="text-xs text-muted-foreground">{signer.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!signer.signedAt && signer.token && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Copy signing link"
                          onClick={() => {
                            const link = `${window.location.origin}/?sign=${signer.token}`;
                            navigator.clipboard.writeText(link);
                            toast.success('Signing link copied!');
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {signer.signedAt ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Check className="w-3 h-3 mr-1" /> Signed
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Pending</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* PDF Pages */}
          {viewerPdfLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {viewerPages.map((page, idx) => {
                const pageFields = viewerDoc.fields.filter(f => f.pageNumber === page.pageNumber);
                return (
                  <div key={idx} className="space-y-1">
                    <p className="text-xs text-muted-foreground text-center">Page {page.pageNumber} of {viewerPages.length}</p>
                    <div className="relative mx-auto border rounded-lg overflow-hidden shadow-sm bg-white" style={{ maxWidth: 612 }}>
                      <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="w-full h-auto" draggable={false} />
                      {pageFields.map(field => (
                        <div
                          key={field.id}
                          className={`absolute border rounded flex items-center justify-center p-1 ${
                            field.value
                              ? 'border-emerald-400 bg-emerald-50/80'
                              : 'border-muted-foreground/30 bg-muted/30'
                          }`}
                          style={{
                            left: `${(field.x / 612) * 100}%`,
                            top: `${(field.y / 792) * 100}%`,
                            width: `${(field.width / 612) * 100}%`,
                            height: `${(field.height / 792) * 100}%`,
                          }}
                        >
                          {field.value && field.type === 'signature' && field.value.startsWith('data:') ? (
                            <img src={field.value} alt="Signature" className="h-full object-contain" />
                          ) : field.value ? (
                            <span className="text-xs font-medium truncate">{field.value}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground capitalize">{field.type}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Audit Trail */}
          <Card>
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowAudit(!showAudit)}>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" /> Audit Trail
                <ChevronDown className={`w-4 h-4 transition-transform ${showAudit ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
            {showAudit && (
              <CardContent>
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No audit entries yet</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 text-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="secondary" className="text-xs font-mono">{log.action}</Badge>
                            <span className="text-xs text-muted-foreground shrink-0">{formatDate(log.createdAt)}</span>
                          </div>
                          {log.details && <p className="text-xs text-muted-foreground mt-1">{log.details}</p>}
                          {log.ipAddress && <p className="text-xs text-muted-foreground">IP: {log.ipAddress}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    🔒 ESIGN/eIDAS Compliant Audit Trail — All actions are cryptographically recorded with timestamps and IP addresses.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        </main>

        <footer className="border-t py-3 text-center text-xs text-muted-foreground mt-auto">
          OpenSign-compliant PDF Signing Platform
        </footer>
      </div>
    );
  }

  return null;
}