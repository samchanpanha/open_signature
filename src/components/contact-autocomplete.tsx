'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Contact } from '@/lib/api';
import { User, Mail } from 'lucide-react';

interface ContactAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (contact: Contact) => void;
  contacts: Contact[];
  placeholder?: string;
  type?: 'email' | 'name';
  className?: string;
}

export function ContactAutocomplete({
  value,
  onChange,
  onSelect,
  contacts,
  placeholder = 'Email or name...',
  type = 'email',
  className,
}: ContactAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState<Contact[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value || value.length < 1) {
      setFiltered(contacts.slice(0, 5));
      return;
    }
    const lower = value.toLowerCase();
    const matches = contacts.filter(c =>
      c.email.toLowerCase().includes(lower) ||
      (c.name && c.name.toLowerCase().includes(lower))
    ).slice(0, 5);
    setFiltered(matches);
  }, [value, contacts]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (contact: Contact) => {
    if (type === 'email') {
      onChange(contact.email);
    } else {
      onChange(contact.name || contact.email);
    }
    onSelect?.(contact);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg py-1 max-h-[200px] overflow-y-auto">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
              onClick={() => handleSelect(contact)}
            >
              <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                {contact.name?.charAt(0)?.toUpperCase() || contact.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {contact.name && <p className="text-sm font-medium truncate">{contact.name}</p>}
                <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
