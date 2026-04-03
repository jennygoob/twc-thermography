// Thermal pattern templates for clinical analysis
// Maps known thermal signatures to body regions and treatment recommendations

import { ThermalPattern } from './thermography-types'

export const THERMAL_PATTERNS: ThermalPattern[] = [
  // ── Breast Thermography ──
  {
    id: 'breast_vascular',
    name: 'Breast Vascular Pattern',
    body_regions: ['breast_left', 'breast_right'],
    required_views: ['front'],
    temperature_thresholds: {
      asymmetry_delta: 1.0,
      absolute_high: 37.5,
      relative_high: 1.5,
    },
    clinical_description: 'Increased vascular activity detected in breast tissue. This pattern may indicate heightened metabolic activity that warrants monitoring and follow-up imaging.',
    treatment_links: { softwave: false, iv_therapy: true, peptides: true, sauna: true },
  },
  {
    id: 'breast_asymmetry',
    name: 'Breast Temperature Asymmetry',
    body_regions: ['breast_left', 'breast_right'],
    required_views: ['front'],
    temperature_thresholds: {
      asymmetry_delta: 0.8,
      absolute_high: 37.0,
      relative_high: 1.0,
    },
    clinical_description: 'Temperature difference between left and right breast regions exceeds normal range. Asymmetric heat patterns may reflect differences in blood flow or tissue metabolism.',
    treatment_links: { softwave: false, iv_therapy: true, peptides: false, sauna: true },
  },

  // ── Thyroid ──
  {
    id: 'thyroid_hyperactive',
    name: 'Thyroid Hyperactivity',
    body_regions: ['thyroid', 'neck_front'],
    required_views: ['front'],
    temperature_thresholds: {
      asymmetry_delta: 0.5,
      absolute_high: 37.8,
      relative_high: 1.5,
    },
    clinical_description: 'Elevated temperature over the thyroid region suggests increased metabolic activity. Correlate with thyroid lab panel (TSH, Free T3, Free T4, thyroid antibodies).',
    treatment_links: { softwave: false, iv_therapy: true, peptides: true, sauna: false },
  },

  // ── Spinal / Back ──
  {
    id: 'cervical_inflammation',
    name: 'Cervical Spine Inflammation',
    body_regions: ['cervical_spine', 'neck_front'],
    required_views: ['back', 'front'],
    temperature_thresholds: {
      asymmetry_delta: 0.5,
      absolute_high: 37.5,
      relative_high: 1.2,
    },
    clinical_description: 'Heat pattern along the cervical spine indicates inflammation or muscular tension. Common in patients with neck pain, headaches, or upper body stiffness.',
    treatment_links: { softwave: true, iv_therapy: false, peptides: true, sauna: true },
  },
  {
    id: 'thoracic_inflammation',
    name: 'Thoracic Spine Inflammation',
    body_regions: ['thoracic_spine', 'upper_back_left', 'upper_back_right'],
    required_views: ['back'],
    temperature_thresholds: {
      asymmetry_delta: 0.6,
      absolute_high: 37.5,
      relative_high: 1.3,
    },
    clinical_description: 'Elevated temperatures along the thoracic spine suggest inflammation in the mid-back region. This pattern is often associated with postural issues or disc-related inflammation.',
    treatment_links: { softwave: true, iv_therapy: false, peptides: true, sauna: true },
  },
  {
    id: 'lumbar_inflammation',
    name: 'Lumbar Spine Inflammation',
    body_regions: ['lumbar_spine', 'lower_back_left', 'lower_back_right', 'sacral'],
    required_views: ['back'],
    temperature_thresholds: {
      asymmetry_delta: 0.6,
      absolute_high: 37.5,
      relative_high: 1.3,
    },
    clinical_description: 'Heat patterns in the lumbar and sacral region indicate lower back inflammation. Commonly associated with disc degeneration, sciatica, or chronic lower back pain.',
    treatment_links: { softwave: true, iv_therapy: true, peptides: true, sauna: true },
  },

  // ── Joint Patterns ──
  {
    id: 'knee_inflammation',
    name: 'Knee Joint Inflammation',
    body_regions: ['knee_left_front', 'knee_right_front', 'knee_lateral_left', 'knee_lateral_right'],
    required_views: ['front', 'lateral_left', 'lateral_right'],
    temperature_thresholds: {
      asymmetry_delta: 0.8,
      absolute_high: 37.0,
      relative_high: 1.5,
    },
    clinical_description: 'Elevated temperature around the knee joint suggests active inflammation. This can indicate arthritis, tendinitis, meniscal issues, or post-injury inflammation.',
    treatment_links: { softwave: true, iv_therapy: true, peptides: true, sauna: true },
  },
  {
    id: 'shoulder_inflammation',
    name: 'Shoulder Joint Inflammation',
    body_regions: ['shoulder_left', 'shoulder_right', 'shoulder_lateral_left', 'shoulder_lateral_right'],
    required_views: ['front', 'lateral_left', 'lateral_right'],
    temperature_thresholds: {
      asymmetry_delta: 0.8,
      absolute_high: 37.2,
      relative_high: 1.5,
    },
    clinical_description: 'Heat patterns around the shoulder joint indicate inflammation. Common causes include rotator cuff issues, bursitis, or impingement syndrome.',
    treatment_links: { softwave: true, iv_therapy: false, peptides: true, sauna: true },
  },
  {
    id: 'hip_inflammation',
    name: 'Hip Joint Inflammation',
    body_regions: ['hip_left', 'hip_right', 'glute_left', 'glute_right'],
    required_views: ['lateral_left', 'lateral_right', 'back'],
    temperature_thresholds: {
      asymmetry_delta: 0.8,
      absolute_high: 37.0,
      relative_high: 1.3,
    },
    clinical_description: 'Elevated temperature in the hip region suggests joint inflammation. May be associated with bursitis, arthritis, or hip flexor strain.',
    treatment_links: { softwave: true, iv_therapy: false, peptides: true, sauna: true },
  },

  // ── Abdominal ──
  {
    id: 'abdominal_inflammation',
    name: 'Abdominal Inflammation',
    body_regions: ['upper_abdomen', 'lower_abdomen'],
    required_views: ['front'],
    temperature_thresholds: {
      asymmetry_delta: 0.5,
      absolute_high: 37.5,
      relative_high: 1.5,
    },
    clinical_description: 'Elevated abdominal temperature may indicate visceral inflammation, digestive dysfunction, or systemic inflammatory response. Correlate with inflammatory markers (CRP, ESR).',
    treatment_links: { softwave: false, iv_therapy: true, peptides: true, sauna: true },
  },

  // ── Extremity Circulation ──
  {
    id: 'peripheral_vascular',
    name: 'Peripheral Vascular Insufficiency',
    body_regions: ['foot_dorsal_left', 'foot_dorsal_right', 'foot_plantar_left', 'foot_plantar_right', 'toes_left', 'toes_right'],
    required_views: ['feet_dorsal', 'feet_plantar'],
    temperature_thresholds: {
      asymmetry_delta: 1.5,
      absolute_high: 32.0,  // Cold is the concern here
      relative_high: -3.0,  // Negative = below average (cold zones)
    },
    clinical_description: 'Significant temperature reduction in the feet or toes indicates reduced peripheral circulation. This pattern warrants assessment of vascular health and may benefit from circulation-enhancing therapies.',
    treatment_links: { softwave: true, iv_therapy: true, peptides: false, sauna: true },
  },
  {
    id: 'hand_circulation',
    name: 'Hand Circulation Pattern',
    body_regions: ['hand_left', 'hand_right'],
    required_views: ['front'],
    temperature_thresholds: {
      asymmetry_delta: 1.5,
      absolute_high: 32.0,
      relative_high: -3.0,
    },
    clinical_description: 'Cold hands or significant temperature asymmetry between hands may indicate Raynaud\'s phenomenon, peripheral neuropathy, or circulatory issues.',
    treatment_links: { softwave: false, iv_therapy: true, peptides: false, sauna: true },
  },

  // ── Elbow ──
  {
    id: 'elbow_inflammation',
    name: 'Elbow Inflammation',
    body_regions: ['elbow_left', 'elbow_right'],
    required_views: ['front'],
    temperature_thresholds: {
      asymmetry_delta: 0.8,
      absolute_high: 37.0,
      relative_high: 1.5,
    },
    clinical_description: 'Elevated temperature around the elbow joint suggests inflammation. Common in tennis elbow (lateral epicondylitis), golfer\'s elbow, or repetitive strain injuries.',
    treatment_links: { softwave: true, iv_therapy: false, peptides: true, sauna: false },
  },
]

// Group patterns by body area for quick lookup
export function getPatternsForRegion(regionId: string): ThermalPattern[] {
  return THERMAL_PATTERNS.filter(p => p.body_regions.includes(regionId))
}

// Get treatment recommendations text for findings
export function getTreatmentText(pattern: ThermalPattern): string[] {
  const recs: string[] = []
  if (pattern.treatment_links.softwave) {
    recs.push('SoftWave Therapy — Acoustic wave technology to reduce inflammation and promote tissue healing')
  }
  if (pattern.treatment_links.iv_therapy) {
    recs.push('IV Therapy — Glutathione and Vitamin C infusion for systemic anti-inflammatory support')
  }
  if (pattern.treatment_links.peptides) {
    recs.push('Peptide Protocol — BPC-157 and TB-500 for accelerated tissue recovery and repair')
  }
  if (pattern.treatment_links.sauna) {
    recs.push('Infrared Sauna — Deep tissue warming to improve circulation and reduce chronic inflammation')
  }
  return recs
}
