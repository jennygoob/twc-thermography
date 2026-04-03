// ============================================================
// TWC Thermography System — Core Type Definitions
// ============================================================

// View types for body region captures
export type ViewType = 'front' | 'back' | 'lateral_left' | 'lateral_right' | 'feet_dorsal' | 'feet_plantar'

export const VIEW_LABELS: Record<ViewType, string> = {
  front: 'Front',
  back: 'Back',
  lateral_left: 'Left Lateral',
  lateral_right: 'Right Lateral',
  feet_dorsal: 'Feet (Top)',
  feet_plantar: 'Feet (Bottom)',
}

export const VIEW_ORDER: ViewType[] = ['front', 'back', 'lateral_left', 'lateral_right', 'feet_dorsal', 'feet_plantar']

// Session status progression
export type SessionStatus = 'in_progress' | 'captured' | 'analyzed' | 'reported' | 'synced'

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  in_progress: 'In Progress',
  captured: 'Images Captured',
  analyzed: 'Analysis Complete',
  reported: 'Report Generated',
  synced: 'Synced to Portal',
}

// Finding types from analysis engine
export type FindingType = 'asymmetry' | 'hot_spot' | 'pattern' | 'cold_zone'
export type FindingSeverity = 'mild' | 'moderate' | 'significant'

export const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  mild: '#d4a373',       // gold
  moderate: '#e07020',   // orange
  significant: '#c82828', // red
}

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  significant: 'Significant',
}

// Annotation drawing tools
export type AnnotationType = 'circle' | 'arrow' | 'freehand' | 'text' | 'rectangle'

// Thermal color palettes
export type ThermalPalette = 'ironbow' | 'rainbow' | 'arctic' | 'gray'

// ============================================================
// Database Row Types (match Supabase tables)
// ============================================================

export interface ThermographySession {
  id: string
  patient_id: string
  prospyr_contact_id: string
  patient_name: string
  session_date: string
  status: SessionStatus
  notes: string | null
  performed_by: string | null
  analysis_completed_at: string | null
  report_generated_at: string | null
  portal_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface ThermographyImage {
  id: string
  session_id: string
  view_type: ViewType
  capture_order: number
  radiometric_data_url: string | null
  display_image_url: string | null
  thumbnail_url: string | null
  min_temp_celsius: number | null
  max_temp_celsius: number | null
  avg_temp_celsius: number | null
  ambient_temp_celsius: number | null
  emissivity: number
  captured_at: string
  created_at: string
}

export interface ThermographyFinding {
  id: string
  session_id: string
  finding_type: FindingType
  body_region: string
  severity: FindingSeverity
  temperature_delta_celsius: number | null
  peak_temperature_celsius: number | null
  reference_temperature_celsius: number | null
  title: string
  description: string
  clinical_significance: string | null
  recommended_treatments: TreatmentRecommendation[]
  image_id: string | null
  region_coords: RegionCoords | null
  created_at: string
}

export interface ThermographyAnnotation {
  id: string
  image_id: string
  annotation_type: AnnotationType
  coordinates: AnnotationCoords
  label: string | null
  color: string
  stroke_width: number
  created_by: string | null
  created_at: string
}

export interface ThermographyReport {
  id: string
  session_id: string
  report_url: string | null
  report_version: number
  portal_token: string | null
  portal_synced: boolean
  portal_synced_at: string | null
  generated_at: string
}

// ============================================================
// Sub-Types
// ============================================================

export interface TreatmentRecommendation {
  name: string
  rationale: string
  service_type?: 'softwave' | 'iv_therapy' | 'peptide' | 'sauna' | 'shake_plate' | 'morpheus8'
}

export interface RegionCoords {
  x: number
  y: number
  width: number
  height: number
}

export interface AnnotationCoords {
  // Circle: { cx, cy, radius }
  // Arrow: { x1, y1, x2, y2 }
  // Rectangle: { x, y, width, height }
  // Freehand: { points: [{ x, y }] }
  // Text: { x, y }
  [key: string]: unknown
}

// ============================================================
// Body Region Mapping
// ============================================================

export interface BodyRegion {
  id: string
  label: string
  pairedWith?: string   // ID of the contralateral region for asymmetry detection
  bounds: NormalizedBounds
}

export interface NormalizedBounds {
  x: number   // 0-1 from left
  y: number   // 0-1 from top
  w: number   // 0-1 width
  h: number   // 0-1 height
}

// ============================================================
// Camera Service Types
// ============================================================

export interface CameraStatus {
  connected: boolean
  camera_model: string | null
  serial_number: string | null
  firmware_version: string | null
  sensor_temperature_celsius: number | null
  current_palette: ThermalPalette
  emissivity: number
  temperature_range: { min: number; max: number }
  error: string | null
}

export interface CaptureResult {
  radiometric_path: string
  display_path: string
  thumbnail_path: string
  min_temp: number
  max_temp: number
  avg_temp: number
  ambient_temp: number | null
  timestamp: string
}

export interface CameraSettings {
  emissivity: number
  palette: ThermalPalette
  temp_range_min: number
  temp_range_max: number
}

// ============================================================
// Analysis Engine Types
// ============================================================

export interface AsymmetryResult {
  region_left: string
  region_right: string
  left_avg_temp: number
  right_avg_temp: number
  delta_celsius: number
  severity: FindingSeverity
  body_area: string
}

export interface HotSpotResult {
  region_id: string
  region_label: string
  avg_temp: number
  body_avg_temp: number
  elevation: number
  severity: FindingSeverity
  image_id: string
  view_type: ViewType
}

export interface PatternMatch {
  pattern_id: string
  pattern_name: string
  confidence: 'low' | 'medium' | 'high'
  body_regions: string[]
  description: string
  clinical_description: string
  treatment_links: {
    softwave: boolean
    iv_therapy: boolean
    peptides: boolean
    sauna: boolean
  }
}

export interface AnalysisResult {
  session_id: string
  asymmetries: AsymmetryResult[]
  hot_spots: HotSpotResult[]
  patterns: PatternMatch[]
  overall_body_avg_temp: number
  total_findings: number
  analysis_timestamp: string
}

// ============================================================
// Patient / Portal Types
// ============================================================

export interface PatientSearchResult {
  id: string
  prospyr_contact_id: string
  name: string
  email: string | null
  phone: string | null
  last_session_date: string | null
  session_count: number
}

export interface StaffAuth {
  pin: string
  name: string
  role: 'provider' | 'rn' | 'admin' | 'ceo'
}

// ============================================================
// Thermal Pattern Templates
// ============================================================

export interface ThermalPattern {
  id: string
  name: string
  body_regions: string[]
  required_views: ViewType[]
  temperature_thresholds: {
    asymmetry_delta: number    // min delta to flag
    absolute_high: number      // temp above which = significant
    relative_high: number      // degrees above body average
  }
  clinical_description: string
  treatment_links: {
    softwave: boolean
    iv_therapy: boolean
    peptides: boolean
    sauna: boolean
  }
}
