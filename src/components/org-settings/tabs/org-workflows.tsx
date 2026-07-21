'use client';

import React from 'react';
import { useOrgSettings } from '../org-settings-provider';
import { WorkflowManager } from '@/components/workflows/workflow-manager';

export function OrgWorkflowsTab() {
  const { orgId, currentRole } = useOrgSettings();
  return <WorkflowManager orgId={orgId} orgRole={currentRole} />;
}
