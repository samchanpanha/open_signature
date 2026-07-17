/**
 * Alert Engine - Processes and sends notifications for assignments and reminders
 */

import { prisma } from '@/lib/db';
import nodemailer from 'nodemailer';

export interface AlertConfig {
  reminderDaysBefore: number;
  escalationDaysAfter: number;
  maxReminders: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  reminderDaysBefore: 3,
  escalationDaysAfter: 7,
  maxReminders: 5,
};

export class AlertEngine {
  private config: AlertConfig;
  private transporter: any;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Configure email transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Process all pending alerts and send notifications
   */
  async processAlerts(): Promise<{
    sent: number;
    reminders: number;
    escalations: number;
    errors: string[];
  }> {
    const result = {
      sent: 0,
      reminders: 0,
      escalations: 0,
      errors: [] as string[],
    };

    try {
      // Get all pending assignments with due dates
      const now = new Date();
      const reminderDate = new Date(now.getTime() + this.config.reminderDaysBefore * 24 * 60 * 60 * 1000);
      const overdueDate = new Date(now.getTime() - this.config.escalationDaysAfter * 24 * 60 * 60 * 1000);

      // Find assignments needing reminders
      const upcomingAssignments = await prisma.assignment.findMany({
        where: {
          status: { in: ['pending', 'in_progress'] },
          dueDate: {
            lte: reminderDate,
            gte: now,
          },
        },
        include: {
          user: true,
          document: true,
          org: true,
        },
      });

      // Send reminders for upcoming due dates
      for (const assignment of upcomingAssignments) {
        try {
          await this.sendReminder(assignment);
          result.reminders++;
          result.sent++;
        } catch (error) {
          result.errors.push(`Failed to send reminder: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      // Find overdue assignments
      const overdueAssignments = await prisma.assignment.findMany({
        where: {
          status: { in: ['pending', 'in_progress'] },
          dueDate: {
            lt: now,
          },
        },
        include: {
          user: true,
          document: true,
          org: true,
          assigner: true,
        },
      });

      // Send escalation notifications for overdue assignments
      for (const assignment of overdueAssignments) {
        try {
          await this.sendEscalation(assignment);
          result.escalations++;
          result.sent++;
        } catch (error) {
          result.errors.push(`Failed to send escalation: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }

      // Create notifications for new assignments (not yet notified)
      const newAssignments = await prisma.assignment.findMany({
        where: {
          status: 'pending',
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        include: {
          user: true,
          document: true,
        },
      });

      for (const assignment of newAssignments) {
        try {
          await this.createNotification(assignment, 'assignment');
          result.sent++;
        } catch (error) {
          result.errors.push(`Failed to create notification: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Alert processing failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    return result;
  }

  /**
   * Send reminder email to user
   */
  private async sendReminder(assignment: any): Promise<void> {
    const daysUntilDue = assignment.dueDate 
      ? Math.ceil((assignment.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: assignment.user.email,
      subject: `Reminder: Document signing due soon - ${assignment.document.title}`,
      html: `
        <h2>Signing Reminder</h2>
        <p>Hello ${assignment.user.name},</p>
        <p>This is a friendly reminder that you have a document awaiting your signature:</p>
        <p><strong>${assignment.document.title}</strong></p>
        <p>Due date: ${assignment.dueDate?.toLocaleDateString() || 'Not set'}</p>
        <p>Days remaining: ${daysUntilDue}</p>
        <p>Please complete the signing process at your earliest convenience.</p>
      `,
    });

    // Create in-app notification
    await this.createNotification(assignment, 'reminder');
  }

  /**
   * Send escalation email to assigner/manager
   */
  private async sendEscalation(assignment: any): Promise<void> {
    const daysOverdue = assignment.dueDate 
      ? Math.ceil((new Date().getTime() - assignment.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: assignment.assigner.email,
      cc: assignment.user.email,
      subject: `OVERDUE: Document signing - ${assignment.document.title}`,
      html: `
        <h2>Overdue Document Alert</h2>
        <p>Hello ${assignment.assigner.name},</p>
        <p>The following document is overdue for signature:</p>
        <p><strong>${assignment.document.title}</strong></p>
        <p>Assigned to: ${assignment.user.name} (${assignment.user.email})</p>
        <p>Due date was: ${assignment.dueDate?.toLocaleDateString() || 'Not set'}</p>
        <p>Days overdue: ${daysOverdue}</p>
        <p>Please follow up with the assigned user.</p>
      `,
    });

    // Create in-app notifications
    await this.createNotification(assignment, 'overdue');
  }

  /**
   * Create in-app notification
   */
  private async createNotification(assignment: any, type: string): Promise<void> {
    let title = '';
    let message = '';

    switch (type) {
      case 'assignment':
        title = 'New Assignment';
        message = `You have been assigned to sign: ${assignment.document.title}`;
        break;
      case 'reminder':
        title = 'Signing Reminder';
        message = `Reminder: ${assignment.document.title} is due soon`;
        break;
      case 'overdue':
        title = 'Document Overdue';
        message = `${assignment.document.title} is overdue for your signature`;
        break;
    }

    await prisma.notification.create({
      data: {
        type,
        title,
        message,
        userId: assignment.user.id,
        documentId: assignment.documentId,
      },
    });
  }
}

// Singleton instance
let alertEngineInstance: AlertEngine | null = null;

export function getAlertEngine(): AlertEngine {
  if (!alertEngineInstance) {
    alertEngineInstance = new AlertEngine();
  }
  return alertEngineInstance;
}
