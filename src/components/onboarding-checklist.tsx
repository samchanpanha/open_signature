'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, Circle, FileText, Users, Send, Settings, 
  Upload, ChevronRight, X, Rocket 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
  action?: string;
}

interface OnboardingChecklistProps {
  documents: any[];
  orgs: any[];
  onAction: (action: string) => void;
}

export function OnboardingChecklist({ documents, orgs, onAction }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem('onboarding-dismissed');
    if (isDismissed) setDismissed(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('onboarding-dismissed', 'true');
  };

  const steps: OnboardingStep[] = [
    {
      id: 'upload',
      title: 'Upload your first document',
      description: 'Upload a PDF to get started with signing',
      icon: Upload,
      completed: documents.length > 0,
      action: 'upload',
    },
    {
      id: 'fields',
      title: 'Add signature fields',
      description: 'Place signature, date, and text fields on your document',
      icon: FileText,
      completed: documents.some(d => d.signerCount > 0),
      action: 'edit',
    },
    {
      id: 'invite',
      title: 'Add signers',
      description: 'Invite people to sign your document',
      icon: Users,
      completed: documents.some(d => d.signerCount > 1),
      action: 'send',
    },
    {
      id: 'org',
      title: 'Create an organization',
      description: 'Set up a team workspace for collaboration',
      icon: Settings,
      completed: orgs.length > 0,
      action: 'create-org',
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const allCompleted = completedCount === steps.length;

  if (dismissed || allCompleted) return null;

  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Rocket className="w-4 h-4 text-emerald-600" />
            Getting Started
            <Badge variant="secondary" className="text-xs">{completedCount}/{steps.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
              <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="pt-0">
              <div className="space-y-2">
                {steps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        step.completed 
                          ? 'bg-emerald-50 dark:bg-emerald-900/20' 
                          : 'hover:bg-muted cursor-pointer'
                      }`}
                      onClick={() => !step.completed && step.action && onAction(step.action)}
                    >
                      {step.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${step.completed ? 'text-emerald-700 dark:text-emerald-400 line-through' : ''}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  );
                })}
              </div>
              
              {completedCount > 0 && completedCount < steps.length && (
                <div className="mt-3">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedCount / steps.length) * 100}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
