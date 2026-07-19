'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical, Eye, Edit3, Send, Download, Copy, Trash2,
  Share2, FolderOpen, Tag, Clock, FileDown, History
} from 'lucide-react';

interface DocumentActionsMenuProps {
  document: {
    id: string;
    title: string;
    status: string;
    signedPdfPath?: string | null;
  };
  onView?: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onDownload?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onMove?: () => void;
  onTags?: () => void;
  onExport?: () => void;
  onVersions?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  canSend?: boolean;
}

export function DocumentActionsMenu({
  document,
  onView,
  onEdit,
  onSend,
  onDownload,
  onDuplicate,
  onDelete,
  onShare,
  onMove,
  onTags,
  onExport,
  onVersions,
  canEdit = true,
  canDelete = true,
  canSend = true,
}: DocumentActionsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {onView && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(); setOpen(false); }}>
            <Eye className="w-4 h-4 mr-2" /> View
          </DropdownMenuItem>
        )}
        {canEdit && onEdit && document.status === 'Draft' && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); setOpen(false); }}>
            <Edit3 className="w-4 h-4 mr-2" /> Edit
          </DropdownMenuItem>
        )}
        {canSend && onSend && document.status === 'Draft' && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSend(); setOpen(false); }}>
            <Send className="w-4 h-4 mr-2" /> Send for Signing
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {onDownload && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); setOpen(false); }}>
            <Download className="w-4 h-4 mr-2" /> Download
          </DropdownMenuItem>
        )}
        {onExport && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport(); setOpen(false); }}>
            <FileDown className="w-4 h-4 mr-2" /> Export Pages
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {onShare && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); setOpen(false); }}>
            <Share2 className="w-4 h-4 mr-2" /> Share
          </DropdownMenuItem>
        )}
        {onMove && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMove(); setOpen(false); }}>
            <FolderOpen className="w-4 h-4 mr-2" /> Move to Folder
          </DropdownMenuItem>
        )}
        {onTags && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTags(); setOpen(false); }}>
            <Tag className="w-4 h-4 mr-2" /> Manage Tags
          </DropdownMenuItem>
        )}
        {onVersions && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onVersions(); setOpen(false); }}>
            <History className="w-4 h-4 mr-2" /> Version History
          </DropdownMenuItem>
        )}
        {onDuplicate && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); setOpen(false); }}>
            <Copy className="w-4 h-4 mr-2" /> Duplicate
          </DropdownMenuItem>
        )}
        {canDelete && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onDelete(); setOpen(false); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
