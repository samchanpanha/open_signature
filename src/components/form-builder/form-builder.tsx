'use client';

import React, { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export interface FormFieldData {
  id: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'signature' | 'email' | 'textarea';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  defaultValue?: string;
  validation?: Record<string, any>;
}

interface DraggableFieldProps {
  field: FormFieldData;
  onEdit: (field: FormFieldData) => void;
  onDelete: (id: string) => void;
}

function DraggableField({ field, onEdit, onDelete }: DraggableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      text: '📝',
      number: '🔢',
      date: '📅',
      select: '📋',
      checkbox: '☑️',
      signature: '✍️',
      email: '📧',
      textarea: '📄',
    };
    return icons[type] || '❓';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      
      <span className="text-xl">{getTypeIcon(field.type)}</span>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{field.label}</p>
        <p className="text-xs text-gray-500 capitalize">{field.type}</p>
      </div>

      {field.required && (
        <span className="text-red-500 text-xs font-bold">*</span>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(field)}
        className="h-8 w-8"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(field.id)}
        className="h-8 w-8 text-red-500 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface FieldPaletteProps {
  onAddField: (type: FormFieldData['type']) => void;
}

function FieldPalette({ onAddField }: FieldPaletteProps) {
  const fieldTypes: { type: FormFieldData['type']; label: string; icon: string }[] = [
    { type: 'text', label: 'Text Input', icon: '📝' },
    { type: 'number', label: 'Number', icon: '🔢' },
    { type: 'email', label: 'Email', icon: '📧' },
    { type: 'textarea', label: 'Text Area', icon: '📄' },
    { type: 'date', label: 'Date Picker', icon: '📅' },
    { type: 'select', label: 'Dropdown', icon: '📋' },
    { type: 'checkbox', label: 'Checkbox', icon: '☑️' },
    { type: 'signature', label: 'Signature', icon: '✍️' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Form Fields</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {fieldTypes.map((fieldType) => (
            <Button
              key={fieldType.type}
              variant="outline"
              className="flex flex-col items-center justify-center h-20 gap-1 hover:bg-gray-50"
              onClick={() => onAddField(fieldType.type)}
            >
              <span className="text-2xl">{fieldType.icon}</span>
              <span className="text-xs">{fieldType.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FieldEditorDialogProps {
  field: FormFieldData | null;
  open: boolean;
  onClose: () => void;
  onSave: (field: FormFieldData) => void;
}

function FieldEditorDialog({ field, open, onClose, onSave }: FieldEditorDialogProps) {
  const [editedField, setEditedField] = useState<FormFieldData | null>(null);
  const [optionsText, setOptionsText] = useState('');

  React.useEffect(() => {
    if (field) {
      setEditedField({ ...field });
      setOptionsText(field.options?.join('\n') || '');
    }
  }, [field]);

  if (!editedField) return null;

  const handleSave = () => {
    if (!editedField.label.trim()) {
      alert('Label is required');
      return;
    }

    const finalField = {
      ...editedField,
      options:
        editedField.type === 'select' && optionsText.trim()
          ? optionsText.split('\n').filter((o) => o.trim())
          : undefined,
    };

    onSave(finalField);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Field</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                value={editedField.label}
                onChange={(e) =>
                  setEditedField({ ...editedField, label: e.target.value })
                }
                placeholder="Enter field label"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Field Type</Label>
              <Select
                value={editedField.type}
                onValueChange={(value: FormFieldData['type']) =>
                  setEditedField({ ...editedField, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Input</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="textarea">Text Area</SelectItem>
                  <SelectItem value="date">Date Picker</SelectItem>
                  <SelectItem value="select">Dropdown</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="signature">Signature</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="placeholder">Placeholder</Label>
            <Input
              id="placeholder"
              value={editedField.placeholder || ''}
              onChange={(e) =>
                setEditedField({ ...editedField, placeholder: e.target.value })
              }
              placeholder="Enter placeholder text"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultValue">Default Value</Label>
            <Input
              id="defaultValue"
              value={editedField.defaultValue || ''}
              onChange={(e) =>
                setEditedField({ ...editedField, defaultValue: e.target.value })
              }
              placeholder="Enter default value"
            />
          </div>

          {editedField.type === 'select' && (
            <div className="space-y-2">
              <Label htmlFor="options">Options (one per line)</Label>
              <textarea
                id="options"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                className="w-full min-h-[100px] p-2 border rounded-md"
                placeholder="Option 1&#10;Option 2&#10;Option 3"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="required"
              checked={editedField.required}
              onCheckedChange={(checked) =>
                setEditedField({ ...editedField, required: checked })
              }
            />
            <Label htmlFor="required">Required field</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FormBuilderProps {
  initialFields?: FormFieldData[];
  onSave: (fields: FormFieldData[]) => void;
  onCancel?: () => void;
}

export function FormBuilder({ initialFields = [], onSave, onCancel }: FormBuilderProps) {
  const [fields, setFields] = useState<FormFieldData[]>(initialFields);
  const [editingField, setEditingField] = useState<FormFieldData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAddField = useCallback((type: FormFieldData['type']) => {
    const newField: FormFieldData = {
      id: generateId(),
      type,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      placeholder: '',
      required: false,
      options: type === 'select' ? ['Option 1', 'Option 2'] : undefined,
    };

    setFields((prev) => [...prev, newField]);
    setEditingField(newField);
    setIsDialogOpen(true);
  }, []);

  const handleEditField = useCallback((field: FormFieldData) => {
    setEditingField(field);
    setIsDialogOpen(true);
  }, []);

  const handleDeleteField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleSaveField = useCallback((updatedField: FormFieldData) => {
    setFields((prev) =>
      prev.map((f) => (f.id === updatedField.id ? updatedField : f))
    );
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleSave = useCallback(() => {
    onSave(fields);
  }, [fields, onSave]);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Panel - Field Palette */}
        <div className="md:col-span-1">
          <FieldPalette onAddField={handleAddField} />
        </div>

        {/* Right Panel - Form Canvas */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Form Canvas</CardTitle>
              <div className="flex gap-2">
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
                <Button onClick={handleSave}>
                  Save Form
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-lg">
                  <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No fields yet</p>
                  <p className="text-sm">Click on a field type from the left to add it</p>
                </div>
              ) : (
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {fields.map((field) => (
                      <DraggableField
                        key={field.id}
                        field={field}
                        onEdit={handleEditField}
                        onDelete={handleDeleteField}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </CardContent>
          </Card>

          {fields.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                  {fields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <label className="text-sm font-medium">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          className="w-full p-2 border rounded-md bg-white"
                          placeholder={field.placeholder}
                          disabled
                        />
                      ) : field.type === 'select' ? (
                        <select className="w-full p-2 border rounded-md bg-white" disabled>
                          <option>{field.placeholder || 'Select an option'}</option>
                          {field.options?.map((opt, i) => (
                            <option key={i}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <div className="flex items-center gap-2">
                          <input type="checkbox" disabled />
                          <span className="text-sm text-gray-600">Checkbox</span>
                        </div>
                      ) : field.type === 'signature' ? (
                        <div className="h-20 border-2 border-dashed rounded-md flex items-center justify-center text-gray-400 bg-white">
                          Signature Area
                        </div>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          className="w-full p-2 border rounded-md bg-white"
                          placeholder={field.placeholder}
                          disabled
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <FieldEditorDialog
        field={editingField}
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setEditingField(null);
        }}
        onSave={handleSaveField}
      />
    </DndContext>
  );
}

export default FormBuilder;
