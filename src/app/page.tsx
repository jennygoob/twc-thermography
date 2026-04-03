'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================
// Types (inline to keep single-file for MVP)
// ============================================================

type ViewType = 'front' | 'back' | 'lateral_left' | 'lateral_right' | 'feet_dorsal' | 'feet_plantar'
type SessionStatus = 'in_progress' | 'captured' | 'analyzed' | 'reported' | 'synced'
type FindingSeverity = 'mild' | 'moderate' | 'significant'
type AnnotationTool = 'circle' | 'arrow' | 'text' | 'rectangle' | null

interface Session {
  id: string
  patient_id: string
  prospyr_contact_id: string
  patient_name: string
  session_date: string
  status: SessionStatus
  notes: string | null
  performed_by: string | null
}

interface CapturedImage {
  id: string
  session_id: string
  view_type: ViewType
  display_image_url: string | null
  thumbnail_url: string | null
  min_temp_celsius: number | null
  max_temp_celsius: number | null
  avg_temp_celsius: number | null
}

interface Finding {
  id: string
  finding_type: string
  body_region: string
  severity: FindingSeverity
  temperature_delta_celsius: number | null
  peak_temperature_celsius: number | null
  title: string
  description: string
  recommended_treatments: any[]
}

interface Annotation {
  id: string
  image_id: string
  annotation_type: string
  coordinates: any
  label: string | null
  color: string
}

interface CameraStatus {
  connected: boolean
  simulation_mode: boolean
  camera_model: string | null
  current_palette: string
  emissivity: number
  temperature_range: { min: number; max: number }
  error: string | null
}

const VIEW_LABELS: Record<ViewType, string> = {
  front: 'Front',
  back: 'Back',
  lateral_left: 'Left Lateral',
  lateral_right: 'Right Lateral',
  feet_dorsal: 'Feet (Top)',
  feet_plantar: 'Feet (Bottom)',
}

const VIEW_ORDER: ViewType[] = ['front', 'back', 'lateral_left', 'lateral_right', 'feet_dorsal', 'feet_plantar']

const STATUS_LABELS: Record<SessionStatus, string> = {
  in_progress: 'In Progress',
  captured: 'Captured',
  analyzed: 'Analyzed',
  reported: 'Reported',
  synced: 'Synced',
}

const CAMERA_STREAM_URL = 'http://localhost:5050/stream'

// ============================================================
// PIN Auth Gate
// ============================================================

function PinAuth({ onAuth }: { onAuth: (name: string) => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const staffPins: Record<string, string> = (() => {
    try {
      const raw = process.env.NEXT_PUBLIC_STAFF_PINS || '{"1234":"Dawn","5678":"Leizyl","9999":"Admin"}'
      return JSON.parse(raw)
    } catch {
      return { '1234': 'Dawn', '5678': 'Leizyl', '9999': 'Admin' }
    }
  })()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = staffPins[pin]
    if (name) {
      onAuth(name)
    } else {
      setError('Invalid PIN')
      setPin('')
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh',
      background: 'radial-gradient(ellipse at 50% 40%, #0D1117 0%, #08080C 70%)',
    }}>
      <div style={{
        background: 'rgba(13,17,23,0.9)', backdropFilter: 'blur(24px)',
        border: '1px solid var(--border-ice)', borderRadius: 12,
        padding: '48px 40px', textAlign: 'center', width: 380,
        boxShadow: '0 0 80px rgba(232,69,60,0.04), 0 0 1px rgba(0,212,170,0.1)',
      }}>
        <div style={{
          fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600,
          color: 'var(--accent-amber)', marginBottom: 2,
          letterSpacing: 3, textTransform: 'uppercase',
        }}>
          THE WELLNESS CO.
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-secondary)', marginBottom: 36,
          letterSpacing: 2.5, textTransform: 'uppercase',
        }}>
          Thermography Workstation
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
            placeholder="- - - -"
            autoFocus
            style={{
              width: '100%', textAlign: 'center', fontSize: 28, letterSpacing: 14,
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--bg-input)', border: '1px solid var(--border-ice)',
              borderRadius: 6, padding: '16px 0', color: 'var(--text-primary)', outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--border-active)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-ice)'}
          />
          {error && <div style={{ color: 'var(--accent-ember)', fontSize: 12, marginTop: 8, fontWeight: 500 }}>{error}</div>}
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 20, padding: '14px 0', fontSize: 13 }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// Main Workstation
// ============================================================

