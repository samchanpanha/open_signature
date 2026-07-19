'use client';

import React, { useState, useEffect } from 'react';
import { FormBuilder, FormFieldData } from '@/components/form-builder/form-builder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, ArrowLeft, Loader2, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ShareTemplateDialog } from '@/components/permissions/share-template-dialog';
import { useAppStore } from '@/lib/store';

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  schema: any;
  fields: FormFieldData[];
  creator: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function FormTemplatesPage() {
  const store = useAppStore();
  const orgId = store.currentOrgId;
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [currentFields, setCurrentFields] = useState<FormFieldData[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [sharingTemplateId, setSharingTemplateId] = useState<string | null>(null);
  const [sharingTemplateName, setSharingTemplateName] = useState('');
  const { toast } = useToast();

  // Fetch templates
  const fetchTemplates = async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const response = await fetch(`/api/form-templates?orgId=${orgId}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load form templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [orgId]);

  const handleStartCreate = () => {
    setEditingTemplate(null);
    setCurrentFields([]);
    setTemplateName('');
    setTemplateDescription('');
    setIsCreating(true);
  };

  const handleEdit = (template: FormTemplate) => {
    setEditingTemplate(template);
    setCurrentFields(template.fields || []);
    setTemplateName(template.name);
    setTemplateDescription(template.description || '');
    setIsCreating(true);
  };

  const handleSaveForm = async (fields: FormFieldData[]) => {
    if (!templateName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Template name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        name: templateName,
        description: templateDescription,
        orgId,
        schema: {},
        fields,
      };

      let response;
      if (editingTemplate) {
        response = await fetch(`/api/form-templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch('/api/form-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) throw new Error('Failed to save template');

      toast({
        title: 'Success',
        description: `Template ${editingTemplate ? 'updated' : 'created'} successfully`,
      });

      setIsCreating(false);
      fetchTemplates();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save template',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/form-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete template');

      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });

      fetchTemplates();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingTemplate(null);
    setCurrentFields([]);
    setTemplateName('');
    setTemplateDescription('');
  };

  if (isCreating) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {editingTemplate ? 'Edit Form Template' : 'Create Form Template'}
            </h1>
            <p className="text-gray-500">
              Design your custom form with drag-and-drop fields
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <FormBuilder
          initialFields={currentFields}
          onSave={handleSaveForm}
          onCancel={handleCancel}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Form Templates</h1>
          <p className="text-gray-500">
            Create and manage reusable form templates for your organization
          </p>
        </div>
        <Button onClick={handleStartCreate}>
          <Plus className="h-5 w-5 mr-2" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No templates yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first form template to get started
            </p>
            <Button onClick={handleStartCreate}>
              <Plus className="h-5 w-5 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{template.name}</CardTitle>
                {template.description && (
                  <CardDescription>{template.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm text-gray-500">
                    <p>Fields: {template.fields?.length || 0}</p>
                    <p>Created: {new Date(template.createdAt).toLocaleDateString()}</p>
                    <p>By: {template.creator.name}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(template)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSharingTemplateId(template.id); setSharingTemplateName(template.name); }}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(template.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {sharingTemplateId && (
        <ShareTemplateDialog
          open={!!sharingTemplateId}
          onOpenChange={(open) => { if (!open) { setSharingTemplateId(null); setSharingTemplateName(''); } }}
          templateId={sharingTemplateId}
          templateName={sharingTemplateName}
        />
      )}
    </div>
  );
}
