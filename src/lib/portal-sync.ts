// Portal Sync — Push thermography data to CLARITY portal
// Calls the encounter ticket app's API to make thermography visible in patient portal

import { supabaseAdmin } from './supabase-admin'

const PORTAL_BASE_URL = process.env.PORTAL_BASE_URL || 'https://app.urwellness.co'
const SYNC_KEY = process.env.THERMOGRAPHY_SYNC_KEY || ''

interface PortalSyncPayload {
  patient_prospyr_id: string
  session_date: string
  findings_summary: {
    total_findings: number
    significant: number
    moderate: number
    mild: number
  }
  finding_highlights: Array<{
    title: string
    severity: string
    description: string
    treatments: string[]
  }>
  report_url: string | null
  image_thumbnails: Array<{
    view_type: string
    thumbnail_url: string | null
    temp_range: string
  }>
}

/**
 * Sync a completed thermography session to the CLARITY portal.
 * This pushes a summary to the encounter ticket app's API,
 * which stores it on the patient's pipeline for portal display.
 */
export async function syncToPortal(sessionId: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAdmin) return { success: false, error: 'Supabase not configured' }
  if (!SYNC_KEY) return { success: false, error: 'THERMOGRAPHY_SYNC_KEY not set' }

  // Fetch session data
  const [sessionRes, imagesRes, findingsRes, reportsRes] = await Promise.all([
    supabaseAdmin.from('thermography_sessions').select('*').eq('id', sessionId).single(),
    supabaseAdmin.from('thermography_images').select('*').eq('session_id', sessionId).order('capture_order'),
    supabaseAdmin.from('thermography_findings').select('*').eq('session_id', sessionId),
    supabaseAdmin.from('thermography_reports').select('*').eq('session_id', sessionId).order('generated_at', { ascending: false }).limit(1),
  ])

  if (!sessionRes.data) return { success: false, error: 'Session not found' }

  const session = sessionRes.data
  const images = imagesRes.data || []
  const findings = findingsRes.data || []
  const report = reportsRes.data?.[0]

  // Build payload
  const payload: PortalSyncPayload = {
    patient_prospyr_id: session.prospyr_contact_id,
    session_date: session.session_date,
    findings_summary: {
      total_findings: findings.length,
      significant: findings.filter((f: any) => f.severity === 'significant').length,
      moderate: findings.filter((f: any) => f.severity === 'moderate').length,
      mild: findings.filter((f: any) => f.severity === 'mild').length,
    },
    finding_highlights: findings.slice(0, 5).map((f: any) => ({
      title: f.title,
      severity: f.severity,
      description: f.description,
      treatments: (f.recommended_treatments || []).map((t: any) => typeof t === 'string' ? t : t.name),
    })),
    report_url: report?.report_url || null,
    image_thumbnails: images.map((img: any) => ({
      view_type: img.view_type,
      thumbnail_url: img.thumbnail_url,
      temp_range: img.min_temp_celsius && img.max_temp_celsius
        ? `${img.min_temp_celsius.toFixed(1)}°C — ${img.max_temp_celsius.toFixed(1)}°C`
        : '',
    })),
  }

  // Push to portal API
  try {
    const res = await fetch(`${PORTAL_BASE_URL}/api/pipeline/portal/thermography`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Thermography-Key': SYNC_KEY,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { success: false, error: `Portal API returned ${res.status}: ${errText}` }
    }

    // Update session sync status
    await supabaseAdmin
      .from('thermography_sessions')
      .update({
        status: 'synced',
        portal_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)

    // Update report sync flag
    if (report) {
      await supabaseAdmin
        .from('thermography_reports')
        .update({
          portal_synced: true,
          portal_synced_at: new Date().toISOString(),
        })
        .eq('id', report.id)
    }

    return { success: true }

  } catch (e: any) {
    return { success: false, error: `Portal sync failed: ${e.message}` }
  }
}