export default function ThermographyWorkstation() {
  // Auth
  const [staffName, setStaffName] = useState<string | null>(null)

  // Camera
  const [cameraStatus, setCameraStatus] = useState<CameraStatus | null>(null)

  // Patient / Session
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [sessionNotes, setSessionNotes] = useState('')

  // UI state
  const [activeView, setActiveView] = useState<ViewType | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [showNewSession, setShowNewSession] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')

  // Annotation state
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>(null)
  const [annotationColor, setAnnotationColor] = useState('#E8453C')

  // ── Effects ──

  useEffect(() => {
    if (!staffName) return
    fetchCameraStatus()
    fetchSessions()
    const interval = setInterval(fetchCameraStatus, 10000)
    return () => clearInterval(interval)
  }, [staffName])

  useEffect(() => {
    if (activeSession) loadSessionData(activeSession.id)
  }, [activeSession?.id])

  // ── Data fetching ──

  async function fetchCameraStatus() {
    try {
      const res = await fetch('/api/camera/status')
      if (res.ok) setCameraStatus(await res.json())
    } catch {}
  }

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions?limit=50')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {}
  }

  async function loadSessionData(sessionId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setCapturedImages(data.images || [])
        setFindings(data.findings || [])
        setAnnotations(data.annotations || [])
        setSessionNotes(data.session?.notes || '')
      }
    } catch {}
  }

  // ── Actions ──

  async function createSession() {
    if (!newPatientName.trim()) return
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: crypto.randomUUID(),
          patient_name: newPatientName.trim(),
          performed_by: staffName,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setActiveSession(data.session)
        setShowNewSession(false)
        setNewPatientName('')
        fetchSessions()
      }
    } catch {}
  }

  async function captureView(viewType: ViewType) {
    if (!activeSession || capturing) return
    setCapturing(true)
    setActiveView(viewType)
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSession.id, view_type: viewType }),
      })
      if (res.ok) {
        await loadSessionData(activeSession.id)
        fetchSessions()
      }
    } catch (e) {
      console.error('Capture error:', e)
    } finally {
      setCapturing(false)
    }
  }

  async function runAnalysis() {
    if (!activeSession || analyzing) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSession.id }),
      })
      if (res.ok) {
        await loadSessionData(activeSession.id)
        fetchSessions()
      }
    } catch (e) {
      console.error('Analysis error:', e)
    } finally {
      setAnalyzing(false)
    }
  }

  async function generateReport() {
    if (!activeSession || generatingReport) return
    setGeneratingReport(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSession.id }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.pdf_url) window.open(data.pdf_url, '_blank')
        await loadSessionData(activeSession.id)
        fetchSessions()
      }
    } catch (e) {
      console.error('Report error:', e)
    } finally {
      setGeneratingReport(false)
    }
  }

  async function saveNotes() {
    if (!activeSession) return
    await fetch(`/api/sessions/${activeSession.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: sessionNotes }),
    })
  }

  // ── Helpers ──

  const capturedCount = capturedImages.length
  const getImageForView = (vt: ViewType) => capturedImages.find(img => img.view_type === vt)

  if (!staffName) return <PinAuth onAuth={setStaffName} />

  // ════════════════════════════════════════
  // MAIN 3-PANEL LAYOUT
  // ════════════════════════════════════════

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '280px 1fr 360px',
      gap: 10,
      height: '100vh',
      padding: 10,
      overflow: 'hidden',
    }}>

      {/* ══════════ LEFT PANEL: Sessions ══════════ */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Sessions</span>
          <button
            className="btn-ghost"
            onClick={() => setShowNewSession(true)}
            style={{ fontSize: 16, padding: '2px 8px', color: 'var(--accent-teal)' }}
          >+</button>
        </div>

        {/* New Session Form */}
        {showNewSession && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-ice)' }}>
            <input
              className="input-field"
              placeholder="Patient name..."
              value={newPatientName}
              onChange={e => setNewPatientName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createSession()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn-primary" style={{ flex: 1, padding: '8px 0', fontSize: 12 }} onClick={createSession}>Create</button>
              <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowNewSession(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Camera Status */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border-ice)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: cameraStatus?.connected || cameraStatus?.simulation_mode
              ? 'var(--status-connected)' : 'var(--status-offline)',
            boxShadow: cameraStatus?.connected || cameraStatus?.simulation_mode
              ? '0 0 6px rgba(0,212,170,0.4)' : '0 0 6px rgba(232,69,60,0.3)',
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {cameraStatus?.connected
              ? cameraStatus.camera_model
              : cameraStatus?.simulation_mode
                ? 'Simulation Mode'
                : 'Camera Offline'}
          </span>
        </div>

        {/* Session List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {sessions.length === 0 && (
            <div style={{ padding: '24px 16px', color: 'var(--text-secondary)', fontSize: 12, textAlign: 'center' }}>
              No sessions yet. Click + to create one.
            </div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => setActiveSession(s)}
              style={{
                padding: '10px 16px', cursor: 'pointer',
                background: activeSession?.id === s.id ? 'var(--bg-panel-hover)' : 'transparent',
                borderLeft: activeSession?.id === s.id ? '2px solid var(--accent-ember)' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                {s.patient_name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {new Date(s.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className={`badge-status badge-${s.status}`}>
                  {STATUS_LABELS[s.status]}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Staff Info */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--border-ice)',
          fontSize: 11, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>Signed in as <span style={{ color: 'var(--text-primary)' }}>{staffName}</span></span>
          <button className="btn-ghost" onClick={() => setStaffName(null)} style={{ fontSize: 11, padding: '2px 6px' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* ══════════ CENTER PANEL: Capture Workstation ══════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>

        {/* Live Feed */}
        <div className="panel" style={{ flex: '0 0 auto' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Live Thermal Feed</span>
            {cameraStatus?.current_palette && (
              <span className="temp-readout" style={{ fontSize: 10 }}>
                {cameraStatus.current_palette.toUpperCase()} | E: {cameraStatus.emissivity}
              </span>
            )}
          </div>
          <div style={{ padding: 10 }}>
            <div className="thermal-feed" style={{ maxHeight: 320 }}>
              {(cameraStatus?.connected || cameraStatus?.simulation_mode) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={CAMERA_STREAM_URL}
                  alt="Live thermal feed"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: 240, gap: 8,
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border-ice)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-offline)', opacity: 0.5 }} />
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    Camera not connected
                  </span>
                  <span style={{ color: '#3a4550', fontSize: 11 }}>
                    Start camera service to see live feed
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Capture Grid */}
        <div className="panel" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              Capture Grid{' '}
              <span style={{ color: capturedCount === 6 ? 'var(--accent-teal)' : 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
                {capturedCount}/6
              </span>
            </span>
            {activeSession && capturedCount > 0 && !analyzing && (
              <button className="btn-primary" onClick={runAnalysis} style={{ padding: '5px 14px', fontSize: 11 }}>
                Run Analysis
              </button>
            )}
          </div>
          <div style={{
            flex: 1, padding: 10,
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            alignContent: 'start',
          }}>
            {!activeSession ? (
              <div style={{
                gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100%', color: 'var(--text-secondary)', fontSize: 12,
              }}>
                Select or create a session to begin capturing
              </div>
            ) : (
              VIEW_ORDER.map(vt => {
                const img = getImageForView(vt)
                const isCapturing = capturing && activeView === vt
                return (
                  <div
                    key={vt}
                    className={`capture-slot ${img ? 'captured' : ''} ${isCapturing ? 'active pulse' : ''}`}
                    onClick={() => !capturing && captureView(vt)}
                  >
                    {img?.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.thumbnail_url}
                        alt={VIEW_LABELS[vt]}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : isCapturing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div className="pulse" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-ember)' }} />
                        <span style={{ color: 'var(--accent-ember)', fontSize: 11 }}>Capturing...</span>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6, margin: '0 auto 6px',
                          border: '1px dashed rgba(26,42,58,0.8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#2a4a5a', fontSize: 14,
                        }}>
                          +
                        </div>
                        <div style={{ fontSize: 10, color: '#3a4550' }}>Capture</div>
                      </div>
                    )}

                    {/* View label */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(transparent, rgba(8,8,12,0.85))',
                      padding: '14px 8px 5px', fontSize: 10,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ color: 'var(--accent-amber)', fontWeight: 500, letterSpacing: 0.5 }}>{VIEW_LABELS[vt]}</span>
                      {img && (
                        <span className="temp-readout" style={{ fontSize: 9 }}>
                          {img.min_temp_celsius?.toFixed(1)}° — {img.max_temp_celsius?.toFixed(1)}°C
                        </span>
                      )}
                    </div>

                    {/* Captured checkmark */}
                    {img && (
                      <div style={{
                        position: 'absolute', top: 5, right: 5,
                        width: 18, height: 18, borderRadius: 4,
                        background: 'rgba(0,212,170,0.9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: '#000', fontWeight: 700,
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT PANEL: Analysis & Notes ══════════ */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-header">Analysis & Notes</div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>

          {/* Analysis Status */}
          {analyzing && (
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border-ice)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div className="pulse" style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-ember)',
              }} />
              <span style={{ fontSize: 12, color: 'var(--accent-ember)', fontWeight: 500, letterSpacing: 0.3 }}>
                Running analysis...
              </span>
            </div>
          )}

          {/* Findings */}
          {findings.length > 0 && (
            <div style={{ borderBottom: '1px solid var(--border-ice)' }}>
              <div style={{
                padding: '12px 20px', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: 1.2,
              }}>
                Findings ({findings.length})
              </div>
              {findings.map(f => (
                <div key={f.id} style={{
                  padding: '10px 20px', borderTop: '1px solid rgba(26,42,58,0.4)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1, lineHeight: 1.3 }}>
                      {f.title}
                    </span>
                    <span className={`badge badge-${f.severity}`} style={{ marginLeft: 8, flexShrink: 0 }}>
                      {f.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 6 }}>
                    {f.description.length > 150 ? f.description.slice(0, 150) + '...' : f.description}
                  </div>
                  {f.temperature_delta_celsius !== null && (
                    <div className="temp-readout" style={{ fontSize: 11, marginBottom: 4 }}>
                      Delta: {Math.abs(f.temperature_delta_celsius).toFixed(1)}°C
                      {f.peak_temperature_celsius && ` | Peak: ${f.peak_temperature_celsius.toFixed(1)}°C`}
                    </div>
                  )}
                  {f.recommended_treatments?.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {f.recommended_treatments.map((t: any, i: number) => (
                        <div key={i} style={{
                          fontSize: 11, color: 'var(--accent-teal)', padding: '2px 0',
                          display: 'flex', gap: 6, opacity: 0.8,
                        }}>
                          <span>→</span>
                          <span>{t.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* No findings placeholder */}
          {!analyzing && findings.length === 0 && activeSession && capturedCount > 0 && (
            <div style={{
              padding: '24px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12,
            }}>
              {activeSession.status === 'in_progress'
                ? 'Capture all views, then run analysis'
                : 'No findings detected'}
            </div>
          )}

          {/* Annotation Tools */}
          {activeSession && capturedCount > 0 && (
            <div style={{ borderBottom: '1px solid var(--border-ice)' }}>
              <div style={{
                padding: '12px 20px', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: 1.2,
              }}>
                Annotation Tools
              </div>
              <div style={{ padding: '0 20px 12px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(['circle', 'arrow', 'rectangle', 'text'] as AnnotationTool[]).map(tool => (
                  <button
                    key={tool}
                    className={annotationTool === tool ? 'btn-primary' : 'btn-outline'}
                    style={{ padding: '5px 10px', fontSize: 11 }}
                    onClick={() => setAnnotationTool(annotationTool === tool ? null : tool)}
                  >
                    {tool === 'circle' ? '○' : tool === 'arrow' ? '→' : tool === 'rectangle' ? '□' : 'T'}&nbsp;
                    {tool!.charAt(0).toUpperCase() + tool!.slice(1)}
                  </button>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                  {['#E8453C', '#00D4AA', '#FF6B35', '#FFFFFF'].map(c => (
                    <div
                      key={c}
                      onClick={() => setAnnotationColor(c)}
                      style={{
                        width: 16, height: 16, borderRadius: 3, background: c, cursor: 'pointer',
                        border: annotationColor === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                        transition: 'border-color 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Session Notes */}
          {activeSession && (
            <div>
              <div style={{
                padding: '12px 20px', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: 1.2,
              }}>
                Session Notes
              </div>
              <div style={{ padding: '0 20px 12px' }}>
                <textarea
                  className="input-field"
                  value={sessionNotes}
                  onChange={e => setSessionNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Clinical observations, patient complaints, visible conditions..."
                  rows={4}
                  style={{ resize: 'vertical', minHeight: 80 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {activeSession && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--border-ice)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {capturedCount > 0 && findings.length === 0 && (
              <button
                className="btn-primary"
                onClick={runAnalysis}
                disabled={analyzing}
                style={{ width: '100%' }}
              >
                {analyzing ? 'Analyzing...' : 'Run Analysis'}
              </button>
            )}
            {findings.length > 0 && (
              <button
                className="btn-primary"
                onClick={generateReport}
                disabled={generatingReport}
                style={{ width: '100%' }}
              >
                {generatingReport ? 'Generating...' : 'Generate Report'}
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {!activeSession && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, color: '#3a4550', fontSize: 12, textAlign: 'center',
          }}>
            Select a session from the left panel to view analysis and notes
          </div>
        )}
      </div>
    </div>
  )
}
