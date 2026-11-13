/* =============================================================================
 * data.js — Lớp dữ liệu (ưu tiên API thật, miễn phí)
 *  - Ranh giới & tên quốc gia: Natural Earth 1:50m (GeoJSON, có NAME_VI)
 *  - Thời tiết hiện tại + dự báo 7 ngày: Open-Meteo (không cần API key)
 *  - Khí hậu 12 tháng: NASA POWER climatology (MERRA-2)
 *  - Độ cao: Open-Meteo Elevation API, lấy mẫu 9 điểm trong bbox quốc gia
 *  - Thủ đô: Natural Earth populated places (bundled trong js/capitals.js)
 *  - Lớp mở rộng: NASA POWER 1981–2010 vs 1991–2020, USGS + NASA EONET,
 *    World Bank (rừng, mật độ dân số), làm mới thời tiết mỗi giờ
 *  - Dự phòng: js/fallback.js cho 8 quốc gia phổ biến
 * Mọi lời gọi đều có timeout và trạng thái lỗi rõ ràng cho UI.
 * ========================================================================== */

import { fetchJson, clamp, mean, sum } from './i18n.js';
import { CAPITALS } from './capitals.js';
import { FALLBACK_PROFILES } from './fallback.js';
import { estimateTerrain, classifyKoppen } from './model.js';

export const ENDPOINTS = {
  countries: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_admin_0_countries.geojson',
  forecast: 'https://api.open-meteo.com/v1/forecast',
  elevation: 'https://api.open-meteo.com/v1/elevation',
  power: 'https://power.larc.nasa.gov/api/temporal/climatology/point'
};

const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/* Đỉnh cao nhất — bảng tham chiếu tĩnh (mét). Dùng để hiệu chỉnh mẫu DEM. */
export const PEAKS = {
  VN: ['Fansipan', 3143], NP: ['Everest', 8849], CN: ['Everest', 8849], US: ['Denali', 6190],
  JP: ['Fuji', 3776], FR: ['Mont Blanc', 4808], IT: ['Monte Bianco', 4808], CH: ['Dufourspitze', 4634],
  AT: ['Grossglockner', 3798], DE: ['Zugspitze', 2962], ES: ['Teide', 3715], GB: ['Ben Nevis', 1345],
  BR: ['Pico da Neblina', 2995], AR: ['Aconcagua', 6961], CL: ['Ojos del Salado', 6893], PE: ['Huascarán', 6768],
  CO: ['Pico Cristóbal Colón', 5700], EC: ['Chimborazo', 6263], BO: ['Nevado Sajama', 6542], VE: ['Pico Bolívar', 4978],
  MX: ['Pico de Orizaba', 5636], CA: ['Mount Logan', 5959], AU: ['Mount Kosciuszko', 2228], NZ: ['Aoraki', 3724],
  ID: ['Puncak Jaya', 4884], MY: ['Kinabalu', 4095], PH: ['Apo', 2954], TH: ['Doi Inthanon', 2565],
  MM: ['Hkakabo Razi', 5881], IN: ['Kangchenjunga', 8586], PK: ['K2', 8611], IR: ['Damavand', 5610],
  TR: ['Ararat', 5137], RU: ['Elbrus', 5642], GR: ['Mount Olympus', 2917], NO: ['Galdhøpiggen', 2469],
  SE: ['Kebnekaise', 2097], FI: ['Halti', 1324], IS: ['Hvannadalshnúkur', 2110], EG: ['Mount Catherine', 2629],
  MA: ['Jebel Toubkal', 4167], DZ: ['Mount Tahat', 3003], KE: ['Mount Kenya', 5199], TZ: ['Kilimanjaro', 5895],
  ZA: ['Mafadi', 3450], CD: ['Margherita Peak', 5109], UG: ['Margherita Peak', 5109], ET: ['Ras Dashen', 4550],
  SA: ['Jabal Sawda', 3000], AE: ['Jebel Jais', 1934], IL: ['Meron', 1208], KZ: ['Khan Tengri', 7010],
  KG: ['Jengish Chokusu', 7439], TJ: ['Ismoil Somoni Peak', 7495], MN: ['Küiten Peak', 4374], KR: ['Hallasan', 1947],
  TW: ['Yushan', 3952], AQ: ['Vinson Massif', 4892], LK: ['Pidurutalagala', 2524],
  PT: ['Pico', 2351], NL: ['Vaalserberg', 322], BE: ['Signal de Botrange', 694], DK: ['Møllehøj', 171],
  PL: ['Rysy', 2499], CZ: ['Sněžka', 1603], HU: ['Kékes', 1014], RO: ['Moldoveanu', 2544], UA: ['Hoverla', 2061],
  NG: ['Chappal Waddi', 2419], GH: ['Mount Afadja', 885], CM: ['Mount Cameroon', 4040], MG: ['Maromokotro', 2876],
  CU: ['Pico Turquino', 1974], GT: ['Volcán Tajumulco', 4220], CR: ['Cerro Chirripó', 3820], PA: ['Volcán Barú', 3475],
  AF: ['Noshaq', 7492], IQ: ['Cheekha Dar', 3611], OM: ['Jebel Shams', 3009], YE: ['Jabal An-Nabi Shu-ayb', 3666],
  BT: ['Gangkhar Puensum', 7570], LA: ['Phou Bia', 2819], KH: ['Phnom Aural', 1813], BD: ['Keokradong', 1230]
};

