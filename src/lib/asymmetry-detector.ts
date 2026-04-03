// Asymmetry Detection Engine
// Compares temperature between paired left/right body regions

import { AsymmetryResult, FindingSeverity, ViewType, ThermographyImage } from './thermography-types'
import { BODY_REGIONS, getAsymmetryPairs } from './body-region-map'

// Thresholds for severity classification (in degrees Celsius)
const ASYMMETRY_THRESHOLDS = {
  mild: 0.5,
  moderate: 1.0,
  significant: 1.5,
}

function classifySeverity(delta: number): FindingSeverity | null {
  const absDelta = Math.abs(delta)
  if (absDelta >= ASYMMETRY_THRESHOLDS.significant) return 'significant'
  if (absDelta >= ASYMMETRY_THRESHOLDS.moderate) return 'moderate'
  if (absDelta >= ASYMMETRY_THRESHOLDS.mild) return 'mild'
  return null // Below threshold — no finding
}

interface RegionTempData {
  regionId: string
  avgTemp: number
}

/**
 * Detect temperature asymmetries within a single view (e.g., front: left breast vs right breast)
 *
 * regionTemps: Map of regionId -> average temperature (from camera service /analyze-region)
 */
export function detectWithinViewAsymmetries(
  viewType: ViewType,
  regionTemps: Map<string, number>
): AsymmetryResult[] {
  const pairs = getAsymmetryPairs(viewType)
  const results: AsymmetryResult[] = []

  for (const { left, right } of pairs) {
    const leftTemp = regionTemps.get(left.id)
    const rightTemp = regionTemps.get(right.id)

    if (leftTemp === undefined || rightTemp === undefined) continue

    const delta = leftTemp - rightTemp
    const severity = classifySeverity(delta)

    if (severity) {
      // Determine the body area name (strip left/right suffix for display)
      const bodyArea = left.label.replace(/^Left /, '').replace(/^Right /, '')

      results.push({
        region_left: left.id,
        region_right: right.id,
        left_avg_temp: leftTemp,
        right_avg_temp: rightTemp,
        delta_celsius: Math.round(delta * 100) / 100,
        severity,
        body_area: bodyArea,
      })
    }
  }

  return results
}

/**
 * Detect asymmetries across paired views (lateral_left vs lateral_right)
 *
 * leftViewTemps: region temps from lateral_left image
 * rightViewTemps: region temps from lateral_right image
 */
export function detectCrossViewAsymmetries(
  leftViewTemps: Map<string, number>,
  rightViewTemps: Map<string, number>
): AsymmetryResult[] {
  const results: AsymmetryResult[] = []

  // Match regions by suffix pattern (e.g., shoulder_lateral_left → shoulder_lateral_right)
  const leftRegions = BODY_REGIONS.lateral_left
  const rightRegions = BODY_REGIONS.lateral_right

  // Map by area name (strip _left/_right)
  for (const leftRegion of leftRegions) {
    const baseName = leftRegion.id.replace('_left', '')
    const rightRegion = rightRegions.find(r => r.id.replace('_right', '') === baseName)

    if (!rightRegion) continue

    const leftTemp = leftViewTemps.get(leftRegion.id)
    const rightTemp = rightViewTemps.get(rightRegion.id)

    if (leftTemp === undefined || rightTemp === undefined) continue

    const delta = leftTemp - rightTemp
    const severity = classifySeverity(delta)

    if (severity) {
      results.push({
        region_left: leftRegion.id,
        region_right: rightRegion.id,
        left_avg_temp: leftTemp,
        right_avg_temp: rightTemp,
        delta_celsius: Math.round(delta * 100) / 100,
        severity,
        body_area: leftRegion.label.replace(' (Left)', '').replace('Left ', ''),
      })
    }
  }

  return results
}

/**
 * Generate human-readable description for an asymmetry finding
 */
export function describeAsymmetry(result: AsymmetryResult): string {
  const warmerSide = result.delta_celsius > 0 ? 'left' : 'right'
  const absDelta = Math.abs(result.delta_celsius)

  if (result.severity === 'significant') {
    return `Significant temperature difference of ${absDelta.toFixed(1)}°C detected in the ${result.body_area} region. The ${warmerSide} side is notably warmer, which may indicate active inflammation, injury, or increased metabolic activity that should be evaluated.`
  }
  if (result.severity === 'moderate') {
    return `Moderate temperature asymmetry of ${absDelta.toFixed(1)}°C found in the ${result.body_area}. The ${warmerSide} side shows elevated temperature compared to the opposite side, suggesting possible localized inflammation.`
  }
  return `Mild temperature variation of ${absDelta.toFixed(1)}°C noted in the ${result.body_area}. The ${warmerSide} side is slightly warmer. This is within the watchable range and may benefit from monitoring on follow-up scans.`
}
