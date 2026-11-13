/* =============================================================================
 * model.js — Lớp mô hình khoa học
 *  - Giải mã mã thời tiết WMO → nhãn + icon
 *  - Phân loại khí hậu Köppen–Geiger từ nhiệt độ & lượng mưa 12 tháng
 *  - Ước lượng phân bố địa hình (núi / cao nguyên / đồi / đồng bằng / sa mạc)
 *  - Ánh xạ dữ liệu → tham số âm thanh (sonification)
 *  - Sinh lời thuyết minh tiếng Việt / tiếng Anh
 * Ghi chú: phân bố địa hình là mô hình ước lượng từ DEM mẫu + khí hậu,
 * không phải số liệu đo đạc chính thức. Köppen tính từ NASA POWER.
 * ========================================================================== */

import { clamp, mean, sum, round } from './i18n.js';

/* ------------------------------ WMO weather ------------------------------ */
const WMO = {
  0:  { vi: 'Trời quang', en: 'Clear sky', icon: 'clear' },
  1:  { vi: 'Phần lớn quang', en: 'Mainly clear', icon: 'mostly-clear' },
  2:  { vi: 'Có mây rải rác', en: 'Partly cloudy', icon: 'partly' },
  3:  { vi: 'Nhiều mây, âm u', en: 'Overcast', icon: 'cloud' },
  45: { vi: 'Sương mù', en: 'Fog', icon: 'fog' },
  48: { vi: 'Sương mù đóng băng', en: 'Rime fog', icon: 'fog' },
  51: { vi: 'Mưa phùn nhẹ', en: 'Light drizzle', icon: 'drizzle' },
  53: { vi: 'Mưa phùn', en: 'Drizzle', icon: 'drizzle' },
  55: { vi: 'Mưa phùn dày', en: 'Dense drizzle', icon: 'rain' },
  56: { vi: 'Mưa phùn lạnh', en: 'Freezing drizzle', icon: 'rain' },
  57: { vi: 'Mưa phùn lạnh dày', en: 'Dense freezing drizzle', icon: 'rain' },
  61: { vi: 'Mưa nhẹ', en: 'Slight rain', icon: 'rain' },
  63: { vi: 'Mưa vừa', en: 'Moderate rain', icon: 'rain' },
  65: { vi: 'Mưa to', en: 'Heavy rain', icon: 'rain' },
  66: { vi: 'Mưa đóng băng', en: 'Freezing rain', icon: 'rain' },
  67: { vi: 'Mưa đóng băng mạnh', en: 'Heavy freezing rain', icon: 'rain' },
  71: { vi: 'Tuyết rơi nhẹ', en: 'Slight snow', icon: 'snow' },
  73: { vi: 'Tuyết rơi', en: 'Snow', icon: 'snow' },
  75: { vi: 'Tuyết rơi dày', en: 'Heavy snow', icon: 'snow' },
  77: { vi: 'Hạt tuyết', en: 'Snow grains', icon: 'snow' },
  80: { vi: 'Mưa rào nhẹ', en: 'Slight showers', icon: 'rain' },
  81: { vi: 'Mưa rào', en: 'Showers', icon: 'rain' },
  82: { vi: 'Mưa rào lớn', en: 'Violent showers', icon: 'rain' },
  85: { vi: 'Mưa tuyết nhẹ', en: 'Slight snow showers', icon: 'snow' },
  86: { vi: 'Mưa tuyết lớn', en: 'Heavy snow showers', icon: 'snow' },
  95: { vi: 'Giông bão', en: 'Thunderstorm', icon: 'storm' },
  96: { vi: 'Giông kèm mưa đá', en: 'Thunderstorm with hail', icon: 'storm' },
  99: { vi: 'Giông mạnh kèm mưa đá', en: 'Severe storm with hail', icon: 'storm' }
};

export function weatherInfo(code, lang = 'vi') {
  const base = WMO[code] || { vi: 'Không xác định', en: 'Unknown', icon: 'cloud' };
  return { label: base[lang] || base.vi, icon: base.icon };
}

/* ------------------------------- Köppen -------------------------------- */
/**
 * Phân loại Köppen–Geiger rút gọn từ nhiệt độ trung bình tháng (°C)
 * và lượng mưa tháng (mm). Đủ chi tiết cho phần thuyết minh/app.
 * Nguồn quy tắc: Peel et al. 2007 (bản rút gọn).
 */
