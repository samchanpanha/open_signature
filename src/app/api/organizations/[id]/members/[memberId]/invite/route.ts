import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { AlertEngine } from '@/lib/alerts/alert-engine';

const alertEngine = new AlertEngine();

function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

// POST /api/organizations/[orgId]/members/[memberId]/invite - Send invite notification
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const payload = getAuthUser(req);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: orgId, memberId } = await params;
    const userId = payload.userId as string;

    // Verify caller is owner or admin
    const callerMembership = await db.organizationMember.findFirst({
      where: { orgId, userId },
    });
    if (!callerMembership || (callerMembership.role !== 'owner' && callerMembership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owner or admin can send invites' }, { status: 403 });
    }

    // Get the member and org
    const member = await db.organizationMember.findFirst({
      where: { id: memberId, orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    // Get inviter info
    const inviter = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Create in-app notification for the invited member
    await db.notification.create({
      data: {
        type: 'assignment',
        title: `You've been invited to ${org.name}`,
        message: `${inviter?.name || 'An admin'} has invited you to join "${org.name}" as a ${member.role}. Set your password at /setup-password to activate your account.`,
        userId: member.user.id,
      },
    });

    // Send email notification
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const setupUrl = `${baseUrl}/setup-password?email=${encodeURIComponent(member.user.email)}`;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">You've Been Invited to Join ${org.name}</h2>
        <p>Hello ${member.user.name || 'there'},</p>
        <p><strong>${inviter?.name || 'An admin'}</strong> has invited you to join <strong>${org.name}</strong> as a <strong>${member.role}</strong>.</p>
        <p>To activate your account, please set your password by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${setupUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Set Your Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${setupUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">This invitation was sent by ${inviter?.name || 'an administrator'} from ${org.name}.</p>
      </div>
    `;

    await alertEngine.sendEmail({
      from: process.env.SMTP_FROM || 'OpenSignature <noreply@opesignature.com>',
      to: member.user.email,
      subject: `You've been invited to join ${org.name}`,
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message: `Invite notification sent to ${member.user.email}`,
    });
  } catch (error) {
    console.error('Send invite notification error:', error);
    return NextResponse.json({ error: 'Failed to send invite notification' }, { status: 500 });
  }
}