const cache = new Map();
const capitals = Object.fromEntries(Object.entries(CAPITALS).map(([k, v]) => [k, String(v).replace(/\s+/g, ' ').trim()]));

/* ----------------------------- Helpers ---------------------------------- */
export function countryCode(feature) {
  const p = feature?.properties || {};
  for (const key of ['ISO_A2', 'ISO_A2_EH', 'ADM0_ISO']) {
    const v = String(p[key] || '').toUpperCase();
    if (/^[A-Z]{2}$/.test(v) && v !== '99') return v;
  }
  const a3 = String(p.ISO_A3 || p.ADM0_A3 || '').toUpperCase();
  return /^[A-Z]{3}$/.test(a3) ? a3 : String(p.ADMIN || 'XX').slice(0, 2).toUpperCase();
}

export function bboxOf(geometry) {
  let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
  const walk = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) coords.forEach(walk);
  };
  if (geometry) walk(geometry.coordinates);
  const bbox = { minLng, minLat, maxLng, maxLat };
  bbox.center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  return bbox;
}

function samplePoints(bbox, count = 9) {
  const latSpan = Math.max(0.2, bbox.maxLat - bbox.minLat);
  const lngSpan = Math.max(0.2, bbox.maxLng - bbox.minLng);
  const inset = 0.2;
  const pt = (fx, fy) => ({
    lat: clamp(bbox.minLat + latSpan * (inset + (1 - 2 * inset) * fy), -85, 85),
    lng: bbox.minLng + lngSpan * (inset + (1 - 2 * inset) * fx)
  });
  const base = [pt(0.5, 0.5), pt(0.15, 0.15), pt(0.85, 0.15), pt(0.15, 0.85), pt(0.85, 0.85), pt(0.5, 0.1), pt(0.5, 0.9), pt(0.1, 0.5), pt(0.9, 0.5)];
  const extra = [];
  for (let i = 0; i < count - base.length; i += 1) {
    extra.push({ lat: bbox.minLat + Math.random() * latSpan, lng: bbox.minLng + Math.random() * lngSpan });
  }
  return base.concat(extra).slice(0, count);
}

/** Tải danh sách quốc gia/lãnh thổ 1:50m. */
export async function loadCountries() {
  const geo = await fetchJson(ENDPOINTS.countries, { timeout: 30000 });
  const features = (geo.features || []).filter((f) => f.geometry && f.properties && f.properties.NAME);
  features.forEach((f) => {
    const p = f.properties;
    f.__code = countryCode(f);
    f.__name = {
      vi: p.NAME_VI || p.NAME || p.ADMIN,
      en: p.NAME_EN || p.NAME || p.ADMIN
    };
    f.__bbox = bboxOf(f.geometry);
    f.__label = { lat: Number(p.LABEL_Y) || f.__bbox.center.lat, lng: Number(p.LABEL_X) || f.__bbox.center.lng };
  });
  return features;
}

/* ------------------------------ Weather --------------------------------- */
export async function fetchWeather(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7'
  });
  const raw = await fetchJson(`${ENDPOINTS.forecast}?${params}`, { timeout: 12000 });
  const c = raw.current || {};
  const d = raw.daily || {};
  const daily = (d.time || []).map((date, i) => ({
    date,
    code: d.weather_code?.[i],
    tmax: d.temperature_2m_max?.[i],
    tmin: d.temperature_2m_min?.[i],
    precip: d.precipitation_sum?.[i] ?? 0,
    uv: d.uv_index_max?.[i] ?? null
  }));
  return {
    temp: c.temperature_2m,
    feels: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    precip: c.precipitation ?? 0,
    code: c.weather_code,
    cloud: c.cloud_cover ?? 0,
    wind: c.wind_speed_10m ?? 0,
    windDir: c.wind_direction_10m ?? 0,
    isDay: c.is_day === 1,
    uv: d.uv_index_max?.[0] ?? null,
    sunrise: d.sunrise?.[0] || null,
    sunset: d.sunset?.[0] || null,
    daily,
    timezone: raw.timezone || 'UTC',
    utcOffset: raw.utc_offset_seconds || 0,
    fetchedAt: Date.now()
  };
}

