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
}

export const DEFAULT_CONFIG: SimConfig = {
  minRadius: 5,
  maxRadius: 19,
  neighborRadius: 48,
  anchorStiffness: 0.1,
  damping: 0.8,
  relaxationPasses: 4,
  leaderHideThreshold: 4,
  stabilityThreshold: 0.15,
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