export function classifyKoppen(temps, precs, lat) {
  if (!Array.isArray(temps) || temps.length !== 12 || !Array.isArray(precs) || precs.length !== 12) return null;
  const T = temps.map(Number);
  const P = precs.map(Number);
  const Pann = sum(P);
  const Tann = mean(T);
  const Tmin = Math.min(...T);
  const Tmax = Math.max(...T);
  const pMin = Math.min(...P);
  const north = lat === null || lat === undefined ? true : lat >= 0;
  // Mùa hè: tháng 4–9 ở bắc bán cầu, 10–3 ở nam bán cầu.
  const summerIdx = north ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
  const winterIdx = north ? [9, 10, 11, 0, 1, 2] : [3, 4, 5, 6, 7, 8];
  const pSummer = sum(summerIdx.map((i) => P[i]));
  const pWinter = sum(winterIdx.map((i) => P[i]));
  const pSummerMin = Math.min(...summerIdx.map((i) => P[i]));
  const pWinterMin = Math.min(...winterIdx.map((i) => P[i]));

  // Nhóm A — nhiệt đới
  if (Tmin >= 18) {
    if (pMin >= 60) return 'Af';
    if (Pann >= 1800 && pMin >= 40) return 'Am';
    if (Pann * 0.7 < pSummer) return 'As';
    return 'Aw';
  }
  // Nhóm E — cực đới
  if (Tmax < 10) return Tmax > 0 ? 'ET' : 'EF';

  const dryThreshold = 20 * Tann + 280;
  // Nhóm B — khô hạn
  if (Pann < dryThreshold && Pann < 900) {
    const hot = Tann >= 18;
    if (Pann < 2 * Tann + 140) return hot ? 'BWh' : 'BWk';
    return hot ? 'BSh' : 'BSk';
  }
  // Nhóm C — ôn hoà
  if (Tmin > -3) {
    if (pSummerMin < 40 && pSummer < pWinter * 0.5) return Tmax >= 22 ? 'Csa' : 'Csb';
    if (pWinterMin * 10 < pSummer) return Tmax >= 22 ? 'Cwa' : 'Cwb';
    if (Tmax >= 22) return 'Cfa';
    return Tmin > 10 ? 'Cfb' : 'Cfc';
  }
  // Nhóm D — lục địa
  if (pSummerMin < 40 && pSummer < pWinter * 0.4) return Tmax >= 22 ? 'Dsa' : 'Dsb';
  if (pWinterMin * 10 < pSummer) return Tmax >= 22 ? 'Dwa' : 'Dwb';
  if (Tmax >= 22) return 'Dfa';
  if (Tmax >= 10) return 'Dfb';
  return Tmin < -38 ? 'Dfd' : 'Dfc';
}

const KOPPEN_NAMES = {
  Af:  { vi: 'Rừng mưa nhiệt đới', en: 'Tropical rainforest' },
  Am:  { vi: 'Nhiệt đới gió mùa', en: 'Tropical monsoon' },
  Aw:  { vi: 'Nhiệt đới savan (mùa khô rõ)', en: 'Tropical savanna' },
  As:  { vi: 'Nhiệt đới khô mùa hè', en: 'Tropical dry-summer' },
  BWh: { vi: 'Hoang mạc nóng', en: 'Hot desert' },
  BWk: { vi: 'Hoang mạc lạnh', en: 'Cold desert' },
  BSh: { vi: 'Bán hoang mạc nóng', en: 'Hot semi-arid' },
  BSk: { vi: 'Bán hoang mạc lạnh', en: 'Cold semi-arid' },
  Csa: { vi: 'Cận nhiệt Địa Trung Hải', en: 'Hot-summer Mediterranean' },
  Csb: { vi: 'Ôn đới Địa Trung Hải', en: 'Warm-summer Mediterranean' },
  Cwa: { vi: 'Cận nhiệt gió mùa', en: 'Subtropical monsoon' },
  Cwb: { vi: 'Cao nguyên cận nhiệt', en: 'Subtropical highland' },
  Cfa: { vi: 'Cận nhiệt đới ẩm', en: 'Humid subtropical' },
  Cfb: { vi: 'Ôn đới hải dương', en: 'Oceanic temperate' },
  Cfc: { vi: 'Ôn đới ẩm quanh năm', en: 'Subpolar oceanic' },
  Dsa: { vi: 'Lục địa khô mùa hè', en: 'Mediterranean continental' },
  Dsb: { vi: 'Lục địa khô mùa hè mát', en: 'Warm-summer Mediterranean continental' },
  Dwa: { vi: 'Lục địa gió mùa', en: 'Continental monsoon' },
  Dwb: { vi: 'Lục địa mùa đông khô', en: 'Continental dry-winter' },
  Dfa: { vi: 'Lục địa ẩm, hè nóng', en: 'Hot-summer humid continental' },
  Dfb: { vi: 'Lục địa ẩm, hè ấm', en: 'Warm-summer humid continental' },
  Dfc: { vi: 'Cận cực lục địa', en: 'Subarctic continental' },
  Dfd: { vi: 'Cận cực lục địa khắc nghiệt', en: 'Extremely cold subarctic' },
  ET:  { vi: 'Đài nguyên (tundra)', en: 'Tundra' },
  EF:  { vi: 'Băng tuyết vĩnh cửu', en: 'Ice cap' }
};

