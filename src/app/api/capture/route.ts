import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { readFileSync } from 'fs'

const CAMERA_SERVICE_URL = process.env.CAMERA_SERVICE_URL || 'http://localhost:5050'

/**
 * POST /api/capture
 * Triggers camera capture, uploads images to Supabase Storage, saves record.
 *
 * Body: { session_id, view_type }
 */
export async function POST(req: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const { session_id, view_type } = await req.json()

  if (!session_id || !view_type) {
    return NextResponse.json({ error: 'session_id and view_type required' }, { status: 400 })
  }

  try {
    // 1. Trigger capture on camera service
    const captureRes = await fetch(`${CAMERA_SERVICE_URL}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ view_type }),
    })

    if (!captureRes.ok) {
      const err = await captureRes.text()
      return NextResponse.json({ error: `Camera capture failed: ${err}` }, { status: 500 })
    }

    const captureData = await captureRes.json()

    // 2. Read captured files and upload to Supabase Storage
    const timestamp = Date.now()
    const basePath = `sessions/${session_id}`

    // Upload display image
    let displayUrl = null
    try {
      const displayBytes = readFileSync(captureData.display_path)
      const { data: displayUpload, error: displayErr } = await supabaseAdmin.storage
        .from('thermography')
        .upload(`${basePath}/${view_type}_display_${timestamp}.jpg`, displayBytes, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (displayUpload) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('thermography')
          .getPublicUrl(displayUpload.path)
        displayUrl = publicUrl
      }
    } catch (e) {
      console.error('Display upload failed:', e)
    }

    // Upload thumbnail
    let thumbnailUrl = null
    try {
      const thumbBytes = readFileSync(captureData.thumbnail_path)
      const { data: thumbUpload } = await supabaseAdmin.storage
        .from('thermography')
        .upload(`${basePath}/${view_type}_thumb_${timestamp}.jpg`, thumbBytes, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (thumbUpload) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('thermography')
          .getPublicUrl(thumbUpload.path)
        thumbnailUrl = publicUrl
      }
    } catch (e) {
      console.error('Thumbnail upload failed:', e)
    }

    // 3. Get current image count for capture_order
    const { count } = await supabaseAdmin
      .from('thermography_images')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id)

    // 4. Insert image record
    const { data: imageRecord, error: insertErr } = await supabaseAdmin
      .from('thermography_images')
      .upsert({
        session_id,
        view_type,
        capture_order: (count || 0),
        radiometric_data_url: captureData.radiometric_path, // Local path for analysis
        display_image_url: displayUrl,
        thumbnail_url: thumbnailUrl,
        min_temp_celsius: captureData.min_temp,
        max_temp_celsius: captureData.max_temp,
        avg_temp_celsius: captureData.avg_temp,
        ambient_temp_celsius: captureData.ambient_temp,
        emissivity: captureData.emissivity || 0.98,
      }, {
        onConflict: 'session_id,view_type',
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // 5. Check if all views captured, update session status
    const { count: totalImages } = await supabaseAdmin
      .from('thermography_images')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id)

    if ((totalImages || 0) >= 6) {
      await supabaseAdmin
        .from('thermography_sessions')
        .update({ status: 'captured', updated_at: new Date().toISOString() })
        .eq('id', session_id)
    }

    return NextResponse.json({
      image: imageRecord,
      capture: captureData,
    })

  } catch (e: any) {
    return NextResponse.json({
      error: `Capture failed: ${e.message}. Is the camera service running on ${CAMERA_SERVICE_URL}?`
    }, { status: 500 })
  }
}
