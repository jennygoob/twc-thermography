// Inflammation Mapping Engine
// Identifies hot spots where regional temperature significantly exceeds body average

import { HotSpotResult, FindingSeverity, ViewType, TreatmentRecommendation } from './thermography-types'
import { BODY_REGIONS } from './body-region-map'
import { getPatternsForRegion, getTreatmentText } from './pattern-library'

// Thresholds: degrees above body average to flag
const HOT_SPOT_THRESHOLDS = {
  mild: 1.0,
  moderate: 1.5,
  significant: 2.0,
}

// Cold zone thresholds: degrees below body average
const COLD_ZONE_THRESHOLDS = {
  mild: -2.0,
  moderate: -3.0,
  significant: -4.0,
}

function classifyHotSpotSeverity(elevation: number): FindingSeverity | null {
  if (elevation >= HOT_SPOT_THRESHOLDS.significant) return 'significant'
  if (elevation >= HOT_SPOT_THRESHOLDS.moderate) return 'moderate'
  if (elevation >= HOT_SPOT_THRESHOLDS.mild) return 'mild'
  return null
}

function classifyColdZoneSeverity(depression: number): FindingSeverity | null {
  if (depression <= COLD_ZONE_THRESHOLDS.significant) return 'significant'
  if (depression <= COLD_ZONE_THRESHOLDS.moderate) return 'moderate'
  if (depression <= COLD_ZONE_THRESHOLDS.mild) return 'mild'
  return null
}

/**
 * Detect inflammation hot spots in a single thermal image.
 *
 * regionTemps: Map of regionId -> average temperature
 * bodyAvgTemp: Overall body average temperature across all regions
 * imageId: The Supabase ID of the image being analyzed
 * viewType: Which view this image represents
 */
export function detectHotSpots(
  regionTemps: Map<string, number>,
  bodyAvgTemp: number,
  imageId: string,
  viewType: ViewType
): HotSpotResult[] {
  const regions = BODY_REGIONS[viewType]
  const results: HotSpotResult[] = []

  for (const region of regions) {
    const regionTemp = regionTemps.get(region.id)
    if (regionTemp === undefined) continue

    const elevation = regionTemp - bodyAvgTemp

    // Check for hot spots (inflammation)
    const hotSeverity = classifyHotSpotSeverity(elevation)
    if (hotSeverity) {
      results.push({
        region_id: region.id,
        region_label: region.label,
        avg_temp: Math.round(regionTemp * 100) / 100,
        body_avg_temp: Math.round(bodyAvgTemp * 100) / 100,
        elevation: Math.round(elevation * 100) / 100,
        severity: hotSeverity,
        image_id: imageId,
        view_type: viewType,
      })
    }

    // Check for cold zones (circulation issues)
    const coldSeverity = classifyColdZoneSeverity(elevation)
    if (coldSeverity) {
      results.push({
        region_id: region.id,
        region_label: region.label,
        avg_temp: Math.round(regionTemp * 100) / 100,
        body_avg_temp: Math.round(bodyAvgTemp * 100) / 100,
        elevation: Math.round(elevation * 100) / 100,
        severity: coldSeverity,
        image_id: imageId,
        view_type: viewType,
      })
    }
  }

  return results
}

/**
 * Generate human-readable description for a hot spot finding
 */
export function describeHotSpot(result: HotSpotResult): string {
  const isHot = result.elevation > 0

  if (isHot) {
    if (result.severity === 'significant') {
      return `Significant heat elevation of ${result.elevation.toFixed(1)}°C above body average detected in the ${result.region_label} (${result.avg_temp.toFixed(1)}°C). This indicates active inflammation that may benefit from targeted treatment.`
    }
    if (result.severity === 'moderate') {
      return `Moderate heat elevation of ${result.elevation.toFixed(1)}°C above body average in the ${result.region_label} (${result.avg_temp.toFixed(1)}°C). This suggests inflammation in this area.`
    }
    return `Mild heat elevation of ${result.elevation.toFixed(1)}°C above body average in the ${result.region_label} (${result.avg_temp.toFixed(1)}°C). Worth monitoring on follow-up imaging.`
  } else {
    if (result.severity === 'significant') {
      return `Significant temperature reduction of ${Math.abs(result.elevation).toFixed(1)}°C below body average in the ${result.region_label} (${result.avg_temp.toFixed(1)}°C). This may indicate reduced circulation or vascular insufficiency.`
    }
    if (result.severity === 'moderate') {
      return `Moderate temperature reduction of ${Math.abs(result.elevation).toFixed(1)}°C below body average in the ${result.region_label} (${result.avg_temp.toFixed(1)}°C). Consider circulation assessment.`
    }
    return `Mild temperature reduction of ${Math.abs(result.elevation).toFixed(1)}°C below body average in the ${result.region_label} (${result.avg_temp.toFixed(1)}°C). Monitor on follow-up.`
  }
}

/**
 * Map hot spot findings to treatment recommendations based on body region
 */
export function getRecommendationsForHotSpot(result: HotSpotResult): TreatmentRecommendation[] {
  const recs: TreatmentRecommendation[] = []
  const patterns = getPatternsForRegion(result.region_id)
  const isHot = result.elevation > 0

  if (isHot) {
    // Inflammation-based recommendations
    if (isJointRegion(result.region_id)) {
      recs.push({
        name: 'SoftWave Therapy',
        rationale: `Acoustic wave therapy to reduce inflammation in the ${result.region_label} and promote tissue healing`,
        service_type: 'softwave',
      })
    }

    if (result.severity === 'significant' || result.severity === 'moderate') {
      recs.push({
        name: 'IV Glutathione + Vitamin C',
        rationale: 'Systemic anti-inflammatory and antioxidant support to address elevated inflammation markers',
        service_type: 'iv_therapy',
      })
    }

    if (isMusculoskeletalRegion(result.region_id)) {
      recs.push({
        name: 'BPC-157 / TB-500 Peptide Protocol',
        rationale: `Targeted tissue repair peptides for the ${result.region_label} inflammation`,
        service_type: 'peptide',
      })
    }

    recs.push({
      name: 'Infrared Sauna',
      rationale: 'Deep tissue warming to improve circulation, reduce inflammation, and support recovery',
      service_type: 'sauna',
    })
  } else {
    // Cold zone / circulation-based recommendations
    recs.push({
      name: 'Infrared Sauna',
      rationale: `Improve peripheral circulation to the ${result.region_label}`,
      service_type: 'sauna',
    })
    if (isExtremityRegion(result.region_id)) {
      recs.push({
        name: 'SoftWave Therapy',
        rationale: 'Promote blood flow and angiogenesis in areas of reduced circulation',
        service_type: 'softwave',
      })
    }
  }

  return recs
}

// Region classification helpers
function isJointRegion(id: string): boolean {
  return /knee|shoulder|hip|elbow|ankle/.test(id)
}

function isMusculoskeletalRegion(id: string): boolean {
  return /knee|shoulder|hip|elbow|spine|lumbar|thoracic|cervical|back|hamstring|calf|glute/.test(id)
}

function isExtremityRegion(id: string): boolean {
  return /foot|toe|hand|heel|arch|ball|ankle/.test(id)
}
