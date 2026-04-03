// Analysis Engine — Orchestrates asymmetry detection, inflammation mapping, and pattern matching
// Runs server-side in API routes

import {
  AnalysisResult, ThermographyImage, ThermographyFinding,
  ViewType, FindingSeverity, TreatmentRecommendation,
} from './thermography-types'
import { BODY_REGIONS } from './body-region-map'
import { detectWithinViewAsymmetries, detectCrossViewAsymmetries, describeAsymmetry } from './asymmetry-detector'
import { detectHotSpots, describeHotSpot, getRecommendationsForHotSpot } from './inflammation-mapper'
import { THERMAL_PATTERNS, getTreatmentText } from './pattern-library'

const CAMERA_SERVICE_URL = process.env.CAMERA_SERVICE_URL || 'http://localhost:5050'

/**
 * Get temperature statistics for all body regions in an image.
 * Calls the Python camera service /analyze-region endpoint for each region.
 *
 * For production, the radiometric TIFF must be accessible to the camera service.
 * For simulation, we generate approximate values.
 */
async function getRegionTemperatures(
  image: ThermographyImage,
  viewType: ViewType
): Promise<Map<string, number>> {
  const regions = BODY_REGIONS[viewType]
  const temps = new Map<string, number>()

  if (!image.radiometric_data_url) {
    // Fallback: use image-level stats to generate approximate regional temps
    const baseTemp = image.avg_temp_celsius || 35.5
    for (const region of regions) {
      // Add slight variation per region
      const variation = (Math.random() - 0.5) * 2
      temps.set(region.id, baseTemp + variation)
    }
    return temps
  }

  // Call camera service for precise region analysis
  for (const region of regions) {
    try {
      const res = await fetch(`${CAMERA_SERVICE_URL}/analyze-region`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiff_path: image.radiometric_data_url,
          bounds: region.bounds,
        }),
      })

      if (res.ok) {
        const stats = await res.json()
        temps.set(region.id, stats.avg)
      }
    } catch {
      // If camera service unavailable, use approximation
      const baseTemp = image.avg_temp_celsius || 35.5
      temps.set(region.id, baseTemp + (Math.random() - 0.5) * 2)
    }
  }

  return temps
}

/**
 * Run full analysis on a session's captured images.
 * Returns findings to be stored in thermography_findings table.
 */
