import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { analyzeSession } from '@/lib/analysis-engine'

/**
 * POST /api/analysis
 * Run analysis engine on a session's captured images.
 *
 * Body: { session_id }
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const { session_id } = await req.json()
  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  // Fetch all images for this session
  const { data: images, error: imgErr } = await supabaseAdmin
    .from('thermography_images')
    .select('*')
    .eq('session_id', session_id)
    .order('capture_order')

  if (imgErr || !images?.length) {
    return NextResponse.json({ error: 'No images found for this session' }, { status: 400 })
  }

  try {
    // Run analysis engine
    const findings = await analyzeSession(images)

    // Clear previous findings for this session
    await supabaseAdmin
      .from('thermography_findings')
      .delete()
      .eq('session_id', session_id)

    // Insert new findings
    if (findings.length > 0) {
      const rows = findings.map(f => ({
        session_id: f.session_id,
        finding_type: f.finding_type,
        body_region: f.body_region,
        severity: f.severity,
        temperature_delta_celsius: f.temperature_delta_celsius,
        peak_temperature_celsius: f.peak_temperature_celsius,
        reference_temperature_celsius: f.reference_temperature_celsius,
        title: f.title,
        description: f.description,
        clinical_significance: f.clinical_significance,
        recommended_treatments: JSON.stringify(f.recommended_treatments),
        image_id: f.image_id,
        region_coords: f.region_coords ? JSON.stringify(f.region_coords) : null,
      }))

      const { error: insertErr } = await supabaseAdmin
        .from('thermography_findings')
        .insert(rows)

      if (insertErr) {
        return NextResponse.json({ error: `Failed to save findings: ${insertErr.message}` }, { status: 500 })
      }
    }

    // Update session status
    await supabaseAdmin
      .from('thermography_sessions')
      .update({
        status: 'analyzed',
        analysis_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id)

    return NextResponse.json({
      findings_count: findings.length,
      findings,
    })

  } catch (e: any) {
    return NextResponse.json({ error: `Analysis failed: ${e.message}` }, { status: 500 })
  }
}
