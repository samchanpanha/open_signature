import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const workflow = await db.signatureWorkflow.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: "asc" } },
        edges: true,
        documents: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const docs = workflow.documents;
    const totalDocs = docs.length;
    const completedDocs = docs.filter(d => d.status === "Completed").length;
    const pendingDocs = docs.filter(d => d.status === "Sent" || d.status === "Signing").length;
    const rejectedDocs = docs.filter(d => d.status === "Rejected").length;
    const draftDocs = docs.filter(d => d.status === "Draft").length;

    // Calculate average completion time
    let totalCompletionTime = 0;
    let completedWithTime = 0;
    for (const doc of docs) {
      if (doc.status === "Completed") {
        const time = doc.updatedAt.getTime() - doc.createdAt.getTime();
        totalCompletionTime += time;
        completedWithTime++;
      }
    }
    const avgCompletionTimeHours = completedWithTime > 0
      ? Math.round((totalCompletionTime / completedWithTime) / (1000 * 60 * 60) * 10) / 10
      : 0;

    // Completion rate
    const completionRate = totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 100) : 0;

    // Documents by status over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDocs = docs.filter(d => d.createdAt >= thirtyDaysAgo);
    const statusDistribution = {
      completed: completedDocs,
      pending: pendingDocs,
      rejected: rejectedDocs,
      draft: draftDocs,
    };

    // Step performance
    const stepPerformance = workflow.steps.map(step => {
      const stepDocs = docs.filter(d => d.status === "Completed" || d.status === "Rejected");
      return {
        stepId: step.id,
        name: step.name,
        type: step.stepType,
        order: step.order,
        assignedTo: step.userId,
        slaHours: step.nodeConfig ? JSON.parse(step.nodeConfig).slaHours || 0 : 0,
      };
    });

    // Recent activity
    const recentActivity = docs
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10)
      .map(doc => ({
        id: doc.id,
        title: doc.title,
        status: doc.status,
        updatedAt: doc.updatedAt,
      }));

    return NextResponse.json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        isActive: workflow.isActive,
        createdAt: workflow.createdAt,
        nodeCount: workflow.steps.length,
        edgeCount: workflow.edges.length,
        conditionCount: workflow.steps.filter(s => s.stepType === "condition").length,
      },
      analytics: {
        totalDocuments: totalDocs,
        completedDocuments: completedDocs,
        pendingDocuments: pendingDocs,
        rejectedDocuments: rejectedDocs,
        draftDocuments: draftDocs,
        completionRate,
        avgCompletionTimeHours,
        statusDistribution,
        recentActivity,
        stepPerformance,
      },
    });
  } catch (err) {
    console.error("workflow analytics GET error:", err);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