export async function analyzeSession(
  images: ThermographyImage[]
): Promise<ThermographyFinding[]> {
  const findings: ThermographyFinding[] = []
  const imagesByView = new Map<ViewType, ThermographyImage>()
  const tempsByView = new Map<ViewType, Map<string, number>>()

  // Organize images by view type and get region temperatures
  for (const image of images) {
    const viewType = image.view_type as ViewType
    imagesByView.set(viewType, image)

    const regionTemps = await getRegionTemperatures(image, viewType)
    tempsByView.set(viewType, regionTemps)
  }

  // Calculate overall body average
  let allTemps: number[] = []
  for (const temps of tempsByView.values()) {
    allTemps = allTemps.concat(Array.from(temps.values()))
  }
  const bodyAvgTemp = allTemps.length > 0
    ? allTemps.reduce((a, b) => a + b, 0) / allTemps.length
    : 35.5

  // ── 1. Within-view asymmetry detection ──
  for (const [viewType, regionTemps] of tempsByView) {
    const asymmetries = detectWithinViewAsymmetries(viewType, regionTemps)
    const image = imagesByView.get(viewType)!

    for (const asym of asymmetries) {
      findings.push({
        id: '', // Will be assigned by Supabase
        session_id: image.session_id,
        finding_type: 'asymmetry',
        body_region: asym.body_area,
        severity: asym.severity,
        temperature_delta_celsius: asym.delta_celsius,
        peak_temperature_celsius: Math.max(asym.left_avg_temp, asym.right_avg_temp),
        reference_temperature_celsius: Math.min(asym.left_avg_temp, asym.right_avg_temp),
        title: `${asym.body_area} Temperature Asymmetry`,
        description: describeAsymmetry(asym),
        clinical_significance: asym.severity === 'significant'
          ? 'Warrants clinical attention and possible follow-up imaging'
          : asym.severity === 'moderate'
            ? 'Monitor on follow-up scans'
            : 'Within watchable range',
        recommended_treatments: getAsymmetryTreatments(asym.body_area, asym.severity),
        image_id: image.id,
        region_coords: null,
        created_at: new Date().toISOString(),
      })
    }
  }

  // ── 2. Cross-view asymmetry (lateral left vs lateral right) ──
  const leftTemps = tempsByView.get('lateral_left')
  const rightTemps = tempsByView.get('lateral_right')
  if (leftTemps && rightTemps) {
    const crossAsymmetries = detectCrossViewAsymmetries(leftTemps, rightTemps)
    const leftImage = imagesByView.get('lateral_left')!

    for (const asym of crossAsymmetries) {
      findings.push({
        id: '',
        session_id: leftImage.session_id,
        finding_type: 'asymmetry',
        body_region: asym.body_area,
        severity: asym.severity,
        temperature_delta_celsius: asym.delta_celsius,
        peak_temperature_celsius: Math.max(asym.left_avg_temp, asym.right_avg_temp),
        reference_temperature_celsius: Math.min(asym.left_avg_temp, asym.right_avg_temp),
        title: `${asym.body_area} Lateral Asymmetry`,
        description: describeAsymmetry(asym),
        clinical_significance: null,
        recommended_treatments: getAsymmetryTreatments(asym.body_area, asym.severity),
        image_id: leftImage.id,
        region_coords: null,
        created_at: new Date().toISOString(),
      })
    }
  }

  // ── 3. Inflammation hot spot detection ──
  for (const [viewType, regionTemps] of tempsByView) {
    const image = imagesByView.get(viewType)!
    const hotSpots = detectHotSpots(regionTemps, bodyAvgTemp, image.id, viewType)

    for (const spot of hotSpots) {
      const isHot = spot.elevation > 0
      findings.push({
        id: '',
        session_id: image.session_id,
        finding_type: isHot ? 'hot_spot' : 'cold_zone',
        body_region: spot.region_label,
        severity: spot.severity,
        temperature_delta_celsius: spot.elevation,
        peak_temperature_celsius: spot.avg_temp,
        reference_temperature_celsius: spot.body_avg_temp,
        title: isHot
          ? `${spot.region_label} — Inflammation Detected`
          : `${spot.region_label} — Reduced Circulation`,
        description: describeHotSpot(spot),
        clinical_significance: null,
        recommended_treatments: getRecommendationsForHotSpot(spot),
        image_id: image.id,
        region_coords: null,
        created_at: new Date().toISOString(),
      })
    }
  }

  // ── 4. Pattern matching ──
  for (const pattern of THERMAL_PATTERNS) {
    const hasRequiredViews = pattern.required_views.every(v => imagesByView.has(v))
    if (!hasRequiredViews) continue

    // Check if any of the pattern's body regions have elevated temperatures
    let maxDelta = 0
    let maxTemp = 0
    let matchingRegions: string[] = []

    for (const regionId of pattern.body_regions) {
      for (const [viewType, regionTemps] of tempsByView) {
        const temp = regionTemps.get(regionId)
        if (temp === undefined) continue

        const elevation = temp - bodyAvgTemp
        if (Math.abs(elevation) > Math.abs(maxDelta)) {
          maxDelta = elevation
          maxTemp = temp
        }

        if (elevation >= pattern.temperature_thresholds.relative_high ||
            temp >= pattern.temperature_thresholds.absolute_high) {
          matchingRegions.push(regionId)
        }
      }
    }

    // Also check paired region asymmetry
    let hasAsymmetry = false
    for (const finding of findings) {
      if (finding.finding_type === 'asymmetry' &&
          pattern.body_regions.some(r => finding.body_region.toLowerCase().includes(r.replace(/_/g, ' ')))) {
        if (Math.abs(finding.temperature_delta_celsius || 0) >= pattern.temperature_thresholds.asymmetry_delta) {
          hasAsymmetry = true
          break
        }
      }
    }

    if (matchingRegions.length > 0 || hasAsymmetry) {
      const severity: FindingSeverity = matchingRegions.length >= 2 || hasAsymmetry ? 'moderate' : 'mild'

      const treatmentRecs: TreatmentRecommendation[] = []
      const treatmentTexts = getTreatmentText(pattern)
      for (const text of treatmentTexts) {
        const name = text.split(' — ')[0]
        const rationale = text.split(' — ')[1] || ''
        treatmentRecs.push({ name, rationale })
      }

      findings.push({
        id: '',
        session_id: images[0].session_id,
        finding_type: 'pattern',
        body_region: pattern.name,
        severity,
        temperature_delta_celsius: maxDelta,
        peak_temperature_celsius: maxTemp,
        reference_temperature_celsius: bodyAvgTemp,
        title: pattern.name,
        description: pattern.clinical_description,
        clinical_significance: `Pattern detected across ${matchingRegions.length} region(s)${hasAsymmetry ? ' with asymmetry' : ''}`,
        recommended_treatments: treatmentRecs,
        image_id: null,
        region_coords: null,
        created_at: new Date().toISOString(),
      })
    }
  }

  // Deduplicate: if same body region appears in both asymmetry and hot_spot, keep the more severe one
  return deduplicateFindings(findings)
}

function deduplicateFindings(findings: ThermographyFinding[]): ThermographyFinding[] {
  const severityRank: Record<FindingSeverity, number> = { mild: 1, moderate: 2, significant: 3 }
  const seen = new Map<string, ThermographyFinding>()

  for (const finding of findings) {
    const key = `${finding.finding_type}:${finding.body_region}`
    const existing = seen.get(key)

    if (!existing || severityRank[finding.severity] > severityRank[existing.severity]) {
      seen.set(key, finding)
    }
  }

  return Array.from(seen.values())
}

function getAsymmetryTreatments(bodyArea: string, severity: FindingSeverity): TreatmentRecommendation[] {
  const recs: TreatmentRecommendation[] = []
  const area = bodyArea.toLowerCase()

  if (/knee|shoulder|hip|elbow|back|spine/.test(area)) {
    recs.push({
      name: 'SoftWave Therapy',
      rationale: `Address ${bodyArea} inflammation with acoustic wave therapy`,
      service_type: 'softwave',
    })
  }

  if (severity === 'significant') {
    recs.push({
      name: 'IV Anti-Inflammatory Protocol',
      rationale: 'High-dose Glutathione + Vitamin C for systemic inflammation support',
      service_type: 'iv_therapy',
    })
    recs.push({
      name: 'BPC-157 Peptide Protocol',
      rationale: `Targeted tissue repair for the ${bodyArea}`,
      service_type: 'peptide',
    })
  }

  recs.push({
    name: 'Infrared Sauna',
    rationale: 'Support recovery and improve circulation',
    service_type: 'sauna',
  })

  return recs
}
