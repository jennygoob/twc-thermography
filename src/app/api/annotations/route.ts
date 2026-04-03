import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST: Create annotation
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const body = await req.json()
  const { image_id, annotation_type, coordinates, label, color, stroke_width, created_by } = body

  if (!image_id || !annotation_type || !coordinates) {
    return NextResponse.json({ error: 'image_id, annotation_type, and coordinates required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('thermography_annotations')
    .insert({
      image_id,
      annotation_type,
      coordinates,
      label: label || null,
      color: color || '#FF0000',
      stroke_width: stroke_width || 2,
      created_by: created_by || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ annotation: data })
}

// DELETE: Remove annotation
export async function DELETE(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('thermography_annotations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
