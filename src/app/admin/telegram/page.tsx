'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  MessageCircle, Users, Send, AlertTriangle, CheckCircle2,
  XCircle, Loader2, RefreshCw, Settings, Activity, ExternalLink,
} from 'lucide-react';
import { telegramApi, type TelegramStats } from '@/lib/api';

export default function AdminTelegramPage() {
  const [stats, setStats] = useState<TelegramStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [botStatus, setBotStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await telegramApi.getStats();
      setStats(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkBotStatus = useCallback(async () => {
    setBotStatus('checking');
    try {
      await telegramApi.botInfo();
      setBotStatus('online');
    } catch {
      setBotStatus('offline');
    }
  }, []);

  useEffect(() => {
    loadStats();
    checkBotStatus();
  }, [loadStats, checkBotStatus]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-[#0088cc]" />
              Telegram Integration
            </h1>
            <p className="text-muted-foreground">Manage bot status, users, and notifications</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={checkBotStatus}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Bot Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Bot Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                botStatus === 'online' ? 'bg-emerald-500' :
                botStatus === 'offline' ? 'bg-red-500' :
                'bg-yellow-500 animate-pulse'
              }`} />
              <span className="text-sm font-medium">
                {botStatus === 'online' ? 'Bot is online' :
                 botStatus === 'offline' ? 'Bot is offline' :
                 'Checking...'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Linked Users', value: stats?.totalLinked || 0, icon: Users, color: 'text-blue-600' },
            { label: 'Messages Sent', value: stats?.messagesSent || 0, icon: Send, color: 'text-emerald-600' },
            { label: 'Failed Messages', value: stats?.messagesFailed || 0, icon: AlertTriangle, color: 'text-red-600' },
            { label: 'Active Sessions', value: stats?.activeSessions || 0, icon: Activity, color: 'text-purple-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
                <p className="text-2xl font-bold">{loading ? '...' : value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => toast.info('Webhook management available via /api/telegram/manage')}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Manage Webhook
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => window.open(`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'OpenSignBot'}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Bot in Telegram
            </Button>
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Environment Variables Required</h3>
            <div className="text-xs text-muted-foreground space-y-1 font-mono">
              <p>TELEGRAM_BOT_TOKEN=...</p>
              <p>TELEGRAM_BOT_USERNAME=...</p>
              <p>TELEGRAM_WEBHOOK_SECRET=...</p>
              <p>TELEGRAM_WEBHOOK_URL=...</p>
              <p>TELEGRAM_MINI_APP_URL=...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
