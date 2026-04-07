/**
 * Generate a sample ThermaScan AI report for sales outreach.
 * Run: npx tsx scripts/generate-sample-report.ts
 */

import { generateThermographyReport } from '../src/lib/thermography-pdf'
import {
  ThermographySession,
  ThermographyImage,
  ThermographyFinding,
  ViewType,
} from '../src/lib/thermography-types'
import * as fs from 'fs'
import * as path from 'path'

const now = new Date().toISOString()

// --- Session ---
const session: ThermographySession = {
  id: 'sample-001',
  patient_id: 'sample-pat',
  prospyr_contact_id: '',
  patient_name: 'Michael Torres',
  session_date: '2026-04-04T10:30:00-07:00',
  status: 'reported',
  notes: 'Chief complaint: Right knee pain (6 months), lower back stiffness, right shoulder discomfort. Active patient, runs 3x/week.',
  performed_by: 'Dr. Smith',
  analysis_completed_at: now,
  report_generated_at: now,
  portal_synced_at: null,
  created_at: now,
  updated_at: now,
}

// --- Images (6 views) ---
const views: { type: ViewType; min: number; max: number; avg: number }[] = [
  { type: 'front', min: 32.1, max: 37.8, avg: 35.4 },
  { type: 'back', min: 32.5, max: 37.2, avg: 35.6 },
  { type: 'lateral_left', min: 32.8, max: 36.4, avg: 35.1 },
  { type: 'lateral_right', min: 33.0, max: 37.9, avg: 35.8 },
  { type: 'feet_dorsal', min: 28.4, max: 34.2, avg: 31.8 },
  { type: 'feet_plantar', min: 27.9, max: 33.8, avg: 31.2 },
]

const images: ThermographyImage[] = views.map((v, i) => ({
  id: `img-${i + 1}`,
  session_id: 'sample-001',
  view_type: v.type,
  capture_order: i,
  radiometric_data_url: null,
  display_image_url: null,
  thumbnail_url: null,
  min_temp_celsius: v.min,
  max_temp_celsius: v.max,
  avg_temp_celsius: v.avg,
  ambient_temp_celsius: 21.5,
  emissivity: 0.98,
  captured_at: now,
  created_at: now,
}))

