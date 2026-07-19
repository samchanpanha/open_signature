'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GitCompareArrows, ArrowRight, Clock } from 'lucide-react';

interface Version {
  id: string;
  version: number;
  label?: string;
  createdAt: string;
  createdByName?: string;
  notes?: string;
}

interface VersionDiffProps {
  documentId: string;
  versions: Version[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionDiff({ documentId, versions, open, onOpenChange }: VersionDiffProps) {
  const [vAId, setVAId] = useState('');
  const [vBId, setVBId] = useState('');

  const vA = versions.find(v => v.id === vAId);
  const vB = versions.find(v => v.id === vBId);

  useEffect(() => {
    if (versions.length >= 2) {
      setVAId(versions[versions.length - 2].id);
      setVBId(versions[versions.length - 1].id);
    }
  }, [versions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="w-5 h-5" />
            Compare Versions
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Version A (older)</label>
            <Select value={vAId} onValueChange={setVAId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version} - {v.label || new Date(v.createdAt).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Version B (newer)</label>
            <Select value={vBId} onValueChange={setVBId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version} - {v.label || new Date(v.createdAt).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {vA && vB && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">v{vA.version}</Badge>
                  <span className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(vA.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{vA.label || 'Version ' + vA.version}</p>
                {vA.notes && <p className="text-xs text-muted-foreground mt-1">{vA.notes}</p>}
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="p-3 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">v{vB.version}</Badge>
                  <span className="text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(vB.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm font-medium">{vB.label || 'Version ' + vB.version}</p>
                {vB.notes && <p className="text-xs text-muted-foreground mt-1">{vB.notes}</p>}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Changes:</p>
              <div className="space-y-1.5">
                {vA.notes !== vB.notes && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Notes:</span>
                    <span className="text-red-500 line-through text-xs">{vA.notes || '(none)'}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-emerald-600 text-xs">{vB.notes || '(none)'}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="text-xs">v{vA.version}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="text-xs font-medium">v{vB.version}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {versions.length < 2 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Need at least 2 versions to compare
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
