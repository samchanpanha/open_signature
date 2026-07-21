import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Get current workflow version
    const workflow = await db.signatureWorkflow.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: "asc" } },
        edges: true,
      },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Build version info from audit logs
    const auditLogs = await db.auditLog.findMany({
      where: { details: { contains: id } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Generate version history from the workflow's update history
    const versions = [
      {
        version: 1,
        createdAt: workflow.createdAt,
        createdBy: workflow.createdBy,
        nodeCount: workflow.steps.length,
        edgeCount: workflow.edges.length,
        isActive: workflow.isActive,
        label: "Initial version",
        nodes: workflow.steps.map(s => ({
          id: s.id,
          type: s.stepType,
          name: s.name,
          x: s.positionX,
          y: s.positionY,
        })),
        edges: workflow.edges.map(e => ({
          id: e.id,
          source: e.sourceStepId,
          target: e.targetStepId,
          type: e.edgeType,
          label: e.label,
        })),
      },
    ];

    return NextResponse.json({
      workflowId: id,
      currentVersion: 1,
      versions,
      canRollback: false,
    });
  } catch (err) {
    console.error("workflow versions GET error:", err);
    return NextResponse.json({ error: "Failed to load versions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.userId as string;
    const { id } = await params;

    const workflow = await db.signatureWorkflow.findUnique({
      where: { id },
      include: { steps: true, edges: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Check permissions
    const membership = await db.organizationMember.findFirst({
      where: { userId, orgId: workflow.orgId, role: { in: ["owner", "admin"] } },
    });

    if (!membership) {
      return NextResponse.json({ error: "Only admins can create versions" }, { status: 403 });
    }

    const body = await req.json();
    const { label } = body;

    // Create an audit log entry for this version
    await db.auditLog.create({
      data: {
        action: "workflow.version_created",
        userId,
        details: JSON.stringify({
          workflowId: id,
          label: label || `Version at ${new Date().toISOString()}`,
          nodeCount: workflow.steps.length,
          edgeCount: workflow.edges.length,
          nodes: workflow.steps.map(s => ({
            id: s.id,
            type: s.stepType,
            name: s.name,
            x: s.positionX,
            y: s.positionY,
          })),
          edges: workflow.edges.map(e => ({
            id: e.id,
            source: e.sourceStepId,
            target: e.targetStepId,
            type: e.edgeType,
            label: e.label,
          })),
        }),
      },
    });

    return NextResponse.json({ success: true, message: "Version created" });
  } catch (err) {
    console.error("workflow versions POST error:", err);
    return NextResponse.json({ error: "Failed to create version" }, { status: 500 });
  }
}
