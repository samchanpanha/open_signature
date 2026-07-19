'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  document?: { id: string; title: string; status: string };
}

interface NotificationCenterProps {
  userId?: string;
}

export function NotificationCenter({ userId }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) {
        console.error('Failed to fetch notifications:', res.statusText);
        return;
      }
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read: true }),
      });

      if (res.ok) {
        setNotifications(notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async function clearAll() {
    try {
      const res = await fetch('/api/notifications?all=true', {
        method: 'DELETE',
      });

      if (res.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  async function clearRead() {
    try {
      const res = await fetch('/api/notifications', {
        method: 'DELETE',
      });

      if (res.ok) {
        setNotifications(notifications.filter(n => !n.read));
      }
    } catch (error) {
      console.error('Failed to clear read notifications:', error);
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'assignment':
        return '📋';
      case 'reminder':
        return '⏰';
      case 'overdue':
        return '⚠️';
      case 'status_change':
        return '✅';
      default:
        return '🔔';
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
        <div className="flex items-center justify-between p-2 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="space-x-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => clearRead()}
                title="Clear read notifications"
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearAll}
                title="Clear all notifications"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id}
                className={`p-3 cursor-pointer ${!notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex gap-3 w-full">
                  <div className="text-xl">{getTypeIcon(notification.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${!notification.read ? 'font-bold' : ''}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    {notification.document && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📄 {notification.document.title}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
