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

  if (!patient_name) {
    return NextResponse.json({ error: 'patient_name required' }, { status: 400 })
  }

  // Try to find a matching patient by name, or use first available patient for testing
  let resolvedPatientId = patient_id
  if (!resolvedPatientId || resolvedPatientId.startsWith('test-')) {
    const nameParts = patient_name.trim().split(/\s+/)
    let patientMatch = null

    if (nameParts.length >= 2) {
      const { data } = await supabaseAdmin
        .from('patients')
        .select('id')
        .ilike('first_name', nameParts[0])
        .ilike('last_name', nameParts.slice(1).join(' '))
        .limit(1)
        .single()
      patientMatch = data
    }

    if (!patientMatch) {
      // Fallback: use first patient in DB for testing/demo sessions
      const { data } = await supabaseAdmin
        .from('patients')
        .select('id')
        .limit(1)
        .single()
      patientMatch = data
    }

    if (!patientMatch) {
      return NextResponse.json({ error: 'No patients found in database' }, { status: 400 })
    }
    resolvedPatientId = patientMatch.id
  }

  const { data, error } = await supabaseAdmin
    .from('thermography_sessions')
    .insert({
      patient_id: resolvedPatientId,
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
