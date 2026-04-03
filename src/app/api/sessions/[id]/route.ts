import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: Full session data with images, findings, annotations
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const sessionId = params.id

  // Fetch session, images, findings, annotations in parallel
  const [sessionRes, imagesRes, findingsRes, annotationsRes, reportsRes] = await Promise.all([
    supabaseAdmin.from('thermography_sessions').select('*').eq('id', sessionId).single(),
    supabaseAdmin.from('thermography_images').select('*').eq('session_id', sessionId).order('capture_order'),
    supabaseAdmin.from('thermography_findings').select('*').eq('session_id', sessionId).order('created_at'),
    supabaseAdmin.from('thermography_annotations').select('*').eq('image_id', sessionId), // Will filter by image IDs below
    supabaseAdmin.from('thermography_reports').select('*').eq('session_id', sessionId).order('generated_at', { ascending: false }).limit(1),
  ])

  if (sessionRes.error) return NextResponse.json({ error: sessionRes.error.message }, { status: 404 })

  // Get annotations for all images in this session
  const imageIds = (imagesRes.data || []).map((img: any) => img.id)
  let annotations: any[] = []
  if (imageIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('thermography_annotations')
      .select('*')
      .in('image_id', imageIds)
    annotations = data || []
  }

  return NextResponse.json({
    session: sessionRes.data,
    images: imagesRes.data || [],
    findings: findingsRes.data || [],
    annotations,
    report: reportsRes.data?.[0] || null,
  })
}

// PUT: Update session (notes, status)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const body = await req.json()
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() }

  if (body.notes !== undefined) updateData.notes = body.notes
  if (body.status) updateData.status = body.status

  const { data, error } = await supabaseAdmin
    .from('thermography_sessions')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}
