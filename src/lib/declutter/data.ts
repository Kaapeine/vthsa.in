import type { Place, BBox } from './types';

export function cullToBBox(places: Place[], bbox: BBox): Place[] {
  const out: Place[] = [];
  for (const p of places) {
    if (
      p.lng >= bbox.minLng &&
      p.lng <= bbox.maxLng &&
      p.lat >= bbox.minLat &&
      p.lat <= bbox.maxLat
    ) {
      out.push(p);
    }
  }
  return out;
}

export async function loadPlaces(url: string): Promise<Place[]> {
  const { deserialize } = await import('flatgeobuf/lib/mjs/geojson.js');
  const resp = await fetch(url);
  if (!resp.ok || !resp.body) {
    throw new Error(`Failed to load dataset: ${resp.status}`);
  }
  const places: Place[] = [];
  let i = 0;
  for await (const f of deserialize(resp.body as ReadableStream)) {
    const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    places.push({
      id: typeof props.id === 'number' ? props.id : i,
      lng: coords[0],
      lat: coords[1],
      name: typeof props.name === 'string' ? props.name : 'Unknown',
      category: typeof props.category === 'string' ? props.category : 'other',
    });
    i++;
  }
  return places;
}
