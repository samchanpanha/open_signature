'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GitCompareArrows, Plus, Minus, ArrowRight, FileText } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  signerCount?: number;
  signedCount?: number;
}

interface DocumentComparisonProps {
  documents: Document[];
  initialDocId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusChanges(docA: Document, docB: Document) {
  const changes: { type: 'added' | 'removed' | 'changed'; field: string; from?: string; to?: string }[] = [];
  
  if (docA.status !== docB.status) {
    changes.push({ type: 'changed', field: 'Status', from: docA.status, to: docB.status });
  }
  
  if ((docA.signerCount || 0) !== (docB.signerCount || 0)) {
    changes.push({ 
      type: 'changed', 
      field: 'Signers', 
      from: String(docA.signerCount || 0), 
      to: String(docB.signerCount || 0) 
    });
  }

  if ((docA.signedCount || 0) !== (docB.signedCount || 0)) {
    changes.push({
      type: 'changed',
      field: 'Signed',
      from: String(docA.signedCount || 0),
      to: String(docB.signedCount || 0),
    });
  }

  const dateA = new Date(docA.createdAt);
  const dateB = new Date(docB.createdAt);
  if (dateA.getTime() !== dateB.getTime()) {
    changes.push({
      type: 'changed',
      field: 'Created',
      from: dateA.toLocaleDateString(),
      to: dateB.toLocaleDateString(),
    });
  }

  return changes;
}

export function DocumentComparison({ documents, initialDocId, open, onOpenChange }: DocumentComparisonProps) {
  const docAIdState = useState(initialDocId || '');
  const docBIdState = useState('');
  const docAId = docAIdState[0], setDocAId = docAIdState[1];
  const docBId = docBIdState[0], setDocBId = docBIdState[1];

  const docA = documents.find(d => d.id === docAId);
  const docB = documents.find(d => d.id === docBId);
  const changes = docA && docB ? getStatusChanges(docA, docB) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="w-5 h-5" />
            Compare Documents
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Document A</label>
            <Select value={docAId} onValueChange={setDocAId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {documents.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Document B</label>
            <Select value={docBId} onValueChange={setDocBId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {documents.filter(d => d.id !== docAId).map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {docA && docB && (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Document A</p>
                <p className="text-sm font-medium truncate">{docA.title}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">{docA.status}</Badge>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Document B</p>
                <p className="text-sm font-medium truncate">{docB.title}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">{docB.status}</Badge>
              </div>
            </div>

            {changes.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Differences:</p>
                {changes.map((change, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30">
                    {change.type === 'changed' && (
                      <>
                        <span className="font-medium">{change.field}:</span>
                        <span className="text-red-500 line-through text-xs">{change.from}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-emerald-600 text-xs">{change.to}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No differences found</p>
            )}
          </div>
        )}

        {!docA || !docB ? (
          <p className="text-sm text-muted-foreground text-center py-4">Select two documents to compare</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
