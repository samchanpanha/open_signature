'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileText, Upload, Plus, Trash2, ArrowLeft, LogOut, PenLine,
  CalendarDays, Type, Send, Download, Copy, Check, Eye, Users,
  Clock, Shield, X, ChevronDown, ChevronRight, Loader2, FileSignature,
  AlertCircle, CheckCircle2, MousePointer, Edit3, Image as ImageIcon,
  Sun, Moon, Search, CopyPlus, BookmarkPlus, Star, Ban, Award,
  FileDown, XCircle, AlertTriangle, Save, Building2, UserPlus, Settings,
  GripVertical, UserCog, Crown, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useAppStore, type AppView, type User } from '@/lib/store';
import { authApi, documentsApi, fieldsApi, signingApi, templatesApi, signaturesApi, orgApi, workflowsApi, otpApi, certificateApi, contactsApi, foldersApi, webhooksApi, emailTemplatesApi, apiKeysApi, remindersApi, type OrgListItem, type OrgMember, type DocumentListItem, type DocumentDetail, type SignerInfo, type Contact, type Folder, type Webhook, type EmailTemplate, type ApiKey } from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
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
  label?: string | null;
  required?: boolean;
}

interface TempSigner {
  name: string;
  email: string;
  color: string;
}

interface CcRecipient {
  name: string;
  email: string;
}

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface Template {
  id: string;
  name: string;
  fieldConfig: any[];
  createdAt: string;
}

