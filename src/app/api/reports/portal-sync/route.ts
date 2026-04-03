import { NextRequest, NextResponse } from 'next/server'
import { syncToPortal } from '@/lib/portal-sync'

/**
 * POST /api/reports/portal-sync
 * Push thermography data to CLARITY patient portal.
 *
 * Body: { session_id }
 */
export async function POST(req: NextRequest) {
  const { session_id } = await req.json()
  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  const result = await syncToPortal(session_id)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
