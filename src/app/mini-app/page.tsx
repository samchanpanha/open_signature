'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Clock, CheckCircle2, Send, Bell, User,
  Loader2, ExternalLink, AlertTriangle, ChevronRight,
  Home, FileSignature, Settings,
} from 'lucide-react';

// Telegram Mini App SDK types
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: { id: number; first_name: string; last_name?: string; username?: string };
        };
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        ready: () => void;
        expand: () => void;
        close: () => void;
        openLink: (url: string) => void;
        switchInlineQuery: (query: string) => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
      };
    };
  }
}

interface DashboardData {
  pending: Array<{
    id: string;
    title: string;
    sender: string;
    status: string;
    expiresAt?: string;
    requireOtp: boolean;
    signerToken: string;
    role: string;
    createdAt: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    title: string;
    signerToken: string;
  }>;
  owned: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  stats: {
    total: number;
    completed: number;
    pending: number;
    sent: number;
  };
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    documentId?: string;
    createdAt: string;
  }>;
}

type Tab = 'home' | 'pending' | 'completed' | 'notifications' | 'profile';

export default function TelegramMiniApp() {
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tgReady, setTgReady] = useState(false);

  // Initialize Telegram Mini App
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setTgReady(true);

      // Apply Telegram theme
      document.documentElement.style.setProperty('--tg-bg-color', tg.themeParams.bg_color || '#ffffff');
      document.documentElement.style.setProperty('--tg-text-color', tg.themeParams.text_color || '#000000');
    }
  }, []);

  // Authenticate
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) {
      // Not in Telegram - show demo mode or redirect
      setLoading(false);
      return;
    }

    const authenticate = async () => {
      try {
        const res = await fetch('/api/telegram/miniapp/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData }),
        });
        const data = await res.json();
        if (data.token) {
          setAuthToken(data.token);
          setUser(data.user);
          localStorage.setItem('token', data.token);
        }
      } catch (err) {
        console.error('Auth failed:', err);
        toast.error('Authentication failed');
      } finally {
        setLoading(false);
      }
    };

    authenticate();
  }, []);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/telegram/miniapp/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setDashboard(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }, [authToken]);

  useEffect(() => {
    if (authToken) loadDashboard();
  }, [authToken, loadDashboard]);

  const openSign = (signerToken: string) => {
    const baseUrl = window.location.origin;
    window.Telegram?.WebApp?.openLink(`${baseUrl}/sign/${signerToken}`);
  };

  const openDocument = (docId: string) => {
    const baseUrl = window.location.origin;
    window.Telegram?.WebApp?.openLink(`${baseUrl}?doc=${docId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#0088cc]" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authToken || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0088cc] flex items-center justify-center">
            <FileSignature className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold mb-2">OpenSign</h1>
          <p className="text-muted-foreground mb-4">
            Please open this app from Telegram to authenticate.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'pending', label: 'Sign', icon: <FileSignature className="w-5 h-5" /> },
    { id: 'completed', label: 'Done', icon: <CheckCircle2 className="w-5 h-5" /> },
    { id: 'notifications', label: 'Alerts', icon: <Bell className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0088cc] flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">OpenSign</span>
          </div>
          {dashboard?.stats.pending !== undefined && dashboard.stats.pending > 0 && (
            <Badge variant="secondary" className="bg-[#0088cc]/10 text-[#0088cc]">
              {dashboard.stats.pending} pending
            </Badge>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              {/* Welcome */}
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
                  <User className="w-7 h-7 text-[#0088cc]" />
                </div>
                <h2 className="text-lg font-semibold">Hello, {user.name.split(' ')[0]} 👋</h2>
                <p className="text-sm text-muted-foreground">
                  {dashboard?.stats.pending === 0
                    ? "You're all caught up!"
                    : `You have ${dashboard?.stats.pending} pending signature${(dashboard?.stats.pending || 0) === 1 ? '' : 's'}`}
                </p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Pending', value: dashboard?.stats.pending || 0, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                  { label: 'Completed', value: dashboard?.stats.completed || 0, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                  { label: 'Sent', value: dashboard?.stats.sent || 0, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                  { label: 'Total', value: dashboard?.stats.total || 0, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>

              {/* Pending Signatures */}
              {dashboard?.pending && dashboard.pending.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileSignature className="w-4 h-4 text-amber-600" />
                    Pending Signatures
                  </h3>
                  <div className="space-y-2">
                    {dashboard.pending.slice(0, 5).map((doc) => (
                      <Card key={doc.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => openSign(doc.signerToken)}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">From: {doc.sender}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Approvals */}
              {dashboard?.pendingApprovals && dashboard.pendingApprovals.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    Pending Approvals
                  </h3>
                  <div className="space-y-2">
                    {dashboard.pendingApprovals.map((doc) => (
                      <Card key={doc.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => openSign(doc.signerToken)}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">Approval required</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* No pending */}
              {dashboard && dashboard.pending.length === 0 && (!dashboard.pendingApprovals || dashboard.pendingApprovals.length === 0) && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">All done! No pending documents.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <h2 className="text-lg font-semibold">Documents to Sign</h2>
              {dashboard?.pending && dashboard.pending.length > 0 ? (
                dashboard.pending.map((doc) => (
                  <Card key={doc.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => openSign(doc.signerToken)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground">From: {doc.sender}</p>
                        </div>
                        <Badge variant={doc.role === 'approver' ? 'default' : 'secondary'}>
                          {doc.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                        {doc.expiresAt && new Date(doc.expiresAt) < new Date(Date.now() + 7 * 86400000) && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            Expires {new Date(doc.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                        {doc.requireOtp && (
                          <Badge variant="outline" className="text-xs">OTP Required</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-muted-foreground">No pending signatures</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <h2 className="text-lg font-semibold">My Documents</h2>
              {dashboard?.owned && dashboard.owned.length > 0 ? (
                dashboard.owned.map((doc) => (
                  <Card key={doc.id} className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => openDocument(doc.id)}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={doc.status === 'Completed' ? 'default' : 'secondary'}>
                        {doc.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No documents yet</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <h2 className="text-lg font-semibold">Notifications</h2>
              {dashboard?.notifications && dashboard.notifications.length > 0 ? (
                dashboard.notifications.map((notif) => (
                  <Card key={notif.id}>
                    <CardContent className="p-3">
                      <p className="font-medium text-sm">{notif.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
                  <User className="w-8 h-8 text-[#0088cc]" />
                </div>
                <h2 className="text-lg font-semibold">{user.name}</h2>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Telegram</span>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Connected
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Documents</span>
                    <span className="text-sm text-muted-foreground">{dashboard?.stats.total || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Completed</span>
                    <span className="text-sm text-muted-foreground">{dashboard?.stats.completed || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const baseUrl = window.location.origin;
                  window.Telegram?.WebApp?.openLink(`${baseUrl}`);
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Full App
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 bg-background/80 backdrop-blur-lg border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-14">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                activeTab === id
                  ? 'text-[#0088cc]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
