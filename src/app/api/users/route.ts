import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, getUserRole } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';

// GET /api/users?orgId=xxx - List all users in an organization
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check user's role
    const role = await getUserRole(user.userId, orgId);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Get all members of the organization
    const memberships = await db.organizationMember.findMany({
      where: { orgId },
      include: {
        user: {
          select: { id: true, email: true, name: true, createdAt: true }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    return NextResponse.json(memberships.map(m => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt,
      createdAt: m.user.createdAt
    })));
  } catch (error) {
    console.error('List users error:', error);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

// POST /api/users - Add a user to an organization
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { email, orgId, role = 'member' } = body;

    if (!email || !orgId) {
      return NextResponse.json({ 
        error: 'Missing required fields: email, orgId' 
      }, { status: 400 });
    }

    // Validate role
    if (!['owner', 'admin', 'member'].includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be one of: owner, admin, member' 
      }, { status: 400 });
    }

    // Check if requesting user has permission to add members
    const requesterRole = await getUserRole(user.userId, orgId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden: Only owners and admins can add members' 
      }, { status: 403 });
    }

    // Prevent non-owners from assigning owner role
    if (role === 'owner' && requesterRole !== 'owner') {
      return NextResponse.json({ 
        error: 'Forbidden: Only owners can assign owner role' 
      }, { status: 403 });
    }

    // Find or create user
    let targetUser = await db.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!targetUser) {
      // Create new user with temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await hashPassword(tempPassword);
      
      targetUser = await db.user.create({
        data: {
          email: email.toLowerCase(),
          name: email.split('@')[0],
          password: hashedPassword
        }
      });

      // In production, send email with temp password
      console.log(`New user created: ${email}, temp password: ${tempPassword}`);
    }

    // Check if already a member
    const existingMembership = await db.organizationMember.findFirst({
      where: { userId: targetUser.id, orgId }
    });

    if (existingMembership) {
      return NextResponse.json({ 
        error: 'User is already a member of this organization' 
      }, { status: 409 });
    }

    // Add membership
    const membership = await db.organizationMember.create({
      data: {
        userId: targetUser.id,
        orgId,
        role
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    return NextResponse.json({
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      joinedAt: membership.joinedAt
    }, { status: 201 });
  } catch (error) {
    console.error('Add user error:', error);
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 });
  }
}

// PUT /api/users - Update user role in organization
export async function PUT(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, orgId, role } = body;

    if (!userId || !orgId || !role) {
      return NextResponse.json({ 
        error: 'Missing required fields: userId, orgId, role' 
      }, { status: 400 });
    }

    // Validate role
    if (!['owner', 'admin', 'member'].includes(role)) {
      return NextResponse.json({ 
        error: 'Invalid role. Must be one of: owner, admin, member' 
      }, { status: 400 });
    }

    // Check if requesting user has permission to update roles
    const requesterRole = await getUserRole(user.userId, orgId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden: Only owners and admins can update roles' 
      }, { status: 403 });
    }

    // Prevent non-owners from assigning owner role
    if (role === 'owner' && requesterRole !== 'owner') {
      return NextResponse.json({ 
        error: 'Forbidden: Only owners can assign owner role' 
      }, { status: 403 });
    }

    // Prevent demoting the last owner
    if (role !== 'owner') {
      const ownerCount = await db.organizationMember.count({
        where: { orgId, role: 'owner' }
      });
      
      if (ownerCount === 1) {
        const targetMembership = await db.organizationMember.findFirst({
          where: { userId, orgId, role: 'owner' }
        });
        
        if (targetMembership) {
          return NextResponse.json({ 
            error: 'Cannot demote the only owner' 
          }, { status: 400 });
        }
      }
    }

    // Update membership
    const membership = await db.organizationMember.update({
      where: {
        userId_orgId: {
          userId,
          orgId
        }
      },
      data: { role },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    return NextResponse.json({
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      joinedAt: membership.joinedAt
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users?userId=xxx&orgId=xxx - Remove user from organization
export async function DELETE(req: NextRequest) {
  try {
    const user = getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const orgId = url.searchParams.get('orgId');

    if (!userId || !orgId) {
      return NextResponse.json({ 
        error: 'Missing required params: userId, orgId' 
      }, { status: 400 });
    }

    // Check if requesting user has permission to remove members
    const requesterRole = await getUserRole(user.userId, orgId);
    if (requesterRole !== 'owner' && requesterRole !== 'admin') {
      return NextResponse.json({ 
        error: 'Forbidden: Only owners and admins can remove members' 
      }, { status: 403 });
    }

    // Prevent removing the last owner
    if (userId !== user.userId) {
      const targetMembership = await db.organizationMember.findFirst({
        where: { userId, orgId, role: 'owner' }
      });

      if (targetMembership) {
        const ownerCount = await db.organizationMember.count({
          where: { orgId, role: 'owner' }
        });

        if (ownerCount === 1) {
          return NextResponse.json({ 
            error: 'Cannot remove the only owner' 
          }, { status: 400 });
        }
      }
    }

    // Delete membership
    await db.organizationMember.delete({
      where: {
        userId_orgId: {
          userId,
          orgId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove user error:', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