export function koppenName(code, lang = 'vi') {
  if (!code) return '';
  const found = KOPPEN_NAMES[code];
  if (found) return found[lang] || found.vi;
  const first = { A: ['Nhiệt đới', 'Tropical'], B: ['Khô hạn', 'Arid'], C: ['Ôn hoà', 'Temperate'], D: ['Lục địa', 'Continental'], E: ['Cực đới', 'Polar'] };
  const base = first[code[0]] || ['Khí hậu', 'Climate'];
  return base[lang === 'en' ? 1 : 0];
}

/* --------------------------- Terrain estimate --------------------------- */
/**
 * Ước lượng tỉ lệ phân bố địa hình (0..1) từ độ cao mẫu + khí hậu.
 * Chỉ dùng cho trực quan & lớp âm thanh môi trường, không phải GIS chính thức.
 */
export function estimateTerrain({ elevation = {}, climate = {} } = {}) {
  const max = Number(elevation.max) || 600;
  const avg = Number(elevation.avg) || 200;
  const min = Number(elevation.min) || 0;
  const P = Number(climate.annualP) || 800;
  const T = Number(climate.annualT) || 15;
  const relief = Math.max(0, max - min);

  const mountain = clamp(0.05 + Math.pow(clamp(max / 3600, 0, 1), 1.5) * 0.45 + (avg > 1400 ? 0.08 : 0), 0.03, 0.68);
  const plateau = clamp(((avg - 350) / 2200) * 0.36 + (max > 2800 && avg > 1600 ? 0.12 : 0), 0, 0.34);
  const desert = clamp(((430 - P) / 1050) * (T > 12 ? 0.62 : 0.3), 0, 0.46);
  const water = clamp(0.03 + (P / 3600) * 0.13, 0.02, 0.2);
  const forest = clamp((P - 520) / 2100, 0, 0.85) * (T > 3 ? 1 : 0.4);
  let hill = clamp(0.15 + (relief / 6500) * 0.16 + (mountain > 0.35 ? 0.06 : 0), 0.07, 0.34);
  let plain = 1 - mountain - plateau - desert - water - hill;
  if (plain < 0.05) { hill = Math.max(0.02, hill + plain - 0.05); plain = 0.05; }
  const parts = { mountain, plateau, hill, plain, desert, water };
  const total = sum(Object.values(parts)) || 1;
  Object.keys(parts).forEach((k) => { parts[k] = parts[k] / total; });
  return { ...parts, forest, relief };
}

/* --------------------------- Audio parameters --------------------------- */
/** Các bộ thang âm cho phòng thử; 'auto' giữ lựa chọn gốc của từng track. */
export const SCALES = {
  auto: null,
  pentatonic: [0, 3, 5, 7, 10],
  major: [0, 2, 4, 7, 9],
  minor: [0, 2, 3, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9]
};

function instrumentOf(record, override) {
  return override && override !== 'auto' ? override : instrumentFor(record);
}

/** Chọn âm sắc theo hệ sinh thái/địa hình đặc trưng của quốc gia. */
export function instrumentFor(record) {
  const t = record?.terrain || {};
  const max = Number(record?.elevation?.max) || 0;
  const avg = Number(record?.elevation?.avg) || 0;
  if ((max >= 2800 && avg >= 800) || (t.mountain || 0) >= 0.5) return 'sao';
  if ((t.desert || 0) >= 0.3) return 'drum';
  if ((t.forest || 0) >= 0.35) return 'dan-tranh';
  if ((t.water || 0) >= 0.18) return 'dan-bau';
  return 'pluck';
}

