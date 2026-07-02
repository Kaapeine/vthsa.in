export interface SimPin {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  radius: number;
  overlap: number;
}

export interface Anchor {
  id: number;
  x: number;
  y: number;
}

export interface SimConfig {
  minRadius: number;
  maxRadius: number;
  neighborRadius: number;
  anchorStiffness: number;
  damping: number;
  relaxationPasses: number;
  leaderHideThreshold: number;
  stabilityThreshold: number;
  /** Above this many pins in view, decluttering is infeasible on one screen —
   * skip the physics and render pins at their anchor positions. */
  simMaxPins: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  minRadius: 8,
  maxRadius: 10,
  neighborRadius: 48,
  anchorStiffness: 0.06,
  damping: 0.65,
  relaxationPasses: 30,
  leaderHideThreshold: 2,
  stabilityThreshold: 0.15,
  simMaxPins: 1500,
};

export interface Place {
  id: number;
  lng: number;
  lat: number;
  name: string;
  category: string;
}

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface RenderSource {
  pinVerts: Float32Array;
  pinVertCount: number;
  lineVerts: Float32Array;
  lineVertCount: number;
}
