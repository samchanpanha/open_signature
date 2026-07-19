import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/permissions'

const ONBOARDING_STEPS = [
  'upload_doc',
  'add_fields',
  'send_for_sign',
  'view_audit',
  'create_template',
  'setup_org',
  'invite_member',
]

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const logs = await db.auditLog.findMany({
      where: {
        userId: user.id,
        action: { startsWith: 'ONBOARDING_STEP_' },
      },
      select: { action: true },
    })

    const completedSteps = logs.map((log) => log.action.replace('ONBOARDING_STEP_', ''))

    return NextResponse.json({
      steps: completedSteps,
      totalSteps: ONBOARDING_STEPS.length,
      isComplete: completedSteps.length >= ONBOARDING_STEPS.length,
    })
  } catch (error) {
    console.error('Error fetching onboarding status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { step } = body

    if (!step || !ONBOARDING_STEPS.includes(step)) {
      return NextResponse.json(
        { error: `Invalid step. Must be one of: ${ONBOARDING_STEPS.join(', ')}` },
        { status: 400 }
      )
    }

    const existing = await db.auditLog.findFirst({
      where: {
        userId: user.id,
        action: `ONBOARDING_STEP_${step}`,
      },
    })

    if (!existing) {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: `ONBOARDING_STEP_${step}`,
          details: JSON.stringify({ step, completedAt: new Date().toISOString() }),
        },
      })
    }

    const logs = await db.auditLog.findMany({
      where: {
        userId: user.id,
        action: { startsWith: 'ONBOARDING_STEP_' },
      },
      select: { action: true },
    })

    const completedSteps = logs.map((log) => log.action.replace('ONBOARDING_STEP_', ''))

    return NextResponse.json({ success: true, completedSteps })
  } catch (error) {
    console.error('Error updating onboarding status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
