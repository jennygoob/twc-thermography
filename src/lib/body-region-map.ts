// Body region ROI definitions — normalized coordinates (0-1) per view type
// Used by analysis engine for asymmetry detection and inflammation mapping

import { ViewType, BodyRegion } from './thermography-types'

export const BODY_REGIONS: Record<ViewType, BodyRegion[]> = {
  front: [
    { id: 'head_front', label: 'Head', bounds: { x: 0.35, y: 0, w: 0.3, h: 0.1 } },
    { id: 'thyroid', label: 'Thyroid', bounds: { x: 0.38, y: 0.1, w: 0.24, h: 0.04 } },
    { id: 'neck_front', label: 'Neck', bounds: { x: 0.35, y: 0.1, w: 0.3, h: 0.05 } },
    { id: 'shoulder_left', label: 'Left Shoulder', pairedWith: 'shoulder_right', bounds: { x: 0.1, y: 0.14, w: 0.2, h: 0.06 } },
    { id: 'shoulder_right', label: 'Right Shoulder', pairedWith: 'shoulder_left', bounds: { x: 0.7, y: 0.14, w: 0.2, h: 0.06 } },
    { id: 'breast_left', label: 'Left Breast', pairedWith: 'breast_right', bounds: { x: 0.2, y: 0.18, w: 0.25, h: 0.13 } },
    { id: 'breast_right', label: 'Right Breast', pairedWith: 'breast_left', bounds: { x: 0.55, y: 0.18, w: 0.25, h: 0.13 } },
    { id: 'upper_abdomen', label: 'Upper Abdomen', bounds: { x: 0.3, y: 0.31, w: 0.4, h: 0.1 } },
    { id: 'lower_abdomen', label: 'Lower Abdomen', bounds: { x: 0.3, y: 0.41, w: 0.4, h: 0.1 } },
    { id: 'elbow_left', label: 'Left Elbow', pairedWith: 'elbow_right', bounds: { x: 0.02, y: 0.32, w: 0.12, h: 0.08 } },
    { id: 'elbow_right', label: 'Right Elbow', pairedWith: 'elbow_left', bounds: { x: 0.86, y: 0.32, w: 0.12, h: 0.08 } },
    { id: 'hand_left', label: 'Left Hand', pairedWith: 'hand_right', bounds: { x: 0, y: 0.48, w: 0.12, h: 0.1 } },
    { id: 'hand_right', label: 'Right Hand', pairedWith: 'hand_left', bounds: { x: 0.88, y: 0.48, w: 0.12, h: 0.1 } },
    { id: 'knee_left_front', label: 'Left Knee', pairedWith: 'knee_right_front', bounds: { x: 0.25, y: 0.6, w: 0.18, h: 0.1 } },
    { id: 'knee_right_front', label: 'Right Knee', pairedWith: 'knee_left_front', bounds: { x: 0.57, y: 0.6, w: 0.18, h: 0.1 } },
    { id: 'shin_left', label: 'Left Shin', pairedWith: 'shin_right', bounds: { x: 0.27, y: 0.7, w: 0.15, h: 0.15 } },
    { id: 'shin_right', label: 'Right Shin', pairedWith: 'shin_left', bounds: { x: 0.58, y: 0.7, w: 0.15, h: 0.15 } },
    { id: 'ankle_left', label: 'Left Ankle', pairedWith: 'ankle_right', bounds: { x: 0.27, y: 0.85, w: 0.15, h: 0.08 } },
    { id: 'ankle_right', label: 'Right Ankle', pairedWith: 'ankle_left', bounds: { x: 0.58, y: 0.85, w: 0.15, h: 0.08 } },
  ],

  back: [
    { id: 'head_back', label: 'Head (Posterior)', bounds: { x: 0.35, y: 0, w: 0.3, h: 0.1 } },
    { id: 'cervical_spine', label: 'Cervical Spine', bounds: { x: 0.4, y: 0.1, w: 0.2, h: 0.05 } },
    { id: 'upper_back_left', label: 'Left Upper Back', pairedWith: 'upper_back_right', bounds: { x: 0.15, y: 0.14, w: 0.3, h: 0.12 } },
    { id: 'upper_back_right', label: 'Right Upper Back', pairedWith: 'upper_back_left', bounds: { x: 0.55, y: 0.14, w: 0.3, h: 0.12 } },
    { id: 'thoracic_spine', label: 'Thoracic Spine', bounds: { x: 0.4, y: 0.15, w: 0.2, h: 0.18 } },
    { id: 'lumbar_spine', label: 'Lumbar Spine', bounds: { x: 0.38, y: 0.33, w: 0.24, h: 0.12 } },
    { id: 'lower_back_left', label: 'Left Lower Back', pairedWith: 'lower_back_right', bounds: { x: 0.15, y: 0.33, w: 0.25, h: 0.12 } },
    { id: 'lower_back_right', label: 'Right Lower Back', pairedWith: 'lower_back_left', bounds: { x: 0.6, y: 0.33, w: 0.25, h: 0.12 } },
    { id: 'sacral', label: 'Sacral Region', bounds: { x: 0.35, y: 0.45, w: 0.3, h: 0.08 } },
    { id: 'glute_left', label: 'Left Glute', pairedWith: 'glute_right', bounds: { x: 0.2, y: 0.48, w: 0.25, h: 0.1 } },
    { id: 'glute_right', label: 'Right Glute', pairedWith: 'glute_left', bounds: { x: 0.55, y: 0.48, w: 0.25, h: 0.1 } },
    { id: 'hamstring_left', label: 'Left Hamstring', pairedWith: 'hamstring_right', bounds: { x: 0.22, y: 0.58, w: 0.2, h: 0.15 } },
    { id: 'hamstring_right', label: 'Right Hamstring', pairedWith: 'hamstring_left', bounds: { x: 0.58, y: 0.58, w: 0.2, h: 0.15 } },
    { id: 'calf_left', label: 'Left Calf', pairedWith: 'calf_right', bounds: { x: 0.25, y: 0.73, w: 0.17, h: 0.15 } },
    { id: 'calf_right', label: 'Right Calf', pairedWith: 'calf_left', bounds: { x: 0.58, y: 0.73, w: 0.17, h: 0.15 } },
  ],

  lateral_left: [
    { id: 'head_lateral_left', label: 'Head (Left)', bounds: { x: 0.3, y: 0, w: 0.35, h: 0.12 } },
    { id: 'neck_lateral_left', label: 'Neck (Left)', bounds: { x: 0.35, y: 0.12, w: 0.25, h: 0.05 } },
    { id: 'shoulder_lateral_left', label: 'Left Shoulder', bounds: { x: 0.25, y: 0.15, w: 0.3, h: 0.08 } },
    { id: 'arm_lateral_left', label: 'Left Arm', bounds: { x: 0.1, y: 0.2, w: 0.2, h: 0.25 } },
    { id: 'torso_lateral_left', label: 'Left Torso', bounds: { x: 0.3, y: 0.2, w: 0.35, h: 0.3 } },
    { id: 'hip_left', label: 'Left Hip', bounds: { x: 0.3, y: 0.45, w: 0.3, h: 0.1 } },
    { id: 'thigh_lateral_left', label: 'Left Thigh', bounds: { x: 0.25, y: 0.55, w: 0.35, h: 0.15 } },
    { id: 'knee_lateral_left', label: 'Left Knee (Lateral)', bounds: { x: 0.3, y: 0.65, w: 0.25, h: 0.08 } },
    { id: 'lower_leg_lateral_left', label: 'Left Lower Leg', bounds: { x: 0.3, y: 0.73, w: 0.2, h: 0.17 } },
  ],

  lateral_right: [
    { id: 'head_lateral_right', label: 'Head (Right)', bounds: { x: 0.3, y: 0, w: 0.35, h: 0.12 } },
    { id: 'neck_lateral_right', label: 'Neck (Right)', bounds: { x: 0.35, y: 0.12, w: 0.25, h: 0.05 } },
    { id: 'shoulder_lateral_right', label: 'Right Shoulder', bounds: { x: 0.4, y: 0.15, w: 0.3, h: 0.08 } },
    { id: 'arm_lateral_right', label: 'Right Arm', bounds: { x: 0.65, y: 0.2, w: 0.2, h: 0.25 } },
    { id: 'torso_lateral_right', label: 'Right Torso', bounds: { x: 0.3, y: 0.2, w: 0.35, h: 0.3 } },
    { id: 'hip_right', label: 'Right Hip', bounds: { x: 0.35, y: 0.45, w: 0.3, h: 0.1 } },
    { id: 'thigh_lateral_right', label: 'Right Thigh', bounds: { x: 0.35, y: 0.55, w: 0.35, h: 0.15 } },
    { id: 'knee_lateral_right', label: 'Right Knee (Lateral)', bounds: { x: 0.4, y: 0.65, w: 0.25, h: 0.08 } },
    { id: 'lower_leg_lateral_right', label: 'Right Lower Leg', bounds: { x: 0.45, y: 0.73, w: 0.2, h: 0.17 } },
  ],

  feet_dorsal: [
    { id: 'foot_dorsal_left', label: 'Left Foot (Top)', pairedWith: 'foot_dorsal_right', bounds: { x: 0.05, y: 0.1, w: 0.4, h: 0.8 } },
    { id: 'foot_dorsal_right', label: 'Right Foot (Top)', pairedWith: 'foot_dorsal_left', bounds: { x: 0.55, y: 0.1, w: 0.4, h: 0.8 } },
    { id: 'toes_left', label: 'Left Toes', pairedWith: 'toes_right', bounds: { x: 0.05, y: 0.1, w: 0.4, h: 0.25 } },
    { id: 'toes_right', label: 'Right Toes', pairedWith: 'toes_left', bounds: { x: 0.55, y: 0.1, w: 0.4, h: 0.25 } },
    { id: 'midfoot_left', label: 'Left Midfoot', pairedWith: 'midfoot_right', bounds: { x: 0.1, y: 0.35, w: 0.3, h: 0.3 } },
    { id: 'midfoot_right', label: 'Right Midfoot', pairedWith: 'midfoot_left', bounds: { x: 0.6, y: 0.35, w: 0.3, h: 0.3 } },
  ],

  feet_plantar: [
    { id: 'foot_plantar_left', label: 'Left Sole', pairedWith: 'foot_plantar_right', bounds: { x: 0.05, y: 0.1, w: 0.4, h: 0.8 } },
    { id: 'foot_plantar_right', label: 'Right Sole', pairedWith: 'foot_plantar_left', bounds: { x: 0.55, y: 0.1, w: 0.4, h: 0.8 } },
    { id: 'heel_left', label: 'Left Heel', pairedWith: 'heel_right', bounds: { x: 0.1, y: 0.65, w: 0.3, h: 0.25 } },
    { id: 'heel_right', label: 'Right Heel', pairedWith: 'heel_left', bounds: { x: 0.6, y: 0.65, w: 0.3, h: 0.25 } },
    { id: 'arch_left', label: 'Left Arch', pairedWith: 'arch_right', bounds: { x: 0.1, y: 0.35, w: 0.3, h: 0.3 } },
    { id: 'arch_right', label: 'Right Arch', pairedWith: 'arch_left', bounds: { x: 0.6, y: 0.35, w: 0.3, h: 0.3 } },
    { id: 'ball_left', label: 'Left Ball of Foot', pairedWith: 'ball_right', bounds: { x: 0.05, y: 0.15, w: 0.4, h: 0.2 } },
    { id: 'ball_right', label: 'Right Ball of Foot', pairedWith: 'ball_left', bounds: { x: 0.55, y: 0.15, w: 0.4, h: 0.2 } },
  ],
}

