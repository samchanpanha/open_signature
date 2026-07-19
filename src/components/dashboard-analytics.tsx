'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, TrendingUp, Clock, Users, FileText, CheckCircle2 } from 'lucide-react';

interface DashboardAnalyticsProps {
  documents: any[];
}

export function DashboardAnalytics({ documents }: DashboardAnalyticsProps) {
  const stats = React.useMemo(() => {
    const completed = documents.filter(d => d.status === 'Completed').length;
    const pending = documents.filter(d => d.status === 'Sent' || d.status === 'Signing').length;
    const draft = documents.filter(d => d.status === 'Draft').length;
    const totalSigners = documents.reduce((sum, d) => sum + (d.signerCount || 0), 0);

    const completedDocs = documents.filter(d => d.status === 'Completed' && d.createdAt);
    let avgDays = 0;
    if (completedDocs.length > 0) {
      const totalDays = completedDocs.reduce((sum, d) => {
        const created = new Date(d.createdAt).getTime();
        const now = Date.now();
        return sum + (now - created) / 86400000;
      }, 0);
      avgDays = Math.round(totalDays / completedDocs.length * 10) / 10;
    }

    return { completed, pending, draft, totalSigners, avgDays };
  }, [documents]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card className="stat-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.completed + stats.pending + stats.draft}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.completed}</p>
              <p className="text-[10px] text-muted-foreground">Done</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.pending}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <FileText className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.draft}</p>
              <p className="text-[10px] text-muted-foreground">Drafts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.totalSigners}</p>
              <p className="text-[10px] text-muted-foreground">Signers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.avgDays}d</p>
              <p className="text-[10px] text-muted-foreground">Avg Time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
