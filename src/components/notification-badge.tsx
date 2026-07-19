'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Check, CheckCheck, FileText, Send, Clock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  documentId?: string;
}

interface NotificationBadgeProps {
  userId: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

const typeIcons: Record<string, React.ElementType> = {
  otp_request: Clock,
  document_sent: Send,
  document_completed: CheckCheck,
  document_rejected: FileText,
};

export function NotificationBadge({ userId }: NotificationBadgeProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setNotifications(data.notifications || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadNotifications();
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-[10px] bg-red-500 text-white border-2 border-background rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-lg shadow-lg z-50"
            >
              <div className="flex items-center justify-between p-3 border-b">
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleMarkAllRead}>
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
                ) : (
                  notifications.slice(0, 10).map((notification) => {
                    const Icon = typeIcons[notification.type] || Bell;
                    return (
                      <div
                        key={notification.id}
                        className={`p-3 border-b last:border-b-0 hover:bg-muted cursor-pointer ${
                          !notification.read ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                        }`}
                        onClick={() => handleMarkRead(notification.id)}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            !notification.read ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'
                          }`}>
                            <Icon className={`w-4 h-4 ${!notification.read ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(notification.createdAt)}</p>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