/** Track A — biến địa hình thành một bản nhạc 60 giây. */
export function buildTerrainProfile(record, { scale = 'auto', instrument = 'auto', hazards = null, bio = null } = {}) {
  const el = record?.elevation || {};
  const terrain = record?.terrain || estimateTerrain(record || {});
  const avg = Number(el.avg) || 200;
  const max = Number(el.max) || 600;
  const min = Number(el.min) || 0;
  const relief = Math.max(0, max - min);
  const roughness = clamp(relief / 4200, 0, 1);

  // Cao độ gốc: đồng bằng trầm, núi cao vút.
  const rootMidi = Math.round(34 + clamp(avg / 500, 0, 18) + clamp(max / 9000, 0, 1) * 7);
  const notes = SCALES[scale] || [0, 3, 5, 7, 10]; // mặc định ngũ cung thứ
  const density = clamp(0.32 + roughness * 0.95 + terrain.mountain * 0.35, 0.3, 1.5);

  // Sinh quyển: rừng thực đo (nếu có) và mật độ dân số → lớp "đô thị"
  const forestPct = Number(bio?.forestPct);
  const forestGain = Number.isFinite(forestPct)
    ? clamp((forestPct / 100) * 1.15, 0, 0.6)
    : clamp(terrain.forest * 0.5, 0, 0.5);
  const popDensity = Number(bio?.density) || 0;
  const urban = clamp(Math.log10(1 + Math.max(0, popDensity)) / 3.2, 0, 1);

  // Thiên tai: rải các cú đập theo vòng 60 giây
  const hazardEvents = [];
  if (hazards) {
    const quakes = (hazards.quakes || []).slice(0, 12);
    quakes.forEach((q, i) => hazardEvents.push({
      t: 2.5 + (i / Math.max(1, quakes.length)) * 55,
      kind: 'quake',
      mag: q.mag,
      gain: clamp(0.1 + (q.mag - 4) * 0.09, 0.08, 0.42),
      label: q.place
    }));
    (hazards.events || []).slice(0, 4).forEach((e, i) => hazardEvents.push({
      t: 10 + i * 12,
      kind: 'storm',
      mag: 5,
      gain: 0.16,
      label: e.title
    }));
  }

  return {
    kind: 'terrain',
    duration: 60,
    avg, max, min, relief,
    instrument: instrumentOf(record, instrument),
    rootMidi,
    scale: notes,
    density,                                   // số nốt/giây (xấp xỉ)
    brightness: clamp(800 + (max / 8848) * 5200, 700, 6200),
    urban,
    forestPct: Number.isFinite(forestPct) ? forestPct : null,
    hazards: hazardEvents,
    ambience: {
      wind: clamp(terrain.mountain * 0.55 + roughness * 0.35, 0.05, 0.65),
      forest: forestGain,
      water: clamp(terrain.water * 1.7, 0, 0.42),
      sand: clamp(terrain.desert * 0.8, 0, 0.4)
    },
    summary: {
      mountain: terrain.mountain, plateau: terrain.plateau, hill: terrain.hill,
      plain: terrain.plain, desert: terrain.desert, water: terrain.water, forest: terrain.forest
    }
  };
}

