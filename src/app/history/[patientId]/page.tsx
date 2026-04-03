'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface SessionSummary {
  id: string
  patient_name: string
  session_date: string
  status: string
  findings_count: number
  images: Array<{
    view_type: string
    thumbnail_url: string | null
    min_temp_celsius: number | null
    max_temp_celsius: number | null
  }>
  findings: Array<{
    title: string
    severity: string
    body_region: string
    temperature_delta_celsius: number | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress',
  captured: 'Captured',
  analyzed: 'Analyzed',
  reported: 'Reported',
  synced: 'Synced',
}

export default function PatientHistoryPage() {
  const params = useParams()
  const patientId = params.patientId as string
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareSessionIds, setCompareSessionIds] = useState<string[]>([])

  useEffect(() => {
    loadHistory()
  }, [patientId])

  async function loadHistory() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions?patient_id=${patientId}&limit=100`)
      if (res.ok) {
        const data = await res.json()
        // Load full data for each session
        const fullSessions: SessionSummary[] = []
        for (const s of data.sessions) {
          const detailRes = await fetch(`/api/sessions/${s.id}`)
          if (detailRes.ok) {
            const detail = await detailRes.json()
            fullSessions.push({
              ...s,
              findings_count: detail.findings?.length || 0,
              images: (detail.images || []).map((img: any) => ({
                view_type: img.view_type,
                thumbnail_url: img.thumbnail_url,
                min_temp_celsius: img.min_temp_celsius,
                max_temp_celsius: img.max_temp_celsius,
              })),
              findings: (detail.findings || []).map((f: any) => ({
                title: f.title,
                severity: f.severity,
                body_region: f.body_region,
                temperature_delta_celsius: f.temperature_delta_celsius,
              })),
            })
          }
        }
        setSessions(fullSessions)
      }
    } catch (e) {
      console.error('Failed to load history:', e)
    } finally {
      setLoading(false)
    }
  }

  function toggleCompare(sessionId: string) {
    setCompareSessionIds(prev => {
      if (prev.includes(sessionId)) return prev.filter(id => id !== sessionId)
      if (prev.length >= 2) return [prev[1], sessionId]
      return [...prev, sessionId]
    })
  }

  const patientName = sessions[0]?.patient_name || 'Patient'

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
      padding: 24,
    }}>
      {/* Header */}
      <div style={{
        maxWidth: 1000, margin: '0 auto 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <a href="/" style={{ fontSize: 11, color: '#888', textDecoration: 'none' }}>
            ← Back to Workstation
          </a>
          <h1 style={{
            fontFamily: "'Playfair Display', serif", fontSize: 22, color: '#d4a373',
            margin: '8px 0 4px',
          }}>
            {patientName}
          </h1>
          <div style={{ fontSize: 13, color: '#888' }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} on file
          </div>
        </div>
        <button
          className={compareMode ? 'btn-gold' : 'btn-outline'}
          onClick={() => { setCompareMode(!compareMode); setCompareSessionIds([]) }}
        >
          {compareMode ? 'Exit Compare' : 'Compare Sessions'}
        </button>
      </div>

      {/* Compare View */}
      {compareMode && compareSessionIds.length === 2 && (
        <div style={{
          maxWidth: 1000, margin: '0 auto 24px',
          background: 'rgba(26,26,46,0.6)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(212,163,115,0.2)', borderRadius: 12,
          padding: 20,
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: 14, color: '#d4a373',
            marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1,
          }}>
            Session Comparison
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {compareSessionIds.map(id => {
              const s = sessions.find(ss => ss.id === id)
              if (!s) return null
              return (
                <div key={id}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                    {new Date(s.session_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {s.images.map((img, i) => (
                      <div key={i} style={{
                        aspectRatio: '4/3', background: 'rgba(15,15,26,0.8)',
                        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#555', overflow: 'hidden',
                      }}>
                        {img.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img.thumbnail_url} alt={img.view_type} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : img.view_type}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {s.findings.slice(0, 3).map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#ccc', padding: '2px 0' }}>
                        <span className={`badge badge-${f.severity}`} style={{ marginRight: 6, fontSize: 9 }}>
                          {f.severity}
                        </span>
                        {f.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Session Timeline */}
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>Loading history...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>No sessions found for this patient.</div>
        ) : (
          sessions.map((s, idx) => (
            <div
              key={s.id}
              className="panel"
              style={{ marginBottom: 12, overflow: 'hidden' }}
            >
              {/* Session header */}
              <div
                onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                style={{
                  padding: '14px 20px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {compareMode && (
                    <input
                      type="checkbox"
                      checked={compareSessionIds.includes(s.id)}
                      onChange={() => toggleCompare(s.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ accentColor: '#d4a373' }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#e0e0e0' }}>
                      {new Date(s.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {s.images.length} views captured · {s.findings_count} findings
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge-status badge-${s.status}`}>
                    {STATUS_LABELS[s.status] || s.status}
                  </span>
                  <span style={{ color: '#555', fontSize: 16 }}>
                    {expandedSession === s.id ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {/* Expanded details */}
              {expandedSession === s.id && (
                <div style={{ padding: '0 20px 16px', borderTop: '1px solid rgba(212,163,115,0.1)' }}>
                  {/* Thumbnails */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6,
                    margin: '12px 0',
                  }}>
                    {s.images.map((img, i) => (
                      <div key={i} style={{
                        aspectRatio: '4/3', background: 'rgba(15,15,26,0.8)',
                        borderRadius: 6, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {img.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img.thumbnail_url} alt={img.view_type} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 9, color: '#555' }}>{img.view_type}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Findings */}
                  {s.findings.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Findings
                      </div>
                      {s.findings.map((f, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`badge badge-${f.severity}`} style={{ fontSize: 9 }}>
                              {f.severity}
                            </span>
                            <span style={{ fontSize: 12, color: '#ccc' }}>{f.title}</span>
                          </div>
                          {f.temperature_delta_celsius !== null && (
                            <span className="temp-readout" style={{ fontSize: 10 }}>
                              {Math.abs(f.temperature_delta_celsius).toFixed(1)}°C
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
