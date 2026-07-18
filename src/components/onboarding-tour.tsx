'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { onboardingApi } from '@/lib/api';

const TOUR_STEPS = [
  { id: 'upload_doc', title: 'Upload a Document', description: 'Start by uploading a PDF document you want to send for signing.' },
  { id: 'add_fields', title: 'Add Signature Fields', description: 'Place signature, text, date, and checkbox fields on your document.' },
  { id: 'send_for_sign', title: 'Send for Signing', description: 'Add signers and send the document. Recipients will receive an email invitation.' },
  { id: 'view_audit', title: 'View Audit Trail', description: 'Track every action on your document with a detailed, timestamped audit trail.' },
  { id: 'create_template', title: 'Create a Template', description: 'Save frequently used documents as templates for quick reuse.' },
  { id: 'setup_org', title: 'Set Up Your Organization', description: 'Create or join an organization to collaborate with your team.' },
  { id: 'invite_member', title: 'Invite Team Members', description: 'Add members to your organization for collaborative document workflows.' },
];

export default function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    const dismissed = localStorage.getItem('opensign_tour_dismissed');
    if (dismissed) return;

    onboardingApi.getStatus().then((status) => {
      setCompletedSteps(status.steps);
      if (!status.isComplete) {
        setTimeout(() => setIsOpen(true), 1000);
      }
    }).catch(() => {});
  }, []);

  const handleComplete = async () => {
    const step = TOUR_STEPS[currentStep];
    try {
      await onboardingApi.completeStep(step.id);
      setCompletedSteps((prev) => [...prev, step.id]);
    } catch {}
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsOpen(false);
      localStorage.setItem('opensign_tour_dismissed', 'true');
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem('opensign_tour_dismissed', 'true');
  };

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isCompleted = completedSteps.includes(step.id);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <Card className="w-[420px] shadow-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Step {currentStep + 1} of {TOUR_STEPS.length}
                  </span>
                  <div className="flex gap-1">
                    {TOUR_STEPS.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          i === currentStep ? 'bg-emerald-600' :
                          i < currentStep ? 'bg-emerald-300' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleDismiss} className="h-6 w-6 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleDismiss}>
                    Skip Tour
                  </Button>
                  <Button size="sm" onClick={handleComplete} className="bg-emerald-600 hover:bg-emerald-700">
                    {currentStep === TOUR_STEPS.length - 1 ? (
                      <><Check className="w-4 h-4 mr-1" /> Finish</>
                    ) : (
                      <>Next <ChevronRight className="w-4 h-4 ml-1" /></>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
