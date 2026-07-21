'use client';

import React, { useState } from 'react';
import { useOrgSettings } from '../org-settings-provider';
import { TeamMemberManager } from '@/components/permissions/team-member-manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, AlertTriangle, Loader2, UserPlus } from 'lucide-react';

export function OrgMembersTab() {
  const {
    orgId, orgDetail, currentRole, isOwner,
    inviteEmail, setInviteEmail, inviteRole, setInviteRole, inviting, inviteMember,
    deleteOrgConfirm, setDeleteOrgConfirm, deletingOrg, deleteOrg,
    updateMemberRole, removeMember,
  } = useOrgSettings();

  return (
    <div className="space-y-6">
      {/* Member Management */}
      <TeamMemberManager
        orgId={orgId}
        currentUserId={useOrgSettings().orgDetail?.ownerId || ''}
        currentUserRole={currentRole}
      />

      {/* Quick Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Quick Invite
          </CardTitle>
          <CardDescription>Send an invitation to a new member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && inviteMember()}
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="signer">Signer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={inviteMember}
              disabled={inviting || !inviteEmail.trim()}
              className="gradient-primary text-white"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Invite'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isOwner && (
        <>
          <Separator />
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
              </CardTitle>
              <CardDescription>Permanently delete this organization and all its data</CardDescription>
            </CardHeader>
            <CardContent>
              {!deleteOrgConfirm ? (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                  onClick={() => setDeleteOrgConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Organization
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                    <AlertTriangle className="w-4 h-4 inline mr-1" /> This will permanently delete the organization.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDeleteOrgConfirm(false)} className="flex-1">Cancel</Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={deleteOrg} disabled={deletingOrg}>
                      {deletingOrg ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4 mr-1" /> Delete</>}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
