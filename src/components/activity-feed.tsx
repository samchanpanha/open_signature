'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity, FileText, Send, CheckCircle2, Ban, Clock,
  ChevronDown, Eye
} from 'lucide-react';

interface ActivityItem {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  document?: { id: string; title: string } | null;
}

interface ActivityFeedProps {
  userId: string;
}

const actionIcons: Record<string, { icon: React.ElementType; color: string }> = {
  DOCUMENT_CREATED: { icon: FileText, color: 'text-blue-500' },
  DOCUMENT_SENT: { icon: Send, color: 'text-emerald-500' },
  DOCUMENT_COMPLETED: { icon: CheckCircle2, color: 'text-green-500' },
  DOCUMENT_REJECTED: { icon: Ban, color: 'text-red-500' },
  SIGNER_COMPLETED: { icon: CheckCircle2, color: 'text-green-500' },
  DOCUMENT_VIEWED: { icon: Eye, color: 'text-cyan-500' },
  OTP_REQUESTED: { icon: Clock, color: 'text-purple-500' },
};

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ActivityFeed({ userId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/documents?limit=10', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        const recentActivities: ActivityItem[] = [];
        for (const doc of (data.documents || []).slice(0, 5)) {
          if (doc.signerCount > 0) {
            recentActivities.push({
              id: `${doc.id}-status`,
              action: doc.status === 'Completed' ? 'DOCUMENT_COMPLETED' : doc.status === 'Sent' ? 'DOCUMENT_SENT' : 'DOCUMENT_CREATED',
              details: `"${doc.title}" - ${doc.status}`,
              createdAt: doc.createdAt,
              document: { id: doc.id, title: doc.title },
            });
          }
        }

        setActivities(recentActivities.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, [userId]);

  const displayActivities = expanded ? activities : activities.slice(0, 5);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="w-4 h-4" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {displayActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {displayActivities.map((activity) => {
              const config = actionIcons[activity.action] || { icon: FileText, color: 'text-gray-500' };
              const Icon = config.icon;
              return (
                <div key={activity.id} className="flex items-start gap-3 group">
                  <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.details}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(activity.createdAt)}</p>
                  </div>
                  {activity.document && (
                    <Badge variant="outline" className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      View
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {activities.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show less' : `Show all (${activities.length})`}
            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
