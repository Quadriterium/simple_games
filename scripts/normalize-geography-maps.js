const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const rawDir = path.join(rootDir, 'geographie', 'assets', 'raw');
const outDir = path.join(rootDir, 'geographie', 'assets', 'optimized');

function getMetropolitanCodes() {
    const out = [];
    for (let i = 1; i <= 95; i += 1) {
        if (i === 20) continue;
        out.push(String(i).padStart(2, '0'));
    }
    out.push('2A', '2B');
    return out;
}

function collectCoords(geometry, sink) {
    if (!geometry) return;
    const { type, coordinates } = geometry;
    if (type === 'Polygon') {
        coordinates.forEach(ring => ring.forEach(([lon, lat]) => sink.push([lon, lat])));
        return;
    }
    if (type === 'MultiPolygon') {
        coordinates.forEach(poly => poly.forEach(ring => ring.forEach(([lon, lat]) => sink.push([lon, lat]))));
    }
}

function ringToPath(ring, project) {
    if (!ring || !ring.length) return '';
    const [firstX, firstY] = project(ring[0]);
    let d = `M ${firstX.toFixed(2)} ${firstY.toFixed(2)}`;
    for (let i = 1; i < ring.length; i += 1) {
        const [x, y] = project(ring[i]);
        d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    d += ' Z';
    return d;
}

function normalizeFrance() {
    const geoPath = path.join(rawDir, 'departements.geojson');
    const outPath = path.join(outDir, 'france-departements.svg');
    const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
    const wanted = new Set(getMetropolitanCodes());

    const features = (geo.features || []).filter(f => wanted.has(String(f.properties?.code || '').toUpperCase()));

    const points = [];
    features.forEach(f => collectCoords(f.geometry, points));

    const lons = points.map(p => p[0]);
    const lats = points.map(p => p[1]);
    const meanLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    const lonScale = Math.cos((meanLat * Math.PI) / 180);
    const scaledLons = lons.map(lon => lon * lonScale);
    const minLon = Math.min(...scaledLons);
    const maxLon = Math.max(...scaledLons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    const width = 980;
    const height = 1060;
    const padding = 30;
    const sx = (width - padding * 2) / (maxLon - minLon);
    const sy = (height - padding * 2) / (maxLat - minLat);
    const scale = Math.min(sx, sy);

    const project = ([lon, lat]) => {
        const x = ((lon * lonScale) - minLon) * scale + padding;
        const y = (maxLat - lat) * scale + padding;
        return [x, y];
    };

    const paths = [];
    features.forEach(feature => {
        const code = String(feature.properties.code).toLowerCase();
        const geometry = feature.geometry;
        if (!geometry) return;

        if (geometry.type === 'Polygon') {
            const d = geometry.coordinates.map(r => ringToPath(r, project)).join(' ');
            paths.push(`<path id="dept-${code}" class="department" d="${d}" />`);
            return;
        }

        if (geometry.type === 'MultiPolygon') {
            const d = geometry.coordinates
                .map(poly => poly.map(r => ringToPath(r, project)).join(' '))
                .join(' ');
            paths.push(`<path id="dept-${code}" class="department" d="${d}" />`);
        }
    });

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n`
        + `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n`
        + `  <rect width="${width}" height="${height}" fill="#edf2f7"/>\n`
        + `  <g fill="#9ec5c6" stroke="#ffffff" stroke-width="1.6">\n`
        + `    ${paths.join('\n    ')}\n`
        + `  </g>\n`
        + `</svg>\n`;

    fs.writeFileSync(outPath, svg, 'utf8');
}

function normalizeWorld() {
    const rawPath = path.join(rawDir, 'world-continents.svg');
    const outPath = path.join(outDir, 'world-continents.svg');
    const svg = fs.readFileSync(rawPath, 'utf8');
    fs.writeFileSync(outPath, svg, 'utf8');
}

normalizeFrance();
normalizeWorld();
console.log('Cartes normalisees.');