/* --------------------------- NASA POWER climate ------------------------- */
export async function fetchClimate(lat, lng) {
  const url = `${ENDPOINTS.power}?parameters=T2M,PRECTOTCORR&community=RE&longitude=${lng.toFixed(3)}&latitude=${lat.toFixed(3)}&format=JSON`;
  const raw = await fetchJson(url, { timeout: 20000 });
  const T = raw?.properties?.parameter?.T2M;
  const P = raw?.properties?.parameter?.PRECTOTCORR;
  if (!T || !P) throw new Error('NASA POWER: missing parameters');
  const temps = MONTH_KEYS.map((k) => (T[k] === -999 ? null : T[k]));
  const precips = MONTH_KEYS.map((k, i) => (P[k] === -999 ? null : P[k] * DAYS_IN_MONTH[i]));
  if (temps.some((v) => v === null) || precips.some((v) => v === null)) throw new Error('NASA POWER: fill values');
  const annualT = T.ANN ?? mean(temps);
  const annualP = precips.reduce((a, b) => a + b, 0);
  return {
    temps,
    precips,
    annualT,
    annualP,
    koppen: classifyKoppen(temps, precips, lat),
    source: 'NASA POWER (MERRA-2)',
    fetchedAt: Date.now()
  };
}

/* ------------------------------- Elevation ------------------------------ */
export async function fetchElevation(bbox, code) {
  const pts = samplePoints(bbox);
  const lats = pts.map((p) => p.lat.toFixed(3)).join(',');
  const lngs = pts.map((p) => p.lng.toFixed(3)).join(',');
  let samples = [];
  try {
    const raw = await fetchJson(`${ENDPOINTS.elevation}?latitude=${lats}&longitude=${lngs}`, { timeout: 12000 });
    samples = (raw.elevation || []).map(Number).filter((v) => Number.isFinite(v));
    samples = samples.map((v) => Math.max(0, v));
  } catch (err) {
    samples = [];
  }
  const peak = PEAKS[code];
  let max = samples.length ? Math.max(...samples) : (peak ? Math.round(peak[1] * 0.55) : 0);
  if (peak) max = Math.max(max, peak[1]);
  const min = samples.length ? Math.min(...samples) : 0;
  const avg = samples.length ? mean(samples) : (max ? max * 0.28 : 0);
  return {
    samples: samples.map((v) => Math.round(v)),
    avg: Math.round(avg),
    max: Math.round(max),
    min: Math.round(min),
    peakName: peak ? peak[0] : null,
    peakElev: peak ? peak[1] : null,
    sampled: samples.length,
    source: 'Open-Meteo Elevation (lấy mẫu DEM)'
  };
}

/* ----------------------------- Profile ---------------------------------- */
function baseMeta(feature) {
  const p = feature.properties;
  const code = countryCode(feature);
  const bbox = feature.__bbox || bboxOf(feature.geometry);
  return {
    code,
    name: { vi: p.NAME_VI || p.NAME, en: p.NAME_EN || p.NAME },
    capital: capitals[code] || null,
    continent: p.CONTINENT || '',
    population: Number(p.POP_EST) || null,
    label: { lat: feature.__label?.lat ?? bbox.center.lat, lng: feature.__label?.lng ?? bbox.center.lng },
    bbox,
    landlocked: false
  };
}

function fallbackFor(meta) {
  const f = FALLBACK_PROFILES[meta.code];
  if (!f) return null;
  return {
    ...meta,
    ...f,
    name: meta.name,
    offline: true,
    sources: ['Dữ liệu dự phòng đóng gói sẵn (không gọi được API)']
  };
}

/**
 * Lấy hồ sơ đầy đủ cho một quốc gia.
 * Weather/climate/elevation chạy song song; lỗi từng phần không chặn phần còn lại.
 */
export async function getCountryProfile(feature, point) {
  const meta = baseMeta(feature);
  const key = meta.code;
  if (cache.has(key)) {
    const hit = cache.get(key);
    const pointLat = point?.lat ?? meta.label.lat;
    const pointLng = point?.lng ?? meta.label.lng;
    return { ...hit, point: { lat: pointLat, lng: pointLng } };
  }

  const lat = meta.label.lat;
  const lng = meta.label.lng;
  const errors = [];
  const [weatherRes, climateRes, elevationRes] = await Promise.allSettled([
    fetchWeather(lat, lng),
    fetchClimate(lat, lng),
    fetchElevation(meta.bbox, meta.code)
  ]);
  if (weatherRes.status === 'rejected') errors.push('weather');
  if (climateRes.status === 'rejected') errors.push('climate');
  if (elevationRes.status === 'rejected') errors.push('elevation');

  const weather = weatherRes.status === 'fulfilled' ? weatherRes.value : null;
  const climate = climateRes.status === 'fulfilled' ? climateRes.value : null;
  const elevation = elevationRes.status === 'fulfilled' ? elevationRes.value : null;

  if (!weather && !climate) {
    const fb = fallbackFor(meta);
    if (fb) {
      cache.set(key, fb);
      return { ...fb, point: { lat: point?.lat ?? lat, lng: point?.lng ?? lng } };
    }
  }

  const climateOrFallback = climate || (FALLBACK_PROFILES[meta.code]?.climate ?? {
    temps: Array(12).fill(20), precips: Array(12).fill(80), annualT: 20, annualP: 960, koppen: null, source: 'không có dữ liệu'
  });
  const elevationOrFallback = elevation || { avg: 300, max: 1200, min: 0, samples: [], peakName: PEAKS[meta.code]?.[0] || null, source: 'không có dữ liệu' };
  const terrain = estimateTerrain({ elevation: elevationOrFallback, climate: climateOrFallback });

  const record = {
    ...meta,
    weather,
    climate: climateOrFallback,
    elevation: elevationOrFallback,
    terrain,
    offline: !weather && !climate,
    partial: errors,
    errors,
    sources: [
      'Natural Earth 1:50m — ranh giới, tên quốc gia (naturalearthdata.com)',
      'Open-Meteo — thời tiết hiện tại & dự báo 7 ngày (open-meteo.com)',
      'Open-Meteo Elevation — độ cao lấy mẫu từ DEM (open-meteo.com)',
      'NASA POWER / MERRA-2 — khí hậu 12 tháng (power.larc.nasa.gov)',
      'Natural Earth populated places — thủ đô',
      'Ảnh: NASA Blue Marble & Black Marble; địa hình: NASA/ETOPO (qua three-globe)'
    ],
    fetchedAt: Date.now()
  };
  cache.set(key, record);
  return { ...record, point: { lat: point?.lat ?? lat, lng: point?.lng ?? lng } };
}

/** Xoá cache để buộc tải lại (nút Thử lại). */
export function clearProfileCache(code) {
  if (code) cache.delete(code); else cache.clear();
}

/* --------------------------- Extended layers ---------------------------- */
const layerCache = new Map();

async function powerClimatology(lat, lng, start, end) {
  const url = `${ENDPOINTS.power}?parameters=T2M,PRECTOTCORR&community=RE&longitude=${lng}&latitude=${lat}&format=JSON&start=${start}&end=${end}`;
  const raw = await fetchJson(url, { timeout: 15000 });
  const p = raw?.properties?.parameter;
  if (!p?.T2M || !p?.PRECTOTCORR) throw new Error('POWER thiếu dữ liệu khí hậu');
  return { t: Number(p.T2M.ANN), pDay: Number(p.PRECTOTCORR.ANN) };
}

/** So sánh khí hậu 1981–2010 với 1991–2020 (NASA POWER). */
export async function fetchClimateDelta(record) {
  const { lat, lng } = record.point || record.label || {};
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) throw new Error('Thiếu toạ độ');
  const key = `delta:${record.code}`;
  if (layerCache.has(key)) return layerCache.get(key);
  const [past, recent] = await Promise.all([
    powerClimatology(lat, lng, 1981, 2010),
    powerClimatology(lat, lng, 1991, 2020)
  ]);
  const out = {
    pastT: past.t,
    recentT: recent.t,
    dT: recent.t - past.t,
    pastP: past.pDay * 365,
    recentP: recent.pDay * 365,
    dP: (recent.pDay - past.pDay) * 365,
    dPPct: past.pDay ? ((recent.pDay - past.pDay) / past.pDay) * 100 : 0,
    source: 'NASA POWER — 1981–2010 so với 1991–2020'
  };
  layerCache.set(key, out);
  return out;
}

