import { NextResponse } from 'next/server'

const CAMERA_SERVICE_URL = process.env.CAMERA_SERVICE_URL || 'http://localhost:5050'

export async function GET() {
  try {
    const res = await fetch(`${CAMERA_SERVICE_URL}/status`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Camera service returned ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({
      connected: false,
      simulation_mode: false,
      camera_model: null,
      error: e.message || 'Camera service not running',
    })
  }
}