interface SavedSignature {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

const SIGNER_COLORS = ['#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#c026d3'];
const FIELD_DEFAULTS = {
  signature: { width: 200, height: 60 },
  date: { width: 150, height: 40 },
  text: { width: 200, height: 40 },
};

const STATUS_TABS = ['All', 'Draft', 'Sent', 'Signing', 'Completed', 'Rejected', 'Expired'] as const;

// ============ HELPER COMPONENTS ============
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Draft: 'bg-secondary text-secondary-foreground',
    Sent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    Signing: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    Completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    Expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };
  return <Badge className={variants[status] || ''}>{status}</Badge>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [loadTemplateDialog, setLoadTemplateDialog] = useState(false);

  // Organizations
  const [orgs, setOrgs] = useState<OrgListItem[]>([]);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [orgDetail, setOrgDetail] = useState<import('@/lib/api').OrgDetail | null>(null);
  const [orgDetailLoading, setOrgDetailLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [createOrgDialog, setCreateOrgDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);

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
  const [signSelfLoading, setSignSelfLoading] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [ccRecipients, setCcRecipients] = useState<CcRecipient[]>([]);
  const [newCcName, setNewCcName] = useState('');
  const [newCcEmail, setNewCcEmail] = useState('');
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateDialog, setSaveTemplateDialog] = useState(false);

  // Workflows
  const [availableWorkflows, setAvailableWorkflows] = useState<import('@/lib/api').WorkflowListItem[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('');

  // Drag-to-move
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ mouseX: number; mouseY: number; fieldX: number; fieldY: number; pageRect: DOMRect } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fieldEditDialog, setFieldEditDialog] = useState(false);
  const [editFieldLabel, setEditFieldLabel] = useState('');
  const [editFieldRequired, setEditFieldRequired] = useState(true);
  const [editFieldWidth, setEditFieldWidth] = useState(200);
  const [editFieldHeight, setEditFieldHeight] = useState(40);
  const [editFieldSignerId, setEditFieldSignerId] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);

  // Refs
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const placedFieldsRef = useRef(placedFields);
  const dragFieldIdRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; fieldX: number; fieldY: number; pageRect: DOMRect } | null>(null);

  // Viewer
  const [viewerDoc, setViewerDoc] = useState<DocumentDetail | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerPages, setViewerPages] = useState<{ dataUrl: string; width: number; height: number; pageNumber: number }[]>([]);
  const [viewerPdfLoading, setViewerPdfLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [reminders, setReminders] = useState<any[]>([]);
  const [showReminders, setShowReminders] = useState(false);
  const [newReminderDate, setNewReminderDate] = useState('');
  const [newReminderMsg, setNewReminderMsg] = useState('');

  // Signing
  const [signingInfo, setSigningInfo] = useState<{ signer: SignerInfo; document: { id: string; title: string; status: string; expiresAt?: string | null } } | null>(null);
  const [signingPages, setSigningPages] = useState<{ dataUrl: string; width: number; height: number; pageNumber: number }[]>([]);
  const [signingPdfLoading, setSigningPdfLoading] = useState(false);
  const [signingFieldValues, setSigningFieldValues] = useState<Record<string, string>>({});
  const [signingLoading, setSigningLoading] = useState(false);
  const [signingComplete, setSigningComplete] = useState(false);
  const [activeSigningField, setActiveSigningField] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [savedSigsLoading, setSavedSigsLoading] = useState(false);

  // OTP Verification
  const [otpStep, setOtpStep] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactsPicker, setShowContactsPicker] = useState(false);

  // Folders
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Org Settings Tabs
  const [orgSettingsTab, setOrgSettingsTab] = useState<'members' | 'webhooks' | 'api-keys' | 'email-templates'>('members');
  const [orgWebhooks, setOrgWebhooks] = useState<Webhook[]>([]);
  const [orgEmailTemplates, setOrgEmailTemplates] = useState<EmailTemplate[]>([]);
  const [orgApiKeys, setOrgApiKeys] = useState<ApiKey[]>([]);

  // Keep placedFields ref in sync
  useEffect(() => {
    placedFieldsRef.current = placedFields;
  }, [placedFields]);

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

  // ============ ORG HANDLERS ============
  const loadOrgs = useCallback(async () => {
    try {
      const list = await orgApi.list();
      setOrgs(list);
    } catch {
      // Silently ignore
    }
  }, []);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) { toast.error('Enter organization name'); return; }
    setCreatingOrg(true);
    try {
      const org = await orgApi.create(newOrgName.trim());
      toast.success(`Organization "${org.name}" created!`);
      setCreateOrgDialog(false);
      setNewOrgName('');
      loadOrgs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !store.currentOrgId) return;
    try {
      await foldersApi.create({ name: newFolderName.trim(), orgId: store.currentOrgId });
      toast.success('Folder created');
      setCreatingFolder(false);
      setNewFolderName('');
      loadFolders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create folder');
    }
  };

  const handleSelectOrg = (orgId: string | null) => {
    store.setCurrentOrgId(orgId);
    setOrgDropdownOpen(false);
  };

  const loadOrgDetail = useCallback(async (orgId: string) => {
    setOrgDetailLoading(true);
    try {
      const detail = await orgApi.get(orgId);
      setOrgDetail(detail);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load organization');
      store.closeOrgSettings();
    } finally {
      setOrgDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (store.orgSettingsOpen && store.orgSettingsOrgId) {
      loadOrgDetail(store.orgSettingsOrgId);
    } else {
      setOrgDetail(null);
    }
  }, [store.orgSettingsOpen, store.orgSettingsOrgId, loadOrgDetail]);

  const handleInviteMember = async () => {
    if (!store.orgSettingsOrgId || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await orgApi.inviteMember(store.orgSettingsOrgId, inviteEmail.trim(), inviteRole);
      toast.success('Member invited successfully!');
      setInviteEmail('');
      setInviteRole('member');
      loadOrgDetail(store.orgSettingsOrgId);
      loadOrgs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    if (!store.orgSettingsOrgId) return;
    try {
      await orgApi.updateMemberRole(store.orgSettingsOrgId, memberId, newRole);
      toast.success('Role updated');
      loadOrgDetail(store.orgSettingsOrgId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!store.orgSettingsOrgId) return;
    try {
      await orgApi.removeMember(store.orgSettingsOrgId, memberId);
      toast.success('Member removed');
      loadOrgDetail(store.orgSettingsOrgId);
      loadOrgs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const handleDeleteOrg = async () => {
    if (!store.orgSettingsOrgId) return;
    setDeletingOrg(true);
    try {
      await orgApi.delete(store.orgSettingsOrgId);
      toast.success('Organization deleted');
      setDeleteOrgConfirm(false);
      store.closeOrgSettings();
      if (store.currentOrgId === store.orgSettingsOrgId) {
        store.setCurrentOrgId(null);
      }
      loadOrgs();
      loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete organization');
    } finally {
      setDeletingOrg(false);
    }
  };

  // ============ DASHBOARD ============
  const loadDocuments = useCallback(async () => {
    setDashLoading(true);
    try {
      const docs = await documentsApi.list(store.currentOrgId);
      setDocuments(docs);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setDashLoading(false);
    }
  }, [store.currentOrgId]);

  const loadTemplates = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const list = await templatesApi.list();
      setTemplates(list);
    } catch {
      // Templates may not be available, silently ignore
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  useEffect(() => {
    if (store.currentView === 'dashboard' && store.user) {
      loadDocuments();
      loadTemplates();
      loadFolders();
      loadOrgs();
    }
  }, [store.currentView, store.user, loadDocuments, loadTemplates, loadOrgs, loadFolders]);

  // Reload documents when org changes
  useEffect(() => {
    if (store.currentView === 'dashboard' && store.user) {
      loadDocuments();
    }
  }, [store.currentOrgId]);

  const filteredDocuments = useMemo(() => {
    let docs = documents;
    if (statusFilter !== 'All') {
      docs = docs.filter(d => d.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d => d.title.toLowerCase().includes(q));
    }
    return docs;
  }, [documents, statusFilter, searchQuery]);

  const currentOrg = useMemo(() => {
    if (!store.currentOrgId) return null;
    return orgs.find(o => o.id === store.currentOrgId) || null;
  }, [orgs, store.currentOrgId]);

  const handleUpload = async () => {
    if (!uploadFile) { toast.error('Please select a PDF'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle || uploadFile.name.replace('.pdf', ''));
      if (store.currentOrgId) {
        formData.append('organizationId', store.currentOrgId);
      }
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

  const handleDuplicateDoc = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await documentsApi.duplicate(id);
      toast.success('Document duplicated');
      loadDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await templatesApi.delete(id);
      setTemplates(templates.filter(t => t.id !== id));
      toast.success('Template deleted');
    } catch {
      toast.error('Failed to delete template');
    }
  };

  const handleLoadTemplate = async (template: Template) => {
    if (!store.editingDocumentId) return;
    try {
      for (const f of template.fieldConfig) {
        await fieldsApi.create(store.editingDocumentId, {
          type: f.type,
          pageNumber: f.pageNumber,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
        });
      }
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
        label: f.label,
        required: f.required,
      })));
      setLoadTemplateDialog(false);
      toast.success(`Template "${template.name}" applied`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply template');
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
        label: f.label,
        required: f.required,
      })));

      // Load available workflows for current org
      if (store.currentOrgId) {
        try {
          const wfs = await workflowsApi.list(store.currentOrgId);
          setAvailableWorkflows(wfs.filter(w => w.isActive));
        } catch {
          setAvailableWorkflows([]);
        }
      }

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

  const addCcRecipient = () => {
    if (!newCcName.trim() || !newCcEmail.trim()) return;
    setCcRecipients([...ccRecipients, { name: newCcName.trim(), email: newCcEmail.trim() }]);
    setNewCcName('');
    setNewCcEmail('');
  };

  const handlePageClick = async (e: React.MouseEvent<HTMLDivElement>, pageIndex: number) => {
    if (!activeTool || !store.editingDocumentId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = 612 / rect.width;
    const scaleY = 792 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const defaults = FIELD_DEFAULTS[activeTool];
    const signer = activeSignerId ? tempSigners[parseInt(activeSignerId.replace('temp-', ''), 10)] : null;

    try {
      const field = await fieldsApi.create(store.editingDocumentId, {
        type: activeTool,
        pageNumber: pageIndex + 1,
        x, y,
        width: defaults.width,
        height: defaults.height,
        signerId: signer ? undefined : undefined,
      });
      const createdField = field as { id: string; x: number; y: number; width: number; height: number };
      setPlacedFields((prev) => [...prev, {
        id: createdField.id,
        type: activeTool,
        pageNumber: pageIndex + 1,
        x: createdField.x,
        y: createdField.y,
        width: createdField.width,
        height: createdField.height,
        signerId: activeSignerId || undefined,
        signerName: signer?.name,
        signerColor: signer?.color,
        label: null,
        required: true,
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
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
        setFieldEditDialog(false);
      }
      toast.success('Field removed');
    } catch {
      toast.error('Failed to remove field');
    }
  };

  const handleAssignSigner = async (fieldId: string, signerIndex: number) => {
    const signer = tempSigners[signerIndex];
    const signerId = `temp-${signerIndex}`;
    try {
      setPlacedFields((prev) => prev.map((f) =>
        f.id === fieldId ? { ...f, signerId, signerName: signer.name, signerColor: signer.color } : f
      ));
      toast.success(`Field assigned to ${signer.name}`);
    } catch {
      toast.error('Failed to assign signer');
    }
  };

  // ============ DRAG-TO-MOVE ============
  const handleFieldMouseDown = useCallback((fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (activeTool) return;

    const field = placedFieldsRef.current.find(f => f.id === fieldId);
    if (!field) return;

    const pageEl = (e.target as HTMLElement).closest('[data-page]') as HTMLElement;
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();

    const startPos = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      fieldX: field.x,
      fieldY: field.y,
      pageRect,
    };

    setDraggingField(fieldId);
    dragFieldIdRef.current = fieldId;
    setDragStartPos(startPos);
    dragStartRef.current = startPos;
    setIsDragging(false);
    setSelectedFieldId(fieldId);
  }, [activeTool]);

  useEffect(() => {
    if (!draggingField) return;

    const handleMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !dragFieldIdRef.current) return;

      const start = dragStartRef.current;
      const dx = (e.clientX - start.mouseX) * (612 / start.pageRect.width);
      const dy = (e.clientY - start.mouseY) * (792 / start.pageRect.height);

      // Only start visual drag after a small threshold
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        setIsDragging(true);
      }

      if (!isDragging) return;

      const fieldWidth = placedFieldsRef.current.find(f => f.id === dragFieldIdRef.current)?.width || 100;
      const fieldHeight = placedFieldsRef.current.find(f => f.id === dragFieldIdRef.current)?.height || 40;

      let newX = Math.max(0, Math.min(612 - fieldWidth, start.fieldX + dx));
      let newY = Math.max(0, Math.min(792 - fieldHeight, start.fieldY + dy));

      setPlacedFields(prev => prev.map(f =>
        f.id === dragFieldIdRef.current ? { ...f, x: newX, y: newY } : f
      ));
    };

    const handleUp = async () => {
      const fieldId = dragFieldIdRef.current;
      const wasDragging = isDragging;

      if (wasDragging && fieldId) {
        // Persist the new position
        const latestField = placedFieldsRef.current.find(f => f.id === fieldId);
        if (latestField) {
          try {
            await fieldsApi.update(fieldId, { x: latestField.x, y: latestField.y });
          } catch {
            // Silently ignore persist error
          }
        }
      }

      setDraggingField(null);
      dragFieldIdRef.current = null;
      setDragStartPos(null);
      dragStartRef.current = null;

      if (!wasDragging && fieldId) {
        // It was a click, not a drag — open field edit dialog
        setFieldEditDialog(true);
        const field = placedFieldsRef.current.find(f => f.id === fieldId);
        if (field) {
          setEditFieldLabel(field.label || '');
          setEditFieldRequired(field.required ?? true);
          setEditFieldWidth(Math.round(field.width));
          setEditFieldHeight(Math.round(field.height));
          setEditFieldSignerId(field.signerId || null);
        }
      }

      // Delay clearing isDragging so the click handler can check it
      setTimeout(() => {
        setIsDragging(false);
      }, 50);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [draggingField, isDragging]);

  // ============ FIELD EDIT DIALOG ============
  const handleSaveFieldEdit = async () => {
    if (!selectedFieldId) return;
    setSavingField(true);
    try {
      await fieldsApi.update(selectedFieldId, {
        label: editFieldLabel || null,
        required: editFieldRequired,
        width: editFieldWidth,
        height: editFieldHeight,
        signerId: editFieldSignerId,
      });
      setPlacedFields(prev => prev.map(f => {
        if (f.id !== selectedFieldId) return f;
        const signer = editFieldSignerId ? tempSigners[parseInt(editFieldSignerId.replace('temp-', ''), 10)] : null;
        return {
          ...f,
          label: editFieldLabel || null,
          required: editFieldRequired,
          width: editFieldWidth,
          height: editFieldHeight,
          signerId: editFieldSignerId || undefined,
          signerName: signer?.name || undefined,
          signerColor: signer?.color || undefined,
        };
      }));
      toast.success('Field updated');
      setFieldEditDialog(false);
      setSelectedFieldId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update field');
    } finally {
      setSavingField(false);
    }
  };

  const selectedFieldForEdit = useMemo(() => {
    if (!selectedFieldId) return null;
    return placedFields.find(f => f.id === selectedFieldId) || null;
  }, [selectedFieldId, placedFields]);

  // ============ SEND / SIGN SELF / TEMPLATE ============
  const handleSendForSigning = async () => {
    if (!store.editingDocumentId || !editorDoc) return;
    const assignedFields = placedFields.filter(f => f.signerId);
    if (tempSigners.length === 0) { toast.error('Add at least one signer'); return; }
    if (assignedFields.length === 0) { toast.error('Assign at least one field to a signer'); return; }

    setSending(true);
    try {
      const fieldAssignments = assignedFields.map(f => ({
        fieldId: f.id,
        signerIndex: parseInt(f.signerId!.replace('temp-', ''), 10),
      }));

      const result = await documentsApi.send(
        store.editingDocumentId,
        tempSigners.map(s => ({ email: s.email, name: s.name })),
        fieldAssignments,
        ccRecipients.length > 0 ? ccRecipients : undefined,
        expiryDate || undefined,
        selectedWorkflowId || undefined,
      );
      toast.success('Document sent for signing!');
      store.setView('dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleSignSelf = async () => {
    if (!store.editingDocumentId) return;
    setSignSelfLoading(true);
    try {
      const result = await documentsApi.signSelf(store.editingDocumentId);
      toast.success('Redirecting to sign...');
      store.setSigningToken(result.token);
    } catch (err: any) {
      toast.error(err.message || 'Failed to sign yourself');
    } finally {
      setSignSelfLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) { toast.error('Enter a template name'); return; }
    try {
      const fieldConfig = placedFields.map(f => ({
        type: f.type,
        pageNumber: f.pageNumber,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
      }));
      await templatesApi.create(saveTemplateName.trim(), fieldConfig);
      toast.success(`Template "${saveTemplateName.trim()}" saved!`);
      setSaveTemplateDialog(false);
      setSaveTemplateName('');
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
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

      // Load reminders
      try {
        const rems = await remindersApi.list(store.viewingDocumentId);
        setReminders(rems as any);
      } catch { setReminders([]); }
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

  const handleDownloadCertificate = async () => {
    if (!store.viewingDocumentId) return;
    try {
      const url = await documentsApi.certificate(store.viewingDocumentId);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${viewerDoc?.title || 'document'}-certificate.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificate download started');
    } catch (err: any) {
      toast.error(err.message || 'Certificate download failed');
    }
  };

  // ============ SIGNING (GUEST) ============
  const loadSavedSignatures = useCallback(async () => {
    setSavedSigsLoading(true);
    try {
      const sigs = await signaturesApi.list();
      setSavedSignatures(sigs);
    } catch {
      // Silently ignore - may not be logged in
    } finally {
      setSavedSigsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!store.signingToken) return;
    setSigningPdfLoading(true);
    setSigningLoading(true);
    (async () => {
      try {
        const info = await signingApi.getInfo(store.signingToken!);
        setSigningInfo(info);

        // Initialize field values and persist to server
        const vals: Record<string, string> = {};
        for (const f of info.signer.fields) {
          if (f.value) {
            vals[f.id] = f.value;
          } else if (f.type === 'date') {
            vals[f.id] = new Date().toISOString().split('T')[0];
          } else {
            vals[f.id] = '';
          }
          if (vals[f.id]) {
            signingApi.updateField(store.signingToken!, f.id, vals[f.id]).catch(() => {});
          }
        }
        setSigningFieldValues(vals);

        // Load saved signatures
        loadSavedSignatures();

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
  }, [store.signingToken, loadSavedSignatures]);

  const textUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // OTP handlers
  const handleRequestOtp = async () => {
    if (!store.signingToken) return;
    try {
      await otpApi.requestOtp(store.signingToken);
      setOtpRequested(true);
      toast.success('OTP code sent to your email');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async () => {
    if (!store.signingToken || otpCode.length !== 6) return;
    setOtpVerifying(true);
    try {
      await otpApi.verifyOtp(store.signingToken, otpCode);
      setOtpStep(false);
      toast.success('Identity verified');
      // Reload signing info
      const info = await signingApi.getInfo(store.signingToken!);
      setSigningInfo(info);
    } catch (err: any) {
      toast.error(err.message || 'Invalid OTP code');
    } finally {
      setOtpVerifying(false);
    }
  };

  // Contacts loader
  const loadContacts = useCallback(async () => {
    try {
      const list = await contactsApi.list();
      setContacts(list);
    } catch { /* ok */ }
  }, []);

  // Folders loader
  const loadFolders = useCallback(async () => {
    if (!store.currentOrgId) { setFolders([]); return; }
    try {
      const list = await foldersApi.list(store.currentOrgId);
      setFolders(list);
    } catch { /* ok */ }
  }, [store.currentOrgId]);

  // Org settings data loader
  const loadOrgSettingsData = useCallback(async (orgId: string) => {
    try {
      const [wh, et] = await Promise.all([
        webhooksApi.list(orgId),
        emailTemplatesApi.list(orgId),
      ]);
      setOrgWebhooks(wh);
      setOrgEmailTemplates(et);
    } catch { /* ok */ }
    try {
      const keys = await apiKeysApi.list();
      setOrgApiKeys(keys);
    } catch { /* ok */ }
  }, []);

  useEffect(() => {
    if (store.orgSettingsOpen && store.orgSettingsOrgId) {
      loadOrgSettingsData(store.orgSettingsOrgId);
    }
  }, [store.orgSettingsOpen, store.orgSettingsOrgId, loadOrgSettingsData]);

  const handleSigningFieldUpdate = async (fieldId: string, value: string, immediate = false) => {
    if (!store.signingToken) return;
    setSigningFieldValues(prev => ({ ...prev, [fieldId]: value }));

    if (immediate || fieldId !== activeSigningField) {
      if (textUpdateTimerRef.current) clearTimeout(textUpdateTimerRef.current);
      try {
        await signingApi.updateField(store.signingToken, fieldId, value);
      } catch (err: any) {
        toast.error(err.message || 'Failed to save field');
      }
    } else {
      if (textUpdateTimerRef.current) clearTimeout(textUpdateTimerRef.current);
      textUpdateTimerRef.current = setTimeout(async () => {
        try {
          await signingApi.updateField(store.signingToken!, fieldId, value);
        } catch (err: any) {
          toast.error(err.message || 'Failed to save field');
        }
      }, 300);
    }
  };

  const handleCompleteSigning = async () => {
    if (!store.signingToken || !signingInfo) return;
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

  const handleReject = async () => {
    if (!store.signingToken || !rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setRejecting(true);
    try {
      await signingApi.reject(store.signingToken, rejectReason.trim());
      toast.success('Document rejected');
      setRejectDialog(false);
      setRejectReason('');
      setSigningComplete(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  };

  const isNearExpiry = useMemo(() => {
    if (!signingInfo?.document.expiresAt) return false;
    const expiry = new Date(signingInfo.document.expiresAt);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  }, [signingInfo]);

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

    if (signingInfo) {
      // Check if OTP verification is needed (signer hasn't verified yet)
      if (otpStep) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-semibold">Verify Your Identity</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      A one-time code has been sent to <span className="font-medium">{signingInfo.signer.email}</span>
                    </p>
                  </div>
                  {!otpRequested ? (
                    <Button onClick={handleRequestOtp} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      <Send className="w-4 h-4 mr-2" /> Send Verification Code
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        placeholder="Enter 6-digit code"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="text-center text-lg tracking-[0.3em] font-mono"
                        maxLength={6}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                      />
                      <Button
                        onClick={handleVerifyOtp}
                        disabled={otpCode.length !== 6 || otpVerifying}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        {otpVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Verify
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => { setOtpRequested(false); setOtpCode(''); }}>
                        Resend Code
                      </Button>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setOtpStep(false)}>
                    Skip for now
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        );
      }
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
            <div className="flex items-center gap-2">
              {!signingInfo.signer.otpVerified && (
                <Button size="sm" variant="outline" onClick={() => setOtpStep(true)} className="text-emerald-600 border-emerald-300">
                  <Shield className="w-3 h-3 mr-1" /> Verify Identity
                </Button>
              )}
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Signing</Badge>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Expiry warning */}
        {isNearExpiry && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800"
          >
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>This document expires soon — {signingInfo.document.expiresAt ? formatDateOnly(signingInfo.document.expiresAt) : 'soon'}. Please sign promptly.</span>
            </div>
          </motion.div>
        )}

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
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="draw"><PenLine className="w-3 h-3 mr-1" /> Draw</TabsTrigger>
                      <TabsTrigger value="type"><Edit3 className="w-3 h-3 mr-1" /> Type</TabsTrigger>
                      <TabsTrigger value="upload"><ImageIcon className="w-3 h-3 mr-1" /> Upload</TabsTrigger>
                      <TabsTrigger value="saved"><Star className="w-3 h-3 mr-1" /> Saved</TabsTrigger>
                    </TabsList>
                    <TabsContent value="draw" className="mt-3">
                      <SignatureCanvas
                        onSave={(dataUrl) => {
                          handleSigningFieldUpdate(field.id, dataUrl, true);
                        }}
                      />
                    </TabsContent>
                    <TabsContent value="type" className="mt-3">
                      <TypeSignature onSave={(dataUrl) => handleSigningFieldUpdate(field.id, dataUrl, true)} />
                    </TabsContent>
                    <TabsContent value="upload" className="mt-3">
                      <UploadSignature onSave={(dataUrl) => handleSigningFieldUpdate(field.id, dataUrl, true)} />
                    </TabsContent>
                    <TabsContent value="saved" className="mt-3">
                      {savedSigsLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                      ) : savedSignatures.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          <Star className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p>No saved signatures yet</p>
                          <p className="text-xs mt-1">Draw or upload a signature and save it for reuse</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                          {savedSignatures.map(sig => (
                            <button
                              key={sig.id}
                              className="border rounded-lg p-2 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-colors text-left group"
                              onClick={() => handleSigningFieldUpdate(field.id, sig.dataUrl, true)}
                            >
                              <img src={sig.dataUrl} alt={sig.name} className="h-12 w-full object-contain mb-1" />
                              <p className="text-xs font-medium truncate">{sig.name}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}

                {field.type === 'date' && (
                  <div className="space-y-3">
                    <Input
                      type="date"
                      value={signingFieldValues[field.id] || ''}
                      onChange={(e) => handleSigningFieldUpdate(field.id, e.target.value, true)}
                    />
                    <Button size="sm" onClick={() => handleSigningFieldUpdate(field.id, new Date().toISOString().split('T')[0], true)} variant="outline" className="w-full">
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

                <Button
                  className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700"
                  onClick={async () => {
                    if (textUpdateTimerRef.current) clearTimeout(textUpdateTimerRef.current);
                    if (store.signingToken && signingFieldValues[field.id]) {
                      await signingApi.updateField(store.signingToken, field.id, signingFieldValues[field.id]);
                    }
                    setActiveSigningField(null);
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Done
                </Button>
              </div>
            </div>
          );
        })()}

        {/* Complete signing / Reject buttons */}
        {!activeSigningField && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-40 p-4">
            <div className="max-w-2xl mx-auto flex gap-3">
              <Button
                onClick={handleCompleteSigning}
                disabled={signingLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base"
              >
                {signingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5 mr-2" /> Complete Signing</>}
              </Button>
              <Button
                onClick={() => setRejectDialog(true)}
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800 h-12 px-4"
              >
                <Ban className="w-4 h-4 mr-2" /> Reject
              </Button>
            </div>
          </div>
        )}

        {/* Reject Dialog */}
        <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" /> Reject Document
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. Please provide a reason for rejecting this document.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <textarea
                className="w-full min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
              <Button
                onClick={handleReject}
                disabled={rejecting || !rejectReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Ban className="w-4 h-4 mr-2" /> Reject Document</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <footer className="border-t py-3 text-center text-xs text-muted-foreground sticky bottom-0 bg-background">
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
              <div className="flex justify-center mt-3">
                <ThemeToggle />
              </div>
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
            <div className="flex items-center gap-2">
              {/* Org Selector Dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {currentOrg ? currentOrg.name : 'Personal'}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
                {orgDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOrgDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 py-1">
                      {/* Personal option */}
                      <button
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${!store.currentOrgId ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : ''}`}
                        onClick={() => handleSelectOrg(null)}
                      >
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                          {store.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="flex-1">Personal</span>
                        {!store.currentOrgId && <Check className="w-4 h-4 text-emerald-600" />}
                      </button>
                      <Separator className="my-1" />
                      {/* Organization options */}
                      {orgs.map(org => (
                        <button
                          key={org.id}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${store.currentOrgId === org.id ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : ''}`}
                          onClick={() => handleSelectOrg(org.id)}
                        >
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{org.name}</p>
                            <p className="text-xs text-muted-foreground">{org.memberCount} members</p>
                          </div>
                          {store.currentOrgId === org.id && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </button>
                      ))}
                      <Separator className="my-1" />
                      {/* Create Org */}
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 text-emerald-600"
                        onClick={() => { setOrgDropdownOpen(false); setCreateOrgDialog(true); }}
                      >
                        <Plus className="w-4 h-4" />
                        Create Organization
                      </button>
                      {/* Org Settings (if an org is selected) */}
                      {currentOrg && (
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                          onClick={() => { setOrgDropdownOpen(false); store.openOrgSettings(currentOrg.id); }}
                        >
                          <Settings className="w-4 h-4" />
                          Org Settings
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <span className="text-sm text-muted-foreground hidden sm:block">{store.user.email}</span>
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={store.logout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 space-y-6">
          {/* Current org banner */}
          {currentOrg && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-emerald-800 dark:text-emerald-300">{currentOrg.name}</span>
                <Badge variant="secondary" className="text-xs">{currentOrg.role}</Badge>
                <span className="text-emerald-600 dark:text-emerald-400">{currentOrg.documentCount} docs</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => store.openOrgSettings(currentOrg.id)} className="text-emerald-700 dark:text-emerald-400">
                <UserCog className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* Templates Section */}
          {templates.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <button
                className="flex items-center gap-2 text-sm font-semibold mb-3 w-full text-left"
                onClick={() => setTemplatesOpen(!templatesOpen)}
              >
                <BookmarkPlus className="w-4 h-4 text-emerald-600" />
                Templates ({templates.length})
                <ChevronDown className={`w-4 h-4 transition-transform ${templatesOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {templatesOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-3 pb-4 overflow-x-auto">
                      {templates.map(t => (
                        <div
                          key={t.id}
                          className="flex-shrink-0 border rounded-lg p-3 bg-card hover:shadow-sm transition-shadow min-w-[160px] max-w-[200px] relative group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{t.name}</span>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              onClick={() => handleDeleteTemplate(t.id)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">{t.fieldConfig.length} field{t.fieldConfig.length !== 1 ? 's' : ''}</p>
                          <p className="text-xs text-muted-foreground">{formatDateOnly(t.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Documents</h1>
              <p className="text-sm text-muted-foreground">
                {currentOrg ? `Documents in ${currentOrg.name}` : 'Manage and send documents for signing'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { if (currentOrgId) { setNewFolderName(''); setCreatingFolder(true); } }} disabled={!currentOrgId} title="Create folder">
                <FileText className="w-4 h-4 mr-1" /> Folder
              </Button>
              <Button onClick={() => setUploadDialog(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" /> New Document
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Folder Navigation */}
          {currentOrgId && folders.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                className={`text-xs px-2 py-1 rounded ${!currentFolderId ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium' : 'text-muted-foreground hover:bg-muted'}`}
                onClick={() => setCurrentFolderId(null)}
              >
                All
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${currentFolderId === f.id ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={() => setCurrentFolderId(f.id)}
                >
                  <FileText className="w-3 h-3" /> {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Status Filter Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STATUS_TABS.map(tab => (
              <button
                key={tab}
                className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                  statusFilter === tab
                    ? 'bg-emerald-600 text-white'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {dashLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : filteredDocuments.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {documents.length === 0 ? 'Upload a PDF to get started with document signing' : 'Try adjusting your search or filter'}
              </p>
              {documents.length === 0 && (
                <Button variant="outline" onClick={() => setUploadDialog(true)}>
                  <Upload className="w-4 h-4 mr-2" /> Upload PDF
                </Button>
              )}
            </motion.div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((doc, i) => (
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
                          {doc.expiresAt && (doc.status === 'Sent' || doc.status === 'Signing') && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-600">
                              <Clock className="w-2.5 h-2.5 mr-0.5" />
                              {(() => {
                                const days = Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / 86400000);
                                return days <= 0 ? 'Expired' : `${days}d left`;
                              })()}
                            </Badge>
                          )}
                          <StatusBadge status={doc.status} />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {doc.signerCount > 0 && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            {doc.signedCount}/{doc.signerCount} signed
                          </div>
                          <Progress value={(doc.signedCount / doc.signerCount) * 100} className="h-1.5 w-20" />
                        </div>
                      )}
                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDuplicateDoc(e, doc.id)}
                          title="Duplicate document"
                        >
                          <CopyPlus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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
              <DialogDescription>
                {currentOrg ? `This document will be created in ${currentOrg.name}.` : 'Upload a PDF document to prepare for signing.'}
              </DialogDescription>
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

        {/* Create Org Dialog */}
        <Dialog open={createOrgDialog} onOpenChange={setCreateOrgDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" /> Create Organization
              </DialogTitle>
              <DialogDescription>
                Create a new organization to collaborate with your team on document signing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Organization Name</label>
                <Input
                  placeholder="e.g., Acme Corp"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOrgDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateOrg} disabled={!newOrgName.trim() || creatingOrg} className="bg-emerald-600 hover:bg-emerald-700">
                {creatingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Create</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Folder Dialog */}
        <Dialog open={creatingFolder} onOpenChange={setCreatingFolder}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" /> New Folder
              </DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreatingFolder(false)}>Cancel</Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-1" /> Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Org Settings Dialog */}
        <Dialog open={store.orgSettingsOpen} onOpenChange={(open) => { if (!open) store.closeOrgSettings(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" /> Organization Settings
              </DialogTitle>
            </DialogHeader>

            {orgDetailLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : orgDetail ? (
              <div className="max-h-[60vh] overflow-y-auto">
                {/* Org info header */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{orgDetail.name}</h3>
                      <p className="text-sm text-muted-foreground">Created {formatDateOnly(orgDetail.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{orgDetail.members.length} members</Badge>
                    <Badge variant="secondary">{orgDetail.documentCount} documents</Badge>
                  </div>
                </div>

                {/* Settings Tabs */}
                <Tabs value={orgSettingsTab} onValueChange={(v) => setOrgSettingsTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="members" className="text-xs"><Users className="w-3 h-3 mr-1" /> Members</TabsTrigger>
                    <TabsTrigger value="webhooks" className="text-xs"><Send className="w-3 h-3 mr-1" /> Hooks</TabsTrigger>
                    <TabsTrigger value="api-keys" className="text-xs"><Shield className="w-3 h-3 mr-1" /> Keys</TabsTrigger>
                    <TabsTrigger value="email-templates" className="text-xs"><FileText className="w-3 h-3 mr-1" /> Email</TabsTrigger>
                  </TabsList>

                  {/* Members Tab */}
                  <TabsContent value="members" className="space-y-4">
                    <div className="space-y-2">
                      {orgDetail.members.map(member => {
                        const isOwner = member.role === 'owner';
                        const isAdmin = member.role === 'admin';
                        const canManage = !isOwner && (orgDetail.ownerId === store.user?.id || isAdmin);
                        return (
                          <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{
                                backgroundColor: isOwner ? 'rgba(5,150,105,0.15)' : 'rgba(100,100,100,0.1)',
                                color: isOwner ? '#059669' : undefined,
                              }}
                            >
                              {member.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{member.user.name}</p>
                                {isOwner && <Crown className="w-3.5 h-3.5 text-emerald-600" />}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className={
                                isOwner ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                isAdmin ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-secondary text-secondary-foreground'
                              }>
                                {member.role}
                              </Badge>
                              {canManage && (
                                <div className="flex items-center gap-1">
                                  <select className="text-xs border rounded px-1 py-0.5 bg-background" value={member.role} onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}>
                                    <option value="member">Member</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleRemoveMember(member.id)}>
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Invite */}
                    {(orgDetail.ownerId === store.user?.id || orgDetail.members.some(m => m.user.id === store.user?.id && m.role === 'admin')) && (
                      <div className="flex gap-2">
                        <Input placeholder="Email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1 h-9 text-sm" onKeyDown={(e) => e.key === 'Enter' && handleInviteMember()} />
                        <select className="border rounded-md px-2 text-xs bg-background h-9" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button size="sm" onClick={handleInviteMember} disabled={!inviteEmail.trim() || inviting} className="bg-emerald-600 hover:bg-emerald-700 h-9">
                          {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        </Button>
                      </div>
                    )}
                    {orgDetail.ownerId === store.user?.id && (
                      <>
                        <Separator />
                        {!deleteOrgConfirm ? (
                          <Button variant="outline" className="w-full text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800" onClick={() => setDeleteOrgConfirm(true)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Organization
                          </Button>
                        ) : (
                          <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
                            <p className="text-sm text-red-700 dark:text-red-400 font-medium"><AlertTriangle className="w-4 h-4 inline mr-1" /> This will permanently delete the organization.</p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => setDeleteOrgConfirm(false)} className="flex-1">Cancel</Button>
                              <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleDeleteOrg} disabled={deletingOrg}>
                                {deletingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4 mr-1" /> Delete</>}
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* Webhooks Tab */}
                  <TabsContent value="webhooks" className="space-y-4">
                    {orgWebhooks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No webhooks configured</p>
                    ) : (
                      <div className="space-y-2">
                        {orgWebhooks.map(wh => (
                          <div key={wh.id} className="flex items-center justify-between p-2 rounded-lg border">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{wh.url}</p>
                              <p className="text-xs text-muted-foreground">{JSON.parse(wh.events).join(', ')}</p>
                            </div>
                            <Badge variant={wh.isActive ? 'default' : 'secondary'}>{wh.isActive ? 'Active' : 'Inactive'}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* API Keys Tab */}
                  <TabsContent value="api-keys" className="space-y-4">
                    {orgApiKeys.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No API keys</p>
                    ) : (
                      <div className="space-y-2">
                        {orgApiKeys.map(k => (
                          <div key={k.id} className="flex items-center justify-between p-2 rounded-lg border">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{k.name}</p>
                              <p className="text-xs text-muted-foreground">Created {formatDateOnly(k.createdAt)}</p>
                            </div>
                            <Badge variant={k.isActive ? 'default' : 'secondary'}>{k.isActive ? 'Active' : 'Revoked'}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Email Templates Tab */}
                  <TabsContent value="email-templates" className="space-y-4">
                    {orgEmailTemplates.length === 0 ? (
                      <Button variant="outline" className="w-full" onClick={() => { if (store.orgSettingsOrgId) emailTemplatesApi.seed(store.orgSettingsOrgId).then(() => loadOrgSettingsData(store.orgSettingsOrgId!)); }}>
                        <Plus className="w-4 h-4 mr-2" /> Seed Default Templates
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        {orgEmailTemplates.map(et => (
                          <div key={et.id} className="p-2 rounded-lg border">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{et.name}</p>
                              {et.isDefault && <Badge variant="secondary">Default</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Subject: {et.subject}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Failed to load organization details.</p>
            )}
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
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                {tempSigners.length > 0 && <span>{tempSigners.length} signer{tempSigners.length !== 1 ? 's' : ''}</span>}
                {assignedCount > 0 && <span>· {assignedCount} field{assignedCount !== 1 ? 's' : ''} assigned</span>}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar: Field tools */}
          <div className="w-56 border-r bg-muted/30 p-4 space-y-4 hidden lg:flex flex-col overflow-y-auto">
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
                  onClick={() => { setActiveTool(activeTool === tool.type ? null : tool.type); setSelectedFieldId(null); setFieldEditDialog(false); }}
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
                <div className="flex gap-1">
                  <Input placeholder="Name" value={newSignerName} onChange={(e) => setNewSignerName(e.target.value)} className="h-8 text-xs flex-1" />
                  <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => { loadContacts(); setShowContactsPicker(!showContactsPicker); }} title="Pick from contacts">
                    <Users className="w-3 h-3" />
                  </Button>
                </div>
                {showContactsPicker && contacts.length > 0 && (
                  <div className="border rounded-md max-h-32 overflow-y-auto bg-background">
                    {contacts.map(c => (
                      <button
                        key={c.id}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
                        onClick={() => { setNewSignerName(c.name); setNewSignerEmail(c.email); setShowContactsPicker(false); }}
                      >
                        <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-muted-foreground truncate">{c.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <Input placeholder="Email" type="email" value={newSignerEmail} onChange={(e) => setNewSignerEmail(e.target.value)} className="h-8 text-xs" onKeyDown={(e) => e.key === 'Enter' && addSigner()} />
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addSigner} disabled={!newSignerName.trim() || !newSignerEmail.trim()}>
                  <Plus className="w-3 h-3 mr-1" /> Add Signer
                </Button>
              </div>
            </div>

            <Separator />

            {/* CC Recipients */}
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CC Recipients</h3>
            <div className="space-y-2">
              {ccRecipients.map((cc, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-1.5 bg-muted rounded-md">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30 shrink-0" />
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{cc.name}</span>
                    <span className="text-muted-foreground ml-1">({cc.email})</span>
                  </div>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setCcRecipients(ccRecipients.filter((_, j) => j !== i))}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <div className="space-y-1.5">
                <Input placeholder="CC Name" value={newCcName} onChange={(e) => setNewCcName(e.target.value)} className="h-7 text-xs" />
                <Input placeholder="CC Email" type="email" value={newCcEmail} onChange={(e) => setNewCcEmail(e.target.value)} className="h-7 text-xs" onKeyDown={(e) => e.key === 'Enter' && addCcRecipient()} />
                <Button variant="outline" size="sm" className="w-full h-6 text-xs" onClick={addCcRecipient} disabled={!newCcName.trim() || !newCcEmail.trim()}>
                  <Plus className="w-3 h-3 mr-1" /> Add CC
                </Button>
              </div>
            </div>

            <Separator />

            {/* Expiry Date */}
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiry Date</h3>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="h-8 text-xs"
              min={new Date().toISOString().split('T')[0]}
            />
            {expiryDate && (
              <p className="text-xs text-muted-foreground">
                Expires: {formatDateOnly(expiryDate)}
              </p>
            )}

            {/* Load Template */}
            {templates.length > 0 && (
              <>
                <Separator />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Templates</h3>
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setLoadTemplateDialog(true)}>
                  <BookmarkPlus className="w-3 h-3 mr-1" /> Load Template
                </Button>
              </>
            )}
          </div>

          {/* Mobile toolbar */}
          <div className="lg:hidden fixed bottom-16 left-0 right-0 bg-background border-t z-40 p-2">
            <div className="flex gap-2 justify-center">
              {[
                { type: 'signature' as const, icon: PenLine, label: 'Sig' },
                { type: 'date' as const, icon: CalendarDays, label: 'Date' },
                { type: 'text' as const, icon: Type, label: 'Text' },
              ].map(tool => (
                <Button
                  key={tool.type}
                  variant={activeTool === tool.type ? 'default' : 'outline'}
                  size="sm"
                  className={`gap-1 ${activeTool === tool.type ? 'bg-emerald-600' : ''}`}
                  onClick={() => { setActiveTool(activeTool === tool.type ? null : tool.type); setSelectedFieldId(null); setFieldEditDialog(false); }}
                >
                  <tool.icon className="w-4 h-4" /> {tool.label}
                </Button>
              ))}
            </div>
          </div>

          {/* PDF Area */}
          <div className="flex-1 overflow-auto p-4 space-y-6 pb-24 lg:pb-4" ref={editorContainerRef}>
            {pdfLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : (
              pdfPages.map((page, idx) => {
                const pageFields = placedFields.filter(f => f.pageNumber === page.pageNumber);
                return (
                  <div key={idx} className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Page {page.pageNumber} of {pdfPages.length}</p>
                    <div
                      data-page
                      className={`relative mx-auto border rounded-lg overflow-hidden shadow-sm bg-white ${activeTool ? 'cursor-crosshair' : ''}`}
                      style={{ maxWidth: 612 }}
                      onClick={(e) => {
                        if (isDragging) return;
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
                          className={`absolute border-2 rounded flex items-center justify-center transition-all group/field select-none ${
                            selectedFieldId === field.id ? 'ring-2 ring-emerald-500 ring-offset-1' : ''
                          } ${
                            field.type === 'signature' ? 'border-emerald-400 bg-emerald-50/70' :
                            field.type === 'date' ? 'border-amber-400 bg-amber-50/70' :
                            'border-neutral-400 bg-neutral-50/70'
                          } ${field.signerColor ? 'ring-2' : ''} ${draggingField === field.id ? 'opacity-80 shadow-lg z-20' : ''}`}
                          style={{
                            left: `${(field.x / 612) * 100}%`,
                            top: `${(field.y / 792) * 100}%`,
                            width: `${(field.width / 612) * 100}%`,
                            height: `${(field.height / 792) * 100}%`,
                            ...(field.signerColor ? { '--tw-ring-color': field.signerColor } as React.CSSProperties : {}),
                            cursor: activeTool ? undefined : (draggingField === field.id ? 'grabbing' : 'grab'),
                          }}
                          onMouseDown={(e) => handleFieldMouseDown(field.id, e)}
                        >
                          <GripVertical className="w-3 h-3 text-muted-foreground/50 absolute top-0.5 left-0.5 hidden group-hover/field:block" />
                          <div className="flex items-center gap-1 px-1">
                            {field.type === 'signature' && <PenLine className="w-3 h-3 text-emerald-600" />}
                            {field.type === 'date' && <CalendarDays className="w-3 h-3 text-amber-600" />}
                            {field.type === 'text' && <Type className="w-3 h-3 text-neutral-600" />}
                            <span className="text-[10px] font-medium truncate">
                              {field.label || field.signerName || field.type}
                            </span>
                            {field.required && <span className="text-red-500 text-[10px]">*</span>}
                          </div>
                          {/* Assign signer dropdown */}
                          {!activeTool && (
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
                          )}
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
          <div className="border-t bg-background p-4 sticky bottom-0 z-30">
            <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{placedFields.length} field{placedFields.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{assignedCount} assigned</span>
                <span>·</span>
                <span>{tempSigners.length} signer{tempSigners.length !== 1 ? 's' : ''}</span>
                {ccRecipients.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{ccRecipients.length} CC</span>
                  </>
                )}
                {/* Workflow selector */}
                {availableWorkflows.length > 0 && (
                  <>
                    <span>·</span>
                    <select
                      value={selectedWorkflowId}
                      onChange={(e) => setSelectedWorkflowId(e.target.value)}
                      className="border rounded px-2 py-1 text-sm bg-background"
                    >
                      <option value="">No workflow</option>
                      {availableWorkflows.map(wf => (
                        <option key={wf.id} value={wf.id}>{wf.name} ({wf.steps.length} steps)</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveTemplateDialog(true)}
                  disabled={placedFields.length === 0}
                >
                  <BookmarkPlus className="w-4 h-4 mr-1" /> Save Template
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignSelf}
                  disabled={signSelfLoading || placedFields.length === 0}
                >
                  {signSelfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PenLine className="w-4 h-4 mr-1" /> Sign Yourself</>}
                </Button>
                <Button onClick={handleSendForSigning} disabled={!canSend || sending} className="bg-emerald-600 hover:bg-emerald-700">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Send for Signing</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Field Edit Dialog */}
        <Dialog open={fieldEditDialog} onOpenChange={(open) => { if (!open) { setFieldEditDialog(false); setSelectedFieldId(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" /> Edit Field
              </DialogTitle>
              <DialogDescription>
                Configure the field properties for this signing field.
              </DialogDescription>
            </DialogHeader>
            {selectedFieldForEdit && (
              <div className="space-y-4">
                {/* Field type (read-only) */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Badge className={
                    selectedFieldForEdit.type === 'signature' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    selectedFieldForEdit.type === 'date' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-secondary text-secondary-foreground'
                  }>
                    {selectedFieldForEdit.type === 'signature' && <PenLine className="w-3 h-3 mr-1" />}
                    {selectedFieldForEdit.type === 'date' && <CalendarDays className="w-3 h-3 mr-1" />}
                    {selectedFieldForEdit.type === 'text' && <Type className="w-3 h-3 mr-1" />}
                    {selectedFieldForEdit.type.charAt(0).toUpperCase() + selectedFieldForEdit.type.slice(1)}
                  </Badge>
                </div>

                {/* Label */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Label</label>
                  <Input
                    placeholder="e.g., Signature of CEO"
                    value={editFieldLabel}
                    onChange={(e) => setEditFieldLabel(e.target.value)}
                  />
                </div>

                {/* Required toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Required</label>
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editFieldRequired ? 'bg-emerald-600' : 'bg-muted'}`}
                    onClick={() => setEditFieldRequired(!editFieldRequired)}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${editFieldRequired ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Width & Height */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Width (pts)</label>
                    <Input
                      type="number"
                      min={20}
                      max={612}
                      value={editFieldWidth}
                      onChange={(e) => setEditFieldWidth(Math.max(20, Math.min(612, parseInt(e.target.value) || 20)))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Height (pts)</label>
                    <Input
                      type="number"
                      min={10}
                      max={792}
                      value={editFieldHeight}
                      onChange={(e) => setEditFieldHeight(Math.max(10, Math.min(792, parseInt(e.target.value) || 10)))}
                    />
                  </div>
                </div>

                {/* Signer assignment */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assign to Signer</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={editFieldSignerId || ''}
                    onChange={(e) => setEditFieldSignerId(e.target.value || null)}
                  >
                    <option value="">Unassigned</option>
                    {tempSigners.map((s, i) => (
                      <option key={i} value={`temp-${i}`}>{s.name} ({s.email})</option>
                    ))}
                  </select>
                </div>

                {/* Position info */}
                <div className="text-xs text-muted-foreground">
                  Position: X={Math.round(selectedFieldForEdit.x)}, Y={Math.round(selectedFieldForEdit.y)} · Page {selectedFieldForEdit.pageNumber}
                </div>
              </div>
            )}
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={async () => {
                  if (selectedFieldId) {
                    await handleDeleteField(selectedFieldId);
                    setFieldEditDialog(false);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setFieldEditDialog(false); setSelectedFieldId(null); }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveFieldEdit} disabled={savingField} className="bg-emerald-600 hover:bg-emerald-700">
                  {savingField ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1" /> Save</>}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save Template Dialog */}
        <Dialog open={saveTemplateDialog} onOpenChange={setSaveTemplateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 text-emerald-600" /> Save as Template
              </DialogTitle>
              <DialogDescription>
                Save the current field layout as a reusable template. Field positions and types will be preserved.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  placeholder="e.g., NDA Template"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {placedFields.length} field{placedFields.length !== 1 ? 's' : ''} will be saved
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveTemplateDialog(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()} className="bg-emerald-600 hover:bg-emerald-700">
                <Save className="w-4 h-4 mr-2" /> Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Load Template Dialog */}
        <Dialog open={loadTemplateDialog} onOpenChange={setLoadTemplateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Load Template</DialogTitle>
              <DialogDescription>
                Select a template to auto-place fields on this document.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No templates available</p>
              ) : (
                templates.map(t => (
                  <button
                    key={t.id}
                    className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors flex items-center justify-between"
                    onClick={() => handleLoadTemplate(t)}
                  >
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.fieldConfig.length} fields · {formatDateOnly(t.createdAt)}</p>
                    </div>
                    <BookmarkPlus className="w-4 h-4 text-emerald-600" />
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

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
                <>
                  <Button size="sm" variant="outline" onClick={handleDownloadCertificate} className="hidden sm:flex">
                    <Award className="w-4 h-4 mr-1" /> Certificate
                  </Button>
                  <Button size="sm" onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700">
                    <Download className="w-4 h-4 mr-1" /> Download
                  </Button>
                </>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6">
          {/* Rejection Info */}
          {viewerDoc.status === 'Rejected' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-400">Document Rejected</h3>
                  {viewerDoc.rejectedBy && (
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      Rejected by: {viewerDoc.rejectedBy}
                    </p>
                  )}
                  {viewerDoc.rejectionReason && (
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                      Reason: {viewerDoc.rejectionReason}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Expiry Info */}
          {viewerDoc.expiresAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Expires: {formatDateOnly(viewerDoc.expiresAt)}</span>
              {new Date(viewerDoc.expiresAt) < new Date() && (
                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Expired</Badge>
              )}
            </div>
          )}

          {/* Signers Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> Signers ({viewerDoc.signers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Workflow Progress */}
              {viewerDoc.workflow && (
                <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Workflow: {viewerDoc.workflow.name}
                  </p>
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {viewerDoc.workflow.steps.map((step, i) => {
                      const signer = viewerDoc.signers.find(s => s.order === step.order);
                      const isCompleted = signer?.signedAt;
                      const isCurrent = !isCompleted && viewerDoc.signers.every(s => s.order < step.order ? !!s.signedAt : true);
                      return (
                        <div key={step.id} className="flex items-center gap-1">
                          <div className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                            isCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            isCurrent ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 ring-2 ring-amber-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {isCompleted ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 text-center font-bold">{step.order}</span>}
                            <span className="whitespace-nowrap">{step.user.name}</span>
                          </div>
                          {i < viewerDoc.workflow!.steps.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                      {signer.rejectedAt && (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          <XCircle className="w-3 h-3 mr-1" /> Rejected
                        </Badge>
                      )}
                      {signer.rejectionReason && (
                        <span className="text-xs text-red-600 dark:text-red-400 max-w-[150px] truncate" title={signer.rejectionReason}>
                          {signer.rejectionReason}
                        </span>
                      )}
                      {!signer.rejectedAt && !signer.signedAt && signer.token && (
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
                      {!signer.rejectedAt && signer.signedAt ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Check className="w-3 h-3 mr-1" /> Signed
                        </Badge>
                      ) : !signer.rejectedAt ? (
                        <Badge variant="secondary">Pending</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {/* CC Recipients */}
              {viewerDoc.ccRecipients && viewerDoc.ccRecipients.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">CC Recipients</h4>
                  <div className="space-y-2">
                    {viewerDoc.ccRecipients.map((cc, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {cc.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{cc.name}</p>
                          <p className="text-xs text-muted-foreground">{cc.email}</p>
                        </div>
                        <Badge variant="secondary" className="ml-auto text-xs">CC</Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
                            <span className="text-[10px] text-muted-foreground capitalize">{field.label || field.type}</span>
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
                    ESIGN/eIDAS Compliant Audit Trail — All actions are cryptographically recorded with timestamps and IP addresses.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Reminders & Expiry */}
          {viewerDoc && (viewerDoc.status === 'Sent' || viewerDoc.status === 'Signing') && (
            <Card>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowReminders(!showReminders)}>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Reminders & Expiry
                  <ChevronDown className={`w-4 h-4 transition-transform ${showReminders ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
              {showReminders && (
                <CardContent className="space-y-4">
                  {viewerDoc.expiresAt && (
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                      <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                        Expires: {new Date(viewerDoc.expiresAt).toLocaleDateString()}
                        {viewerDoc.expiresAt && new Date(viewerDoc.expiresAt) > new Date()
                          ? ` (${Math.ceil((new Date(viewerDoc.expiresAt).getTime() - Date.now()) / 86400000)} days left)`
                          : ' (EXPIRED)'}
                      </p>
                    </div>
                  )}

                  {/* Auto-scheduled reminders */}
                  {reminders.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Scheduled Reminders</p>
                      {reminders.map((rem: any) => (
                        <div key={rem.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{rem.type}</Badge>
                              <span className="text-xs text-muted-foreground">{new Date(rem.scheduledAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{rem.message}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="ml-2 h-6 px-2" onClick={async () => {
                            await remindersApi.delete(rem.id);
                            setReminders((prev: any[]) => prev.filter((r: any) => r.id !== rem.id));
                            toast.success('Reminder deleted');
                          }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add custom reminder */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Add Reminder</p>
                    <div className="flex gap-2">
                      <Input type="date" className="h-8 text-xs" value={newReminderDate} onChange={(e) => setNewReminderDate(e.target.value)} />
                      <Button size="sm" className="h-8 px-3" disabled={!newReminderDate} onClick={async () => {
                        if (!store.viewingDocumentId || !newReminderDate) return;
                        try {
                          const result = await remindersApi.create({
                            documentId: store.viewingDocumentId,
                            type: 'follow_up',
                            scheduledAt: new Date(newReminderDate).toISOString(),
                            message: newReminderMsg || `Reminder: Please sign "${viewerDoc?.title}"`,
                          });
                          setReminders((prev: any[]) => [result.reminder, ...prev]);
                          setNewReminderDate('');
                          setNewReminderMsg('');
                          toast.success('Reminder scheduled');
                        } catch { toast.error('Failed to schedule reminder'); }
                      }}>Schedule</Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

        </main>

        <footer className="border-t py-3 text-center text-xs text-muted-foreground mt-auto sticky bottom-0 bg-background">
          OpenSign-compliant PDF Signing Platform
        </footer>
      </div>
    );
  }

  return null;
}