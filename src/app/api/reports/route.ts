import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateThermographyReport } from '@/lib/thermography-pdf'

/**
 * POST /api/reports
 * Generate a PDF report for a session.
 *
 * Body: { session_id }
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const { session_id } = await req.json()
  if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  // Fetch all data
  const [sessionRes, imagesRes, findingsRes, annotationsRes] = await Promise.all([
    supabaseAdmin.from('thermography_sessions').select('*').eq('id', session_id).single(),
    supabaseAdmin.from('thermography_images').select('*').eq('session_id', session_id).order('capture_order'),
    supabaseAdmin.from('thermography_findings').select('*').eq('session_id', session_id),
    supabaseAdmin.from('thermography_annotations').select('*'),
  ])

  if (sessionRes.error || !sessionRes.data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Filter annotations to images in this session
  const imageIds = (imagesRes.data || []).map((i: any) => i.id)
  const sessionAnnotations = (annotationsRes.data || []).filter((a: any) => imageIds.includes(a.image_id))

  try {
    // Generate PDF
    const pdfBuffer = generateThermographyReport({
      session: sessionRes.data,
      images: imagesRes.data || [],
      findings: findingsRes.data || [],
      annotations: sessionAnnotations,
    })

    // Upload to Supabase Storage
    const filename = `reports/${session_id}/thermal_report_${Date.now()}.pdf`
    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from('thermography')
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    let pdfUrl = null
    if (uploadData) {
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('thermography')
        .getPublicUrl(uploadData.path)
      pdfUrl = publicUrl
    }

    // Save report record
    const { data: reportRecord } = await supabaseAdmin
      .from('thermography_reports')
      .insert({
        session_id,
        report_url: pdfUrl,
        report_version: 1,
      })
      .select()
      .single()

    // Update session status
    await supabaseAdmin
      .from('thermography_sessions')
      .update({
        status: 'reported',
        report_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id)

    return NextResponse.json({
      report: reportRecord,
      pdf_url: pdfUrl,
      // Also return raw PDF as base64 for immediate display
      pdf_base64: pdfBuffer.toString('base64'),
    })

  } catch (e: any) {
    return NextResponse.json({ error: `Report generation failed: ${e.message}` }, { status: 500 })
  }
}