// --- Findings (realistic SoftWave-focused scenario) ---
const findings: ThermographyFinding[] = [
  {
    id: 'f-1',
    session_id: 'sample-001',
    finding_type: 'asymmetry',
    body_region: 'Right Knee',
    severity: 'significant',
    temperature_delta_celsius: 2.1,
    peak_temperature_celsius: 37.8,
    reference_temperature_celsius: 35.7,
    title: 'Right Knee — Significant Temperature Asymmetry',
    description: 'The right knee region shows elevated thermal activity 2.1°C above the contralateral left knee. This bilateral asymmetry pattern indicates concentrated inflammatory activity in the right knee joint and surrounding tissues. The thermal elevation extends from the medial to lateral compartments, consistent with diffuse inflammatory involvement. This pattern directly correlates with the patient\'s reported right knee pain and reduced mobility over the past 6 months.',
    clinical_significance: 'Active inflammatory process in the right knee. Asymmetry of this magnitude warrants targeted intervention. The diffuse pattern suggests both joint and soft tissue involvement.',
    recommended_treatments: [
      { name: 'SoftWave Therapy — Right Knee', rationale: 'Acoustic wave therapy to target active inflammation pattern. Protocol: 2x/week for 4 weeks (intensive), then weekly for 4 weeks (maintenance). Focus on medial and lateral compartments based on thermal distribution.', service_type: 'softwave' },
      { name: 'Infrared Sauna', rationale: 'Systemic anti-inflammatory support and circulation enhancement. 2-3 sessions per week, 30 minutes. Complements targeted SoftWave therapy.', service_type: 'sauna' },
    ],
    image_id: 'img-1',
    region_coords: null,
    created_at: now,
  },
  {
    id: 'f-2',
    session_id: 'sample-001',
    finding_type: 'hot_spot',
    body_region: 'Lumbar Spine (L4-L5)',
    severity: 'moderate',
    temperature_delta_celsius: 1.6,
    peak_temperature_celsius: 37.2,
    reference_temperature_celsius: 35.6,
    title: 'Lumbar Spine — Moderate Inflammatory Hot Spot',
    description: 'Elevated thermal activity detected in the L4-L5 lumbar region, running 1.6°C above the surrounding spinal tissue average. The heat pattern is concentrated along the paraspinal muscles with some extension into the posterior midline. This is consistent with muscular tension and compensatory strain — commonly observed when patients alter their gait pattern to favor a painful knee.',
    clinical_significance: 'Compensatory lumbar inflammation secondary to altered gait mechanics. Addressing the primary knee inflammation should reduce compensatory load, but direct treatment of the lumbar region will accelerate recovery.',
    recommended_treatments: [
      { name: 'SoftWave Therapy — Lumbar Spine', rationale: 'Target compensatory inflammation in the L4-L5 paraspinal region. Can be combined with knee sessions. Protocol: 1x/week for 6 weeks.', service_type: 'softwave' },
      { name: 'Lymphatic Shake Plate', rationale: 'Whole-body lymphatic drainage to support clearance of inflammatory metabolites from both knee and lumbar regions.', service_type: 'shake_plate' },
    ],
    image_id: 'img-2',
    region_coords: null,
    created_at: now,
  },
  {
    id: 'f-3',
    session_id: 'sample-001',
    finding_type: 'asymmetry',
    body_region: 'Right Shoulder',
    severity: 'mild',
    temperature_delta_celsius: 0.8,
    peak_temperature_celsius: 36.9,
    reference_temperature_celsius: 36.1,
    title: 'Right Shoulder — Mild Temperature Asymmetry',
    description: 'The right shoulder demonstrates a mild thermal elevation of 0.8°C compared to the left shoulder. While below the threshold for significant clinical concern, this pattern may indicate early-stage soft tissue inflammation or chronic muscular tension in the right rotator cuff / upper trapezius region.',
    clinical_significance: 'Mild asymmetry — monitor at follow-up scan. May represent early inflammatory process or chronic tension pattern. If left unaddressed, could progress to a more significant finding.',
    recommended_treatments: [
      { name: 'SoftWave Therapy — Right Shoulder (Optional)', rationale: 'Preventive treatment to address early-stage inflammation before it becomes significant. Can be added to knee + lumbar protocol at minimal additional time.', service_type: 'softwave' },
    ],
    image_id: 'img-3',
    region_coords: null,
    created_at: now,
  },
  {
    id: 'f-4',
    session_id: 'sample-001',
    finding_type: 'cold_zone',
    body_region: 'Bilateral Feet',
    severity: 'mild',
    temperature_delta_celsius: -2.8,
    peak_temperature_celsius: 33.8,
    reference_temperature_celsius: 35.6,
    title: 'Bilateral Feet — Reduced Peripheral Circulation',
    description: 'Both feet show thermal readings 2.8°C below the body average, indicating reduced peripheral circulation. The plantar surfaces are particularly cool (avg 31.2°C). This pattern is common in patients who spend extended time seated or standing and may be exacerbated by altered gait mechanics from the right knee condition.',
    clinical_significance: 'Peripheral circulation deficit. Not urgent but indicates systemic circulatory considerations. Improving circulation will support healing in the knee and lumbar regions.',
    recommended_treatments: [
      { name: 'Infrared Sauna', rationale: 'Promotes peripheral vasodilation and circulatory improvement. Whole-body benefit including improved circulation to affected knee and lumbar regions.', service_type: 'sauna' },
    ],
    image_id: 'img-5',
    region_coords: null,
    created_at: now,
  },
]

// --- Generate ---
console.log('Generating sample ThermaScan AI report...')
const pdfBuffer = generateThermographyReport({
  session,
  images,
  findings,
  annotations: [],
})

// Save to both locations
const outputPaths = [
  path.resolve(__dirname, '../sample-report.pdf'),
  path.resolve(__dirname, '../../thermascan-ai/public/sample-report.pdf'),
]

for (const p of outputPaths) {
  fs.writeFileSync(p, pdfBuffer)
  console.log(`Saved: ${p}`)
}

console.log(`\nReport details:`)
console.log(`  Patient: ${session.patient_name}`)
console.log(`  Views: ${images.length}`)
console.log(`  Findings: ${findings.length}`)
console.log(`  - Significant: ${findings.filter(f => f.severity === 'significant').length}`)
console.log(`  - Moderate: ${findings.filter(f => f.severity === 'moderate').length}`)
console.log(`  - Mild: ${findings.filter(f => f.severity === 'mild').length}`)
console.log(`\nDone!`)