// Get all paired regions for asymmetry detection across views
export function getAsymmetryPairs(viewType: ViewType): Array<{ left: BodyRegion; right: BodyRegion }> {
  const regions = BODY_REGIONS[viewType]
  const pairs: Array<{ left: BodyRegion; right: BodyRegion }> = []
  const visited = new Set<string>()

  for (const region of regions) {
    if (region.pairedWith && !visited.has(region.id)) {
      const paired = regions.find(r => r.id === region.pairedWith)
      if (paired) {
        // Convention: region with "left" in ID goes first
        if (region.id.includes('left')) {
          pairs.push({ left: region, right: paired })
        } else {
          pairs.push({ left: paired, right: region })
        }
        visited.add(region.id)
        visited.add(paired.id)
      }
    }
  }

  return pairs
}

// Cross-view asymmetry pairs (lateral_left vs lateral_right)
export function getCrossViewPairs(): Array<{ leftView: ViewType; rightView: ViewType; regionSuffix: string; label: string }> {
  return [
    { leftView: 'lateral_left', rightView: 'lateral_right', regionSuffix: 'shoulder_lateral', label: 'Shoulder' },
    { leftView: 'lateral_left', rightView: 'lateral_right', regionSuffix: 'torso_lateral', label: 'Torso' },
    { leftView: 'lateral_left', rightView: 'lateral_right', regionSuffix: 'hip', label: 'Hip' },
    { leftView: 'lateral_left', rightView: 'lateral_right', regionSuffix: 'knee_lateral', label: 'Knee' },
  ]
}