/** Động đất USGS (bán kính 1.000 km, 12 tháng) + sự kiện NASA EONET. */
export async function fetchHazards(record, days = 365) {
  const { lat, lng } = record.point || record.label || {};
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) throw new Error('Thiếu toạ độ');
  const span = Math.max(7, Math.min(365, Number(days) || 365));
  const key = `hazards:${record.code}:${span}`;
  if (layerCache.has(key)) return layerCache.get(key);
  const start = new Date(Date.now() - span * 86400000).toISOString().slice(0, 10);
  const quakeUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lng}&maxradiuskm=1000&minmagnitude=4.5&limit=40&orderby=time&starttime=${start}`;
  const [quakeRes, eonetRes] = await Promise.allSettled([
    fetchJson(quakeUrl, { timeout: 12000 }),
    fetchJson(`https://eonet.gsfc.nasa.gov/api/v3/events?bbox=${Math.max(-180, lng - 8)},${Math.max(-85, lat - 8)},${Math.min(180, lng + 8)},${Math.min(85, lat + 8)}&days=${span}&status=open`, { timeout: 10000 })
  ]);
  const quakes = quakeRes.status === 'fulfilled'
    ? (quakeRes.value.features || []).map((f) => ({
      mag: Number(f.properties?.mag) || 0,
      place: f.properties?.place || '',
      time: Number(f.properties?.time) || 0
    })).filter((q) => q.mag >= 4.5)
    : [];
  const events = eonetRes.status === 'fulfilled'
    ? (eonetRes.value.events || []).map((e) => ({
      title: e.title || '',
      category: e.categories?.[0]?.title || ''
    }))
    : [];
  const out = { quakes, events, days: span, source: 'USGS Earthquake API · NASA EONET' };
  layerCache.set(key, out);
  return out;
}

function latestWorldBank(rows) {
  if (!Array.isArray(rows)) return null;
  const hit = rows.find((r) => r && r.value != null);
  return hit ? { value: Number(hit.value), year: hit.date } : null;
}

/** Sinh quyển: độ che phủ rừng và mật độ dân số (World Bank). */
export async function fetchBiosphere(record) {
  const code = String(record.code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('Không có mã quốc gia');
  const key = `bio:${code}`;
  if (layerCache.has(key)) return layerCache.get(key);
  const base = 'https://api.worldbank.org/v2/country';
  const [forestRes, densityRes] = await Promise.allSettled([
    fetchJson(`${base}/${code}/indicator/AG.LND.FRST.ZS?format=json&per_page=20&date=2010:2024`, { timeout: 12000 }),
    fetchJson(`${base}/${code}/indicator/EN.POP.DNST?format=json&per_page=20&date=2015:2024`, { timeout: 12000 })
  ]);
  const forest = forestRes.status === 'fulfilled' ? latestWorldBank(forestRes.value?.[1]) : null;
  const density = densityRes.status === 'fulfilled' ? latestWorldBank(densityRes.value?.[1]) : null;
  if (!forest && !density) throw new Error('World Bank chưa có dữ liệu cho quốc gia này');
  const out = {
    forestPct: forest ? forest.value : null,
    forestYear: forest ? forest.year : null,
    density: density ? density.value : null,
    densityYear: density ? density.year : null,
    source: 'World Bank — forest area % · population density'
  };
  layerCache.set(key, out);
  return out;
}

/** Làm mới thời tiết hiện tại cho lớp phủ (không dùng cache hồ sơ). */
export async function fetchWeatherNow(record) {
  const { lat, lng } = record.point || record.label || {};
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) throw new Error('Thiếu toạ độ');
  return fetchWeather(lat, lng);
}

/** Gợi ý tìm kiếm: không dấu, theo tên VI/EN/mã ISO. */
export function searchCountries(countries, query, foldFn, limit = 8) {
  const q = foldFn(query);
  if (!q) return [];
  const scored = [];
  for (const f of countries) {
    const vi = f.__name.vi;
    const en = f.__name.en;
    const code = f.__code;
    const viF = foldFn(vi);
    const enF = foldFn(en);
    let score = -1;
    if (viF === q || enF === q || code.toLowerCase() === q) score = 100;
    else if (viF.startsWith(q) || enF.startsWith(q)) score = 80;
    else if (viF.includes(q) || enF.includes(q)) score = 55;
    else if (code.toLowerCase().startsWith(q)) score = 40;
    if (score > 0) scored.push({ f, score, name: vi });
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'vi'));
  return scored.slice(0, limit).map((s) => s.f);
}

export { clamp, sum };
