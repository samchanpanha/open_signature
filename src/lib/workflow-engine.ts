import { db } from '@/lib/db';

interface WorkflowConditionContext {
  amount?: number;
  department?: string;
  signerCount?: number;
  documentType?: string;
  documentTitle?: string;
  dateCreated?: string;
  priority?: string;
  region?: string;
  contractValue?: number;
  customFields?: Record<string, any>;
}

interface WorkflowEvaluationResult {
  currentNodeId: string;
  nextNodeId: string | null;
  edgeType: 'default' | 'true' | 'false' | 'parallel';
  shouldProceed: boolean;
  reason?: string;
}

interface WorkflowAnalytics {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageCompletionTime: number; // hours
  averageTimePerStep: Record<string, number>;
  bottleneckStep: string | null;
  slaViolations: number;
  onTimeRate: number;
}

export class WorkflowEngine {
  private workflowId: string;
  private steps: any[] = [];
  private edges: any[] = [];

  constructor(workflowId: string) {
    this.workflowId = workflowId;
  }

  async load(): Promise<void> {
    const workflow = await db.signatureWorkflow.findUnique({
      where: { id: this.workflowId },
      include: {
        steps: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { order: 'asc' },
        },
        edges: true,
      },
    });

    if (!workflow) throw new Error('Workflow not found');
    this.steps = workflow.steps;
    this.edges = workflow.edges;
  }

  getStartNode(): any {
    return this.steps.find(s => s.stepType === 'start') || this.steps[0];
  }

  getEndNode(): any {
    return this.steps.find(s => s.stepType === 'end');
  }

  getStepById(id: string): any {
    return this.steps.find(s => s.id === id);
  }

  getOutgoingEdges(nodeId: string): any[] {
    return this.edges.filter(e => e.sourceStepId === nodeId);
  }

  getIncomingEdges(nodeId: string): any[] {
    return this.edges.filter(e => e.targetStepId === nodeId);
  }

  evaluateCondition(step: any, context: WorkflowConditionContext): boolean {
    if (step.stepType !== 'condition' || !step.conditionRules) return true;

    const rules = JSON.parse(step.conditionRules);

    // Support compound conditions
    if (rules.conditions && Array.isArray(rules.conditions)) {
      return this.evaluateCompoundConditions(rules.conditions, context);
    }

    // Simple condition
    const { field, operator, value } = rules;
    return this.evaluateSingleCondition(field, operator, value, context);
  }

  private evaluateCompoundConditions(conditions: Array<{ field: string; operator: string; value: string; logic: 'AND' | 'OR' }>, context: WorkflowConditionContext): boolean {
    if (conditions.length === 0) return true;

    let result = true;
    let currentLogic: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      const condResult = this.evaluateSingleCondition(cond.field, cond.operator, cond.value, context);

      if (i === 0) {
        result = condResult;
      } else {
        if (currentLogic === 'AND') {
          result = result && condResult;
        } else {
          result = result || condResult;
        }
      }
      currentLogic = cond.logic;
    }

    return result;
  }

  private evaluateSingleCondition(field: string, operator: string, comparisonValue: string, context: WorkflowConditionContext): boolean {
    let fieldValue: any;

    switch (field) {
      case 'amount':
        fieldValue = context.amount;
        break;
      case 'contract_value':
        fieldValue = context.contractValue;
        break;
      case 'department':
        fieldValue = context.department;
        break;
      case 'signer_count':
        fieldValue = context.signerCount;
        break;
      case 'document_type':
        fieldValue = context.documentType;
        break;
      case 'document_title':
        fieldValue = context.documentTitle;
        break;
      case 'date_created':
        fieldValue = context.dateCreated;
        break;
      case 'priority':
        fieldValue = context.priority;
        break;
      case 'region':
        fieldValue = context.region;
        break;
      case 'custom_field':
        fieldValue = context.customFields?.[field];
        break;
      default:
        return true;
    }

    if (fieldValue === undefined || fieldValue === null) {
      if (operator === 'is_empty') return true;
      if (operator === 'is_not_empty') return false;
      return true;
    }

    const strValue = String(fieldValue);
    const numValue = Number(fieldValue);
    const compNum = Number(comparisonValue);

    switch (operator) {
      case 'equals':
        return strValue === String(comparisonValue);
      case 'not_equals':
        return strValue !== String(comparisonValue);
      case '>':
        return numValue > compNum;
      case '<':
        return numValue < compNum;
      case '>=':
        return numValue >= compNum;
      case '<=':
        return numValue <= compNum;
      case 'contains':
        return strValue.toLowerCase().includes(String(comparisonValue).toLowerCase());
      case 'not_contains':
        return !strValue.toLowerCase().includes(String(comparisonValue).toLowerCase());
      case 'starts_with':
        return strValue.toLowerCase().startsWith(String(comparisonValue).toLowerCase());
      case 'ends_with':
        return strValue.toLowerCase().endsWith(String(comparisonValue).toLowerCase());
      case 'is_empty':
        return !strValue || strValue.trim() === '';
      case 'is_not_empty':
        return !!strValue && strValue.trim() !== '';
      case 'between':
        return true; // Handled separately with conditionValue2
      default:
        return true;
    }
  }

  async evaluate(currentNodeId: string, context: WorkflowConditionContext = {}): Promise<WorkflowEvaluationResult> {
    const currentNode = this.getStepById(currentNodeId);
    if (!currentNode) {
      return {
        currentNodeId,
        nextNodeId: null,
        edgeType: 'default',
        shouldProceed: false,
        reason: 'Current node not found',
      };
    }

    if (currentNode.stepType === 'end') {
      return {
        currentNodeId,
        nextNodeId: null,
        edgeType: 'default',
        shouldProceed: false,
        reason: 'Reached workflow end',
      };
    }

    const outgoing = this.getOutgoingEdges(currentNodeId);

    if (currentNode.stepType === 'condition') {
      const conditionResult = this.evaluateCondition(currentNode, context);
      const edgeType = conditionResult ? 'true' : 'false';
      const matchingEdge = outgoing.find(e => e.edgeType === edgeType);

      if (!matchingEdge) {
        const defaultEdge = outgoing.find(e => e.edgeType === 'default');
        return {
          currentNodeId,
          nextNodeId: defaultEdge?.targetStepId || null,
          edgeType: 'default',
          shouldProceed: !!defaultEdge,
          reason: conditionResult ? 'Condition true (no true edge)' : 'Condition false (no false edge)',
        };
      }

      return {
        currentNodeId,
        nextNodeId: matchingEdge.targetStepId,
        edgeType,
        shouldProceed: true,
        reason: conditionResult ? 'Condition evaluated true' : 'Condition evaluated false',
      };
    }

    if (currentNode.stepType === 'parallel') {
      return {
        currentNodeId,
        nextNodeId: outgoing[0]?.targetStepId || null,
        edgeType: 'parallel',
        shouldProceed: outgoing.length > 0,
        reason: `Parallel branch: ${outgoing.length} paths`,
      };
    }

    const defaultEdge = outgoing[0];
    return {
      currentNodeId,
      nextNodeId: defaultEdge?.targetStepId || null,
      edgeType: 'default',
      shouldProceed: !!defaultEdge,
      reason: defaultEdge ? 'Proceeding to next step' : 'No outgoing edge',
    };
  }

  async getNextStepForUser(userId: string, context: WorkflowConditionContext = {}): Promise<any> {
    const userSteps = this.steps.filter(
      s => s.userId === userId && s.stepType !== 'start' && s.stepType !== 'end' && s.stepType !== 'condition'
    );

    for (const step of userSteps) {
      const incoming = this.edges.filter(e => e.targetStepId === step.id);
      if (incoming.length === 0) continue;
      return step;
    }

    return null;
  }

  async getAnalytics(): Promise<WorkflowAnalytics> {
    const documents = await db.document.findMany({
      where: { workflowId: this.workflowId },
      include: { auditLogs: true },
    });

    const totalExecutions = documents.length;
    const completedExecutions = documents.filter(d => d.status === 'Completed').length;
    const failedExecutions = documents.filter(d => d.status === 'Rejected').length;

    let totalTime = 0;
    const stepTimes: Record<string, number[]> = {};

    for (const doc of documents) {
      if (doc.status === 'Completed' && doc.auditLogs.length >= 2) {
        const firstLog = doc.auditLogs[0];
        const lastLog = doc.auditLogs[doc.auditLogs.length - 1];
        const hours = (lastLog.createdAt.getTime() - firstLog.createdAt.getTime()) / (1000 * 60 * 60);
        totalTime += hours;
      }
    }

    const averageCompletionTime = completedExecutions > 0 ? totalTime / completedExecutions : 0;

    const onTimeRate = totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 100;

    return {
      totalExecutions,
      completedExecutions,
      failedExecutions,
      averageCompletionTime,
      averageTimePerStep: {},
      bottleneckStep: null,
      slaViolations: 0,
      onTimeRate,
    };
  }

  static async seedTemplates(): Promise<void> {
    const templates = [
      {
        name: 'Simple Sign',
        description: 'One person signs the document',
        category: 'general',
        icon: 'FileText',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'sign1', type: 'sign', name: 'Sign', x: 300, y: 180, order: 1 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 310 },
        ],
        edges: [
          { source: 'start', target: 'sign1', type: 'default' },
          { source: 'sign1', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'Two-Party Sign',
        description: 'Two people sign in sequence',
        category: 'general',
        icon: 'Users',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'sign1', type: 'sign', name: 'Party 1 Signs', x: 300, y: 180, order: 1 },
          { id: 'sign2', type: 'sign', name: 'Party 2 Signs', x: 300, y: 310, order: 2 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 440 },
        ],
        edges: [
          { source: 'start', target: 'sign1', type: 'default' },
          { source: 'sign1', target: 'sign2', type: 'default' },
          { source: 'sign2', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'Approve then Sign',
        description: 'Manager approves, then employee signs',
        category: 'hr',
        icon: 'CheckCircle2',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'approve1', type: 'approve', name: 'Manager Approval', x: 300, y: 180, order: 1 },
          { id: 'sign1', type: 'sign', name: 'Employee Signs', x: 300, y: 310, order: 2 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 440 },
        ],
        edges: [
          { source: 'start', target: 'approve1', type: 'default' },
          { source: 'approve1', target: 'sign1', type: 'default' },
          { source: 'sign1', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'Finance Approval',
        description: 'Amount-based branching: under $10K auto-approve, over $10K needs VP',
        category: 'finance',
        icon: 'DollarSign',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'condition1', type: 'condition', name: 'Amount Check', x: 300, y: 180,
            conditionRules: JSON.stringify({ field: 'amount', operator: '<', value: '10000' }) },
          { id: 'sign1', type: 'sign', name: 'Auto-Process', x: 150, y: 310, order: 1 },
          { id: 'approve1', type: 'approve', name: 'VP Approval', x: 450, y: 310, order: 2 },
          { id: 'sign2', type: 'sign', name: 'Finance Signs', x: 450, y: 440, order: 3 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 570 },
        ],
        edges: [
          { source: 'start', target: 'condition1', type: 'default' },
          { source: 'condition1', target: 'sign1', type: 'true', label: 'Under $10K' },
          { source: 'condition1', target: 'approve1', type: 'false', label: 'Over $10K' },
          { source: 'sign1', target: 'end', type: 'default' },
          { source: 'approve1', target: 'sign2', type: 'default' },
          { source: 'sign2', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'Parallel Signatures',
        description: 'Multiple people sign simultaneously',
        category: 'general',
        icon: 'Zap',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'parallel1', type: 'parallel', name: 'Parallel', x: 300, y: 180 },
          { id: 'sign1', type: 'sign', name: 'Party A Signs', x: 150, y: 310, order: 1 },
          { id: 'sign2', type: 'sign', name: 'Party B Signs', x: 450, y: 310, order: 2 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 440 },
        ],
        edges: [
          { source: 'start', target: 'parallel1', type: 'default' },
          { source: 'parallel1', target: 'sign1', type: 'parallel' },
          { source: 'parallel1', target: 'sign2', type: 'parallel' },
          { source: 'sign1', target: 'end', type: 'default' },
          { source: 'sign2', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'HR Onboarding',
        description: 'Complete onboarding: review docs, sign offer, get approvals',
        category: 'hr',
        icon: 'UserPlus',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'review1', type: 'review', name: 'HR Reviews', x: 300, y: 160, order: 1 },
          { id: 'sign1', type: 'sign', name: 'Candidate Signs Offer', x: 300, y: 270, order: 2 },
          { id: 'parallel1', type: 'parallel', name: 'Parallel', x: 300, y: 380 },
          { id: 'cc1', type: 'cc', name: 'Notify IT', x: 150, y: 490, order: 3 },
          { id: 'cc2', type: 'cc', name: 'Notify Payroll', x: 450, y: 490, order: 4 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 600 },
        ],
        edges: [
          { source: 'start', target: 'review1', type: 'default' },
          { source: 'review1', target: 'sign1', type: 'default' },
          { source: 'sign1', target: 'parallel1', type: 'default' },
          { source: 'parallel1', target: 'cc1', type: 'parallel' },
          { source: 'parallel1', target: 'cc2', type: 'parallel' },
          { source: 'cc1', target: 'end', type: 'default' },
          { source: 'cc2', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'Legal Review',
        description: 'Legal team reviews, approves, then parties sign',
        category: 'legal',
        icon: 'Scale',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'review1', type: 'review', name: 'Legal Review', x: 300, y: 160, order: 1 },
          { id: 'condition1', type: 'condition', name: 'Approved?', x: 300, y: 270,
            conditionRules: JSON.stringify({ field: 'custom_field', operator: 'equals', value: 'approved' }) },
          { id: 'sign1', type: 'sign', name: 'Party A Signs', x: 150, y: 380, order: 2 },
          { id: 'sign2', type: 'sign', name: 'Party B Signs', x: 150, y: 490, order: 3 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 600 },
        ],
        edges: [
          { source: 'start', target: 'review1', type: 'default' },
          { source: 'review1', target: 'condition1', type: 'default' },
          { source: 'condition1', target: 'sign1', type: 'true', label: 'Approved' },
          { source: 'condition1', target: 'end', type: 'false', label: 'Rejected' },
          { source: 'sign1', target: 'sign2', type: 'default' },
          { source: 'sign2', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'Sales Contract',
        description: 'Sales review -> Customer signs -> Finance processes',
        category: 'sales',
        icon: 'TrendingUp',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'review1', type: 'review', name: 'Sales Manager Review', x: 300, y: 160, order: 1 },
          { id: 'sign1', type: 'sign', name: 'Customer Signs', x: 300, y: 270, order: 2 },
          { id: 'sign2', type: 'sign', name: 'Finance Processes', x: 300, y: 380, order: 3 },
          { id: 'cc1', type: 'cc', name: 'Notify Sales Team', x: 300, y: 490, order: 4 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 600 },
        ],
        edges: [
          { source: 'start', target: 'review1', type: 'default' },
          { source: 'review1', target: 'sign1', type: 'default' },
          { source: 'sign1', target: 'sign2', type: 'default' },
          { source: 'sign2', target: 'cc1', type: 'default' },
          { source: 'cc1', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'Regional Approval',
        description: 'Route by region with department-specific review',
        category: 'general',
        icon: 'Globe',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'condition1', type: 'condition', name: 'Region Check', x: 300, y: 180,
            conditionRules: JSON.stringify({ conditions: [
              { field: 'region', operator: 'equals', value: 'APAC', logic: 'OR' },
              { field: 'region', operator: 'equals', value: 'EMEA', logic: 'OR' },
            ] }) },
          { id: 'sign1', type: 'sign', name: 'Regional Manager', x: 150, y: 310, order: 1 },
          { id: 'sign2', type: 'sign', name: 'Global Director', x: 450, y: 310, order: 2 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 440 },
        ],
        edges: [
          { source: 'start', target: 'condition1', type: 'default' },
          { source: 'condition1', target: 'sign1', type: 'true', label: 'APAC/EMEA' },
          { source: 'condition1', target: 'sign2', type: 'false', label: 'Other' },
          { source: 'sign1', target: 'end', type: 'default' },
          { source: 'sign2', target: 'end', type: 'default' },
        ],
      },
      {
        name: 'Priority Escalation',
        description: 'Route high-priority documents through escalation chain',
        category: 'general',
        icon: 'AlertTriangle',
        steps: [
          { id: 'start', type: 'start', name: 'Start', x: 300, y: 50 },
          { id: 'condition1', type: 'condition', name: 'Priority Check', x: 300, y: 180,
            conditionRules: JSON.stringify({ field: 'priority', operator: 'equals', value: 'high' }) },
          { id: 'approve1', type: 'approve', name: 'VP Review', x: 150, y: 310, order: 1 },
          { id: 'sign1', type: 'sign', name: 'Standard Process', x: 450, y: 310, order: 2 },
          { id: 'end', type: 'end', name: 'End', x: 300, y: 440 },
        ],
        edges: [
          { source: 'start', target: 'condition1', type: 'default' },
          { source: 'condition1', target: 'approve1', type: 'true', label: 'High Priority' },
          { source: 'condition1', target: 'sign1', type: 'false', label: 'Normal' },
          { source: 'approve1', target: 'end', type: 'default' },
          { source: 'sign1', target: 'end', type: 'default' },
        ],
      },
    ];

    for (const template of templates) {
      const existing = await db.workflowTemplate.findFirst({ where: { name: template.name } });
      if (!existing) {
        await db.workflowTemplate.create({
          data: {
            name: template.name,
            description: template.description,
            category: template.category,
            icon: template.icon,
            steps: JSON.stringify(template.steps),
            edges: JSON.stringify(template.edges),
            isPublic: true,
          },
        });
      }
    }
  }
}
