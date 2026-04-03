import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET: List sessions (optionally filtered by patient_id)
export async function GET(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get('patient_id')
  const limit = parseInt(searchParams.get('limit') || '20')

  let query = supabaseAdmin
    .from('thermography_sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .limit(limit)

  if (patientId) {
    query = query.eq('patient_id', patientId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data || [] })
}

// POST: Create a new session
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const body = await req.json()
  const { patient_id, prospyr_contact_id, patient_name, performed_by } = body

  if (!patient_id || !patient_name) {
    return NextResponse.json({ error: 'patient_id and patient_name required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('thermography_sessions')
    .insert({
      patient_id,
      prospyr_contact_id: prospyr_contact_id || '',
      patient_name,
      performed_by: performed_by || null,
      status: 'in_progress',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}
