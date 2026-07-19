'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Camera, Trash2, Upload, User } from 'lucide-react';
import { toast } from 'sonner';

interface AvatarUploadProps {
  currentAvatar?: string | null;
  userName?: string;
  onAvatarChange: (url: string | null) => void;
}

function getInitials(name?: string) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name?: string) {
  if (!name) return 'bg-blue-500';
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function AvatarUpload({ currentAvatar, userName, onAvatarChange }: AvatarUploadProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: preview }),
      });
      if (res.ok) {
        const data = await res.json();
        onAvatarChange(data.avatarUrl);
        setDialogOpen(false);
        setPreview(null);
        toast.success('Avatar updated');
      } else {
        toast.error('Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/user/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      onAvatarChange(null);
      setDialogOpen(false);
      setPreview(null);
      toast.success('Avatar removed');
    } catch {
      toast.error('Failed to remove avatar');
    }
  };

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => setDialogOpen(true)}>
        {currentAvatar ? (
          <img src={currentAvatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-border" />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm border-2 border-border ${getAvatarColor(userName)}`}>
            {getInitials(userName)}
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Camera className="w-4 h-4 text-white" />
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Avatar</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {preview ? (
              <img src={preview} alt="Preview" className="w-24 h-24 rounded-full object-cover border-2 border-border" />
            ) : currentAvatar ? (
              <img src={currentAvatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-2xl ${getAvatarColor(userName)}`}>
                {getInitials(userName)}
              </div>
            )}
            <p className="text-sm text-muted-foreground">JPG, PNG, WebP or GIF. Max 5MB.</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <DialogFooter className="flex-row gap-2">
            {currentAvatar && (
              <Button variant="destructive" size="sm" onClick={handleRemove} className="mr-auto">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Choose
            </Button>
            <Button size="sm" onClick={handleUpload} disabled={!preview || uploading}>
              {uploading ? 'Uploading...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
