import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

/**
 * GET /api/telegram/preferences
 * Returns the user's Telegram notification preferences.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.userId as string;

    let prefs = await db.userPreferences.findUnique({ where: { userId } });
    if (!prefs) {
      prefs = await db.userPreferences.create({ data: { userId } });
    }

    return NextResponse.json({
      preferences: {
        telegramOnSent: prefs.telegramOnSent,
        telegramOnCompleted: prefs.telegramOnCompleted,
        telegramOnRejected: prefs.telegramOnRejected,
        telegramOnExpiring: prefs.telegramOnExpiring,
        telegramOnReminder: prefs.telegramOnReminder,
        telegramOnApproval: prefs.telegramOnApproval,
        telegramDailySummary: prefs.telegramDailySummary,
        telegramWeeklySummary: prefs.telegramWeeklySummary,
        telegramSecurityAlerts: prefs.telegramSecurityAlerts,
      },
    });
  } catch (err) {
    console.error("telegram preferences GET error:", err);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

/**
 * PUT /api/telegram/preferences
 * Updates the user's Telegram notification preferences.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.userId as string;
    const body = await req.json();

    const allowedKeys = [
      "telegramOnSent", "telegramOnCompleted", "telegramOnRejected",
      "telegramOnExpiring", "telegramOnReminder", "telegramOnApproval",
      "telegramDailySummary", "telegramWeeklySummary", "telegramSecurityAlerts",
    ];

    const updateData: Record<string, boolean> = {};
    for (const key of allowedKeys) {
      if (key in body && typeof body[key] === "boolean") {
        updateData[key] = body[key];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid preferences to update" }, { status: 400 });
    }

    await db.userPreferences.upsert({
      where: { userId },
      create: { userId, ...updateData },
      update: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("telegram preferences PUT error:", err);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
