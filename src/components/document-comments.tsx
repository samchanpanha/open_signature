'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, Check, Trash2, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface Comment {
  id: string;
  content: string;
  pageNumber?: number | null;
  resolved: boolean;
  createdAt: string;
  user: { id: string; name?: string; email: string };
}

interface DocumentCommentsProps {
  documentId: string;
  currentUserId: string;
  pageNumber?: number;
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

export function DocumentComments({ documentId, currentUserId, pageNumber }: DocumentCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const loadComments = async () => {
    try {
      const url = pageNumber 
        ? `/api/documents/${documentId}/comments?page=${pageNumber}`
        : `/api/documents/${documentId}/comments`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadComments(); }, [documentId, pageNumber]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ content: newComment, pageNumber }),
      });
      const data = await res.json();
      if (data.comment) {
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async (commentId: string, resolved: boolean) => {
    try {
      await fetch(`/api/documents/${documentId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ commentId, resolved }),
      });
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, resolved } : c));
    } catch {
      // ignore
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await fetch(`/api/documents/${documentId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ commentId }),
      });
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      // ignore
    }
  };

  const unresolved = comments.filter(c => !c.resolved);
  const resolved = comments.filter(c => c.resolved);
  const displayComments = showResolved ? comments : unresolved;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Comments ({unresolved.length})
          {resolved.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs ml-auto"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? 'Hide' : `Show ${resolved.length} resolved`}
              <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showResolved ? 'rotate-180' : ''}`} />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Add comment */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleAddComment}
            disabled={!newComment.trim() || sending}
            className="h-9 w-9 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Comments list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-2">
                <div className="w-7 h-7 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-1/4" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : displayComments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {displayComments.map((comment) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`flex gap-2 ${comment.resolved ? 'opacity-50' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[10px] font-bold text-emerald-700 shrink-0">
                    {comment.user.name?.charAt(0)?.toUpperCase() || comment.user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{comment.user.name || comment.user.email}</span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(comment.createdAt)}</span>
                      {comment.pageNumber && (
                        <Badge variant="outline" className="text-[9px]">p{comment.pageNumber}</Badge>
                      )}
                      {comment.resolved && (
                        <Badge className="text-[9px] bg-green-100 text-green-800"><Check className="w-2 h-2 mr-0.5" /> Resolved</Badge>
                      )}
                    </div>
                    <p className="text-sm mt-0.5">{comment.content}</p>
                    <div className="flex gap-1 mt-1">
                      {!comment.resolved && (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleResolve(comment.id, true)}>
                          Resolve
                        </Button>
                      )}
                      {comment.user.id === currentUserId && (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => handleDelete(comment.id)}>
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}