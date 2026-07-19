'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
}

const shortcuts: { category: string; items: Shortcut[] }[] = [
  {
    category: 'General',
    items: [
      { keys: ['Ctrl', 'U'], description: 'Upload document' },
      { keys: ['Ctrl', 'K'], description: 'Search documents' },
      { keys: ['Esc'], description: 'Close dialog / Go back' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    category: 'Editor',
    items: [
      { keys: ['S'], description: 'Signature tool' },
      { keys: ['T'], description: 'Text tool' },
      { keys: ['D'], description: 'Date tool' },
      { keys: ['1-9'], description: 'Jump to page' },
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'S'], description: 'Save fields' },
    ],
  },
  {
    category: 'Document List',
    items: [
      { keys: ['↑', '↓'], description: 'Navigate documents' },
      { keys: ['Enter'], description: 'Open document' },
      { keys: ['Delete'], description: 'Delete selected' },
      { keys: ['G'], description: 'Toggle grid/list view' },
    ],
  },
];

interface KeyboardShortcutsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcuts({ open, onOpenChange }: KeyboardShortcutsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.category}</h3>
              <div className="space-y-1">
                {group.items.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <React.Fragment key={j}>
                          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border rounded shadow-sm">
                            {key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