/** Track B — biến khí hậu hiện tại thành lớp ambient + nhịp mưa. */
export function buildClimateProfile(record, { month = 0, scale = 'auto', instrument = 'auto', climateDelta = null, weatherOverlay = true } = {}) {
  const w = record?.weather || {};
  const c = record?.climate || {};
  const seasonMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : 0;
  const hasMonths = seasonMonth > 0 && Array.isArray(c.temps) && c.temps.length === 12;
  const monthT = hasMonths ? Number(c.temps[seasonMonth - 1]) : null;
  const monthP = hasMonths ? Number(c.precips?.[seasonMonth - 1]) : null;
  let temp = hasMonths && Number.isFinite(monthT) ? monthT : (Number.isFinite(w.temp) ? w.temp : (c.annualT ?? 20));
  const wind = Number(w.wind) || 8;
  let precip = hasMonths ? (Number.isFinite(monthP) ? monthP : 0) : (Number(w.precip) || 0);
  let humidity = hasMonths
    ? clamp(55 + precip / 8, 35, 95)
    : (Number.isFinite(w.humidity) ? w.humidity : 65);
  let cloud = hasMonths
    ? clamp(22 + precip / 5, 8, 96)
    : (Number.isFinite(w.cloud) ? w.cloud : 40);
  if (!weatherOverlay && !hasMonths) {
    temp = Number(c.annualT ?? temp);
    precip = Number(c.annualP ?? 1000) / 12;
    humidity = 65;
    cloud = 50;
  }

  const warm = clamp((temp + 10) / 50, 0, 1);          // 0 = -10°C, 1 = 40°C
  const autoChord = temp >= 24 ? [0, 4, 7, 11] :       // ấm: maj7 sáng
                    temp >= 13 ? [0, 3, 7, 10] :       // mát: min7
                    temp >= 2  ? [0, 3, 7, 14] :       // lạnh: min + add9
                                 [0, 5, 7, 12];        // rất lạnh: sus4 trong trẻo
  const chord = SCALES[scale] ? SCALES[scale].slice(0, 4) : autoChord;
  const warming = Number(climateDelta?.dT) || 0;
  const rainShift = Number(climateDelta?.dPPct) || 0;
  const rootMidi = Math.round(45 + warm * 14 + clamp(warming * 1.4, -4, 6));
  const rainScale = climateDelta ? clamp(1 + (rainShift / 100) * 0.5, 0.6, 1.5) : 1;

  return {
    kind: 'climate',
    duration: 60,
    instrument: instrumentOf(record, instrument),
    seasonMonth,
    warming,
    rainShift,
    temp, wind, precip, humidity, cloud,
    rootMidi,
    chord,
    brightness: 420 + Math.pow(warm, 1.4) * 5400,       // bộ lọc thông thấp
    windGain: clamp(0.04 + wind / 70 * 0.5, 0.03, 0.55),
    rainGain: clamp((hasMonths ? precip / 260 : precip / 14) * rainScale, 0, 0.6),
    rainDensity: clamp((hasMonths ? precip / 11 : precip * 3.2) * rainScale, 0, 22), // hạt mưa/giây
    padGain: clamp(0.32 + cloud / 220, 0.24, 0.62),
    bellDensity: clamp(0.25 + (humidity / 100) * 0.7, 0.2, 1.1),
    cloudiness: cloud / 100
  };
}

export function terrainShortSummary(record, lang = 'vi') {
  if (!record) return '';
  const t = record.terrain || {};
  const el = record.elevation || {};
  const pct = (v) => Math.round((v || 0) * 100);
  const bits = [];
  const push = (v, vi, en, threshold = 14) => { if (pct(v) >= threshold) bits.push(lang === 'en' ? `${pct(v)}% ${en}` : `${pct(v)}% ${vi}`); };
  push(t.mountain, 'núi', 'mountains', 10);
  push(t.plateau, 'cao nguyên', 'plateaus', 12);
  push(t.plain, 'đồng bằng', 'plains', 12);
  push(t.desert, 'sa mạc', 'desert', 10);
  if (t.forest >= 0.25) bits.push(lang === 'en' ? `${pct(t.forest)}% forest` : `${pct(t.forest)}% rừng`);
  if (pct(t.water) >= 12) bits.push(lang === 'en' ? `${pct(t.water)}% water` : `${pct(t.water)}% sông biển`);
  const elev = el.avg != null
    ? (lang === 'en' ? `Average elevation ${Math.round(el.avg)} m.` : `Độ cao trung bình ${Math.round(el.avg)} m.`)
    : '';
  return (bits.length ? (lang === 'en' ? 'Mostly ' : 'Chủ yếu ') + bits.slice(0, 3).join(', ') + '. ' : '') + elev;
}

/* ------------------------------ Sun position ---------------------------- */
/** Vị trí điểm mặt trời chiếu thẳng (subsolar point) — dùng cho ngày/đêm thật. */
export function subsolarPoint(date = new Date()) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000;
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const decl = -23.44 * Math.cos(rad * (360 / 365.24) * (dayOfYear + 10));
  const b = rad * (360 / 364) * (dayOfYear - 81);
  const eqTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  let lng = -15 * (hours + eqTime / 60 - 12);
  lng = ((lng + 180) % 360 + 360) % 360 - 180;
  return { lat: decl, lng };
}

export function sunAltitude(lat, lng, date = new Date()) {
  const s = subsolarPoint(date);
  const rad = Math.PI / 180;
  const cosZ = Math.sin(lat * rad) * Math.sin(s.lat * rad) +
    Math.cos(lat * rad) * Math.cos(s.lat * rad) * Math.cos((lng - s.lng) * rad);
  return Math.asin(clamp(cosZ, -1, 1)) / rad;
}

export { clamp, mean, sum, round };
