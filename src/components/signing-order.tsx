'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, ArrowUp, ArrowDown, Hash } from 'lucide-react';

interface Signer {
  id: string;
  email: string;
  name?: string;
  order?: number;
  status: string;
}

interface SigningOrderProps {
  signers: Signer[];
  onOrderChange: (orderedSigners: { id: string; order: number }[]) => void;
  disabled?: boolean;
}

export function SigningOrder({ signers, onOrderChange, disabled }: SigningOrderProps) {
  const [orderedSigners, setOrderedSigners] = useState<Signer[]>(
    [...signers].sort((a, b) => (a.order || 0) - (b.order || 0))
  );

  useEffect(() => {
    setOrderedSigners([...signers].sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, [signers]);

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrdered = [...orderedSigners];
    [newOrdered[index - 1], newOrdered[index]] = [newOrdered[index], newOrdered[index - 1]];
    setOrderedSigners(newOrdered);
    updateOrders(newOrdered);
  };

  const moveDown = (index: number) => {
    if (index === orderedSigners.length - 1) return;
    const newOrdered = [...orderedSigners];
    [newOrdered[index], newOrdered[index + 1]] = [newOrdered[index + 1], newOrdered[index]];
    setOrderedSigners(newOrdered);
    updateOrders(newOrdered);
  };

  const updateOrders = (s: Signer[]) => {
    const ordered = s.map((signer, i) => ({ id: signer.id, order: i + 1 }));
    onOrderChange(ordered);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <Hash className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Signing Order</span>
      </div>

      {orderedSigners.map((signer, index) => (
        <div
          key={signer.id}
          className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
          <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center shrink-0">
            {index + 1}
          </Badge>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{signer.name || signer.email}</p>
            <p className="text-xs text-muted-foreground truncate">{signer.email}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => moveUp(index)}
              disabled={index === 0 || disabled}
            >
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => moveDown(index)}
              disabled={index === orderedSigners.length - 1 || disabled}
            >
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
