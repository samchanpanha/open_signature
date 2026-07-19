"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Users, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { contactsApi, contactGroupsApi, type Contact, type ContactGroup } from "@/lib/api";

export function ContactGroupsManager() {
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ContactGroup | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, c] = await Promise.all([contactGroupsApi.list(), contactsApi.list()]);
      setGroups(g);
      setContacts(c);
    } catch (err: any) {
      toast.error(err.message || "Failed to load contact groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setNewName("");
    setSelectedContacts([]);
    setEditOpen(true);
  };

  const openEdit = (group: ContactGroup) => {
    setEditing(group);
    setNewName(group.name);
    setSelectedContacts(group.contacts.map((c) => c.contact.id));
    setEditOpen(true);
  };

  const toggleContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!newName.trim()) { toast.error("Group name is required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await contactGroupsApi.update(editing.id, selectedContacts);
        toast.success("Group updated");
      } else {
        await contactGroupsApi.create({ name: newName.trim(), contactIds: selectedContacts });
        toast.success("Group created");
      }
      setEditOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save group");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (group: ContactGroup) => {
    if (!confirm(`Delete group "${group.name}"?`)) return;
    try {
      await contactGroupsApi.remove(group.id);
      toast.success("Group deleted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete group");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">Loading contact groups...</CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Contact Groups</CardTitle>
            <CardDescription>Organize contacts into reusable groups for bulk sending</CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> New Group
          </Button>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No contact groups yet.</p>
              <p className="text-sm mt-1">Create a group to quickly send documents to multiple contacts.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.contacts.length} contact{g.contacts.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(g)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) setEditOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Group" : "Create Contact Group"}</DialogTitle>
            <DialogDescription>Select the contacts to include in this group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Clients"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label>Contacts ({selectedContacts.length} selected)</Label>
              <div className="border rounded-lg max-h-60 overflow-y-auto p-2 space-y-1">
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No contacts. Add contacts first using the editor's signer autocomplete.
                  </p>
                ) : (
                  contacts.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedContacts.includes(c.id)}
                        onCheckedChange={() => toggleContact(c.id)}
                      />
                      <span className="flex-1">
                        {c.name} <span className="text-muted-foreground">&lt;{c.email}&gt;</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
