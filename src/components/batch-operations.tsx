'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckSquare, Square, Trash2, FolderOpen, Send, Copy,
  Download, Tag, X, AlertTriangle
} from 'lucide-react';

interface BatchOperationsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkMove: (folderId: string) => void;
  onBulkExport: () => void;
  onBulkTag: (tag: string) => void;
  folders: { id: string; name: string }[];
  documents: any[];
}

export function BatchOperations({
  selectedCount,
  onClearSelection,
  onBulkDelete,
  onBulkMove,
  onBulkExport,
  onBulkTag,
  folders,
  documents,
}: BatchOperationsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [showTagDialog, setShowTagDialog] = useState(false);

  if (selectedCount === 0) return null;

  const handleMove = () => {
    if (selectedFolder) {
      onBulkMove(selectedFolder);
      setShowMoveDialog(false);
      setSelectedFolder('');
    }
  };

  const handleTag = () => {
    if (tagInput.trim()) {
      onBulkTag(tagInput.trim());
      setShowTagDialog(false);
      setTagInput('');
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 animate-in slide-in-from-top">
        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
          {selectedCount} selected
        </Badge>

        <div className="flex items-center gap-1 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowMoveDialog(true)}>
            <FolderOpen className="w-3.5 h-3.5 mr-1" /> Move
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowTagDialog(true)}>
            <Tag className="w-3.5 h-3.5 mr-1" /> Tag
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkExport}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export
          </Button>
          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
        </div>

        <Button size="sm" variant="ghost" onClick={onClearSelection} className="ml-auto">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Delete Documents
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete {selectedCount} document{selectedCount !== 1 ? 's' : ''}? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { onBulkDelete(); setShowDeleteConfirm(false); }}>
              Delete {selectedCount} document{selectedCount !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
          </DialogHeader>
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger>
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {folders.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>Cancel</Button>
            <Button onClick={handleMove} disabled={!selectedFolder}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Enter tag name..."
            className="w-full px-3 py-2 border rounded-lg text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleTag()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>Cancel</Button>
            <Button onClick={handleTag} disabled={!tagInput.trim()}>Add Tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
