import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import countries from 'i18n-iso-countries';

const require = createRequire(import.meta.url);
const topology = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8')) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const collection = feature(topology, topology.objects.countries);
const visible = { ...collection, features: collection.features.filter(f => String(f.id) !== '010') };
const projection = geoEqualEarth().fitExtent([[8, 8], [952, 472]], visible);
const path = geoPath(projection).digits(2);
const shapes = visible.features.map((country, index) => ({
  id: String(country.id ?? `region-${index}`),
  code: countries.numericToAlpha2(String(country.id).padStart(3, '0')) || null,
  name: country.properties?.name || 'Region',
  path: path(country) || '',
  bounds: path.bounds(country).flat().map(n => Math.round(n * 100) / 100),
}));
writeFileSync('src/data/world-map.json', JSON.stringify({ width: 960, height: 480, source: 'world-atlas 2 / Natural Earth 1:110m', shapes }) + '\n');
console.log(`Generated ${shapes.length} world map shapes.`);

// Orthographic profile globe: retain geographic coordinates, not a distorted flat map.
const globe = visible.features.map(country => ({
  code: countries.numericToAlpha2(String(country.id).padStart(3, '0')) || null,
  geometry: JSON.parse(JSON.stringify(country.geometry, (_key, value) => typeof value === 'number' ? Math.round(value * 100) / 100 : value)),
}));
writeFileSync('src/data/world-globe.json', JSON.stringify({ source: 'world-atlas 2 / Natural Earth 1:110m', countries: globe }) + '\n');
console.log(`Generated ${globe.length} globe geometries.`);
