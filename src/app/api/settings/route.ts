import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/permissions";

/**
 * GET /api/settings
 * Returns all system settings.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const settingsRecords = await db.systemSetting.findMany();
    const settings: Record<string, Record<string, any>> = {};

    for (const record of settingsRecords) {
      if (!settings[record.category]) settings[record.category] = {};
      try {
        settings[record.category][record.key] = JSON.parse(record.value);
      } catch {
        settings[record.category][record.key] = record.value;
      }
    }

    // System info
    settings.system = {
      ...settings.system,
      nodeVersion: process.version,
      nextVersion: "15.5.20",
      prismaVersion: "6.19.3",
    };

    return NextResponse.json({ settings });
  } catch (err) {
    console.error("settings GET error:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

/**
 * PUT /api/settings
 * Updates system settings (admin only).
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = user.userId as string;

    // Check if user is admin/owner of any org
    const membership = await db.organizationMember.findFirst({
      where: { userId, role: { in: ["owner", "admin"] } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Only admins can modify system settings" }, { status: 403 });
    }

    const { settings } = await req.json();
    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }

    const upserts: Promise<any>[] = [];

    for (const [category, categorySettings] of Object.entries(settings)) {
      if (typeof categorySettings !== "object" || categorySettings === null) continue;
      if (category === "system") continue; // Skip system info (read-only)

      for (const [key, value] of Object.entries(categorySettings as Record<string, any>)) {
        upserts.push(
          db.systemSetting.upsert({
            where: { key: `${category}.${key}` },
            create: {
              key: `${category}.${key}`,
              value: JSON.stringify(value),
              category,
              label: key,
              type: typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string",
            },
            update: {
              value: JSON.stringify(value),
            },
          })
        );
      }
    }

    await Promise.all(upserts);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("settings PUT error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
