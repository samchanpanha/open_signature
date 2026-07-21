'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, CheckCircle2, XCircle, Loader2, ExternalLink,
  Unlink, Shield, Bell, Clock, Smartphone, RefreshCw,
} from 'lucide-react';
import { telegramApi, type TelegramConnectInfo, type TelegramLinkStatus } from '@/lib/api';

interface TelegramConnectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLinked: boolean;
  onLinkChange: (linked: boolean) => void;
  telegramChatId?: string | null;
}

export function TelegramConnect({ open, onOpenChange, isLinked, onLinkChange, telegramChatId }: TelegramConnectProps) {
  const [step, setStep] = useState<'idle' | 'connecting' | 'waiting' | 'success' | 'error'>('idle');
  const [connectInfo, setConnectInfo] = useState<TelegramConnectInfo | null>(null);
  const [polling, setPolling] = useState(false);
  const [botInfo, setBotInfo] = useState<{ username: string; id: number } | null>(null);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    telegramOnSent: true,
    telegramOnCompleted: true,
    telegramOnRejected: true,
    telegramOnExpiring: true,
    telegramOnReminder: true,
    telegramOnApproval: true,
    telegramDailySummary: false,
    telegramWeeklySummary: false,
    telegramSecurityAlerts: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(false);

  const loadBotInfo = useCallback(async () => {
    try {
      const info = await telegramApi.botInfo();
      setBotInfo(info);
    } catch {
      // Bot not configured
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const { preferences: prefs } = await telegramApi.getPreferences();
      setPreferences(prefs);
    } catch {
      // Use defaults
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadBotInfo();
      if (isLinked) loadPreferences();
    }
  }, [open, isLinked, loadBotInfo, loadPreferences]);

  const startConnect = async () => {
    setStep('connecting');
    try {
      const info = await telegramApi.connect();
      setConnectInfo(info);
      if (info.linked) {
        setStep('success');
        onLinkChange(true);
        return;
      }
      setStep('waiting');
      startPolling(info.token!);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start Telegram connection');
      setStep('error');
    }
  };

  const startPolling = (token: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds

    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        setPolling(false);
        setStep('error');
        toast.error('Connection timed out. Please try again.');
        return;
      }

      try {
        const status: TelegramLinkStatus = await telegramApi.linkStatus(token);
        if (status.linked) {
          setPolling(false);
          setStep('success');
          onLinkChange(true);
          toast.success('Telegram connected successfully!');
          return;
        }
      } catch {
        // Continue polling
      }

      setTimeout(poll, 1000);
    };

    poll();
  };

  const disconnect = async () => {
    try {
      await telegramApi.unlink();
      onLinkChange(false);
      setStep('idle');
      toast.success('Telegram disconnected');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect');
    }
  };

  const savePreferences = async () => {
    setPrefsLoading(true);
    try {
      await telegramApi.updatePreferences(preferences);
      toast.success('Notification preferences saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save preferences');
    } finally {
      setPrefsLoading(false);
    }
  };

  const togglePref = (key: string) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0088cc] flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            Telegram Integration
          </DialogTitle>
          <DialogDescription>
            Connect your Telegram account to receive instant document signing notifications
          </DialogDescription>
        </DialogHeader>

        {!isLinked ? (
          <div className="space-y-4">
            {/* Connection Status */}
            <AnimatePresence mode="wait">
              {step === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="bg-gradient-to-br from-[#0088cc]/5 to-[#0088cc]/10 dark:from-[#0088cc]/10 dark:to-[#0088cc]/20 rounded-xl p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#0088cc] flex items-center justify-center shadow-lg">
                      <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Connect Telegram</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Receive instant notifications for document signing, approvals, and more
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-left text-sm mb-4">
                      {[
                        'Signature Requests',
                        'Approval Requests',
                        'Document Updates',
                        'Reminder Notifications',
                        'Completed Documents',
                        'Security Alerts',
                      ].map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {botInfo && (
                    <p className="text-xs text-center text-muted-foreground">
                      Bot: @{botInfo.username}
                    </p>
                  )}
                </motion.div>
              )}

              {step === 'connecting' && (
                <motion.div
                  key="connecting"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center py-8"
                >
                  <Loader2 className="w-8 h-8 animate-spin text-[#0088cc] mb-4" />
                  <p className="text-sm text-muted-foreground">Setting up connection...</p>
                </motion.div>
              )}

              {step === 'waiting' && connectInfo?.deepLink && (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="text-center py-4">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    </div>
                    <h4 className="font-medium mb-2">Waiting for Telegram...</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click the button below to open Telegram and start the bot
                    </p>
                  </div>

                  <Button
                    className="w-full bg-[#0088cc] hover:bg-[#006daa] text-white"
                    onClick={() => window.open(connectInfo.deepLink, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Telegram
                  </Button>

                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Or send this command to the bot:</p>
                    <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                      /start {connectInfo.token}
                    </code>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    Waiting for you to click Start in Telegram... ({polling ? 'polling' : 'idle'})
                  </p>
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                    className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4"
                  >
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </motion.div>
                  <h4 className="text-lg font-semibold mb-2">Connected!</h4>
                  <p className="text-sm text-muted-foreground text-center">
                    Your Telegram account is now linked. You'll receive notifications for document events.
                  </p>
                </motion.div>
              )}

              {step === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-8"
                >
                  <XCircle className="w-12 h-12 text-destructive mb-4" />
                  <h4 className="font-medium mb-2">Connection Failed</h4>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Something went wrong. Please try again.
                  </p>
                  <Button variant="outline" onClick={startConnect}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected Status */}
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium">Telegram Connected</p>
                  <p className="text-xs text-muted-foreground">Chat ID: {telegramChatId}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={disconnect} className="text-destructive hover:text-destructive">
                <Unlink className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            </div>

            {/* Notification Preferences */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Telegram Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'telegramOnSent', label: 'Document Sent', desc: 'When a document is sent for signing' },
                  { key: 'telegramOnCompleted', label: 'Document Completed', desc: 'When all signers have signed' },
                  { key: 'telegramOnRejected', label: 'Document Rejected', desc: 'When a signer rejects a document' },
                  { key: 'telegramOnExpiring', label: 'Expiring Soon', desc: 'When a document is about to expire' },
                  { key: 'telegramOnReminder', label: 'Reminders', desc: 'Periodic signing reminders' },
                  { key: 'telegramOnApproval', label: 'Approval Requests', desc: 'When you need to approve a document' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={preferences[key]}
                      onCheckedChange={() => togglePref(key)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Summary Preferences */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Summaries & Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: 'telegramDailySummary', label: 'Daily Summary', desc: 'Receive a daily digest of activity' },
                  { key: 'telegramWeeklySummary', label: 'Weekly Summary', desc: 'Receive a weekly activity report' },
                  { key: 'telegramSecurityAlerts', label: 'Security Alerts', desc: 'Important security notifications' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={preferences[key]}
                      onCheckedChange={() => togglePref(key)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          {isLinked ? (
            <Button onClick={savePreferences} disabled={prefsLoading} className="gradient-primary text-white">
              {prefsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Preferences'}
            </Button>
          ) : step === 'idle' ? (
            <Button onClick={startConnect} className="bg-[#0088cc] hover:bg-[#006daa] text-white">
              <MessageCircle className="w-4 h-4 mr-2" />
              Connect Telegram
            </Button>
          ) : step === 'success' ? (
            <Button onClick={() => onOpenChange(false)} className="gradient-primary text-white">
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
