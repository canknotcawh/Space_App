/* =============================================================================
 * panel.js — Markup của bảng hồ sơ quốc gia (glass card)
 * State gọn (compact) và mở rộng (details) dùng cùng một markup; phần chi tiết
 * được animate bằng CSS max-height. Biểu đồ vẽ sau khi mount (xem app.js).
 * ========================================================================== */

import { t, escapeHtml, flagEmoji, fmtCoord, fmtNumber, round } from './i18n.js';
import { weatherInfo, koppenName } from './model.js';
import { TERRAIN_COLORS } from './charts.js';

const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

function uvLabel(uv, lang) {
  const v = Number(uv);
  if (!Number.isFinite(v)) return '—';
  if (lang === 'en') {
    if (v < 3) return 'Low'; if (v < 6) return 'Moderate'; if (v < 8) return 'High'; if (v < 11) return 'Very high'; return 'Extreme';
  }
  if (v < 3) return 'Thấp'; if (v < 6) return 'Trung bình'; if (v < 8) return 'Cao'; if (v < 11) return 'Rất cao'; return 'Cực cao';
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function cardinal(deg) {
  const v = ((Number(deg) || 0) % 360 + 360) % 360;
  return CARDINALS[Math.round(v / 45) % 8];
}

export function weatherIconMarkup(kind = 'cloud', isDay = true) {
  const sun = isDay ? '<div class="wi-sun"></div>' : '<div class="wi-moon"></div>';
  switch (kind) {
    case 'clear': return `<div class="weather-icon" aria-hidden="true">${sun}</div>`;
    case 'mostly-clear': return `<div class="weather-icon" aria-hidden="true">${sun}<div class="wi-cloud wi-cloud--dim" style="left:24px;bottom:2px;transform:scale(.75)"></div></div>`;
    case 'partly': return `<div class="weather-icon" aria-hidden="true">${sun}<div class="wi-cloud" style="left:24px;bottom:2px;transform:scale(.8)"></div></div>`;
    case 'fog': return `<div class="weather-icon" aria-hidden="true"><div class="wi-cloud wi-cloud--dim" style="bottom:16px"></div><div class="wi-cloud wi-cloud--dim" style="bottom:2px;transform:scale(.85)"></div></div>`;
    case 'drizzle': return `<div class="weather-icon" aria-hidden="true"><div class="wi-cloud"></div><div class="wi-rain" style="height:8px"><i></i><i></i></div></div>`;
    case 'rain': return `<div class="weather-icon" aria-hidden="true"><div class="wi-cloud"></div><div class="wi-rain"><i></i><i></i><i></i></div></div>`;
    case 'snow': return `<div class="weather-icon" aria-hidden="true"><div class="wi-cloud" style="background:rgba(240,248,255,.95)"></div><div class="wi-snow"><i></i><i></i><i></i></div></div>`;
    case 'storm': return `<div class="weather-icon" aria-hidden="true"><div class="wi-cloud" style="background:rgba(190,205,230,.95)"></div><div class="wi-rain"><i></i><i></i></div><svg class="wi-bolt" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg></div>`;
    default: return `<div class="weather-icon" aria-hidden="true"><div class="wi-cloud"></div></div>`;
  }
}

function forecastMarkup(record, lang) {
  const daily = record.weather?.daily || [];
  if (!daily.length) return `<p style="font-size:13px;color:var(--ink-3)">${escapeHtml(t('noData'))}</p>`;
  const weekdays = t('weekdays');
  return `<div class="forecast">${daily.slice(0, 7).map((d) => {
    let wd = '';
    if (d.date) {
      const dt = new Date(`${d.date}T12:00:00Z`);
      if (!Number.isNaN(dt.getTime())) wd = weekdays[dt.getUTCDay()];
    }
    const wi = weatherInfo(d.code, lang);
    const p = Number(d.precip) || 0;
    return `<div class="fday" title="${escapeHtml(wi.label)}">
      <div class="n">${escapeHtml(wd || '—')}</div>
      <div class="ic">${wi.icon === 'clear' ? '☀' : wi.icon === 'partly' || wi.icon === 'mostly-clear' ? '⛅' : wi.icon === 'cloud' ? '☁' : wi.icon === 'fog' ? '🌫' : wi.icon === 'rain' || wi.icon === 'drizzle' ? '🌧' : wi.icon === 'snow' ? '❄' : '⛈'}</div>
      <div class="t">${fmtNumber(Math.round(d.tmax))}°<small>${fmtNumber(Math.round(d.tmin))}°</small></div>
      <div class="p">${p > 0 ? `${p.toFixed(1)} mm` : '—'}</div>
    </div>`;
  }).join('')}</div>`;
}

function distributionMarkup(record) {
  const tr = record.terrain || {};
  const pct = (v) => Math.round((Number(v) || 0) * 100);
  const rows = [
    ['mountain', t('mountainShare')],
    ['plateau', t('plateau')],
    ['hill', t('hill')],
    ['plain', t('plain')],
    ['desert', t('desertShare')],
    ['water', t('water')]
  ];
  return `<div class="donut-wrap">
    <canvas id="terrain-donut" width="128" height="128" role="img" aria-label="${escapeHtml(`${t('distribution')}: ${rows.map(([k, l]) => `${l} ${pct(tr[k])}%`).join(', ')}`)}"></canvas>
    <div class="legend-list">
      ${rows.map(([k, label]) => `<div><span class="sw" style="background:${TERRAIN_COLORS[k]}"></span>${escapeHtml(label)}<span class="pct">${pct(tr[k])}%</span></div>`).join('')}
    </div>
  </div>`;
}

export function renderPanel(record, { expanded = false, compare = '' } = {}) {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'vi';
  const w = record.weather || {};
  const c = record.climate || {};
  const e = record.elevation || {};
  const wi = weatherInfo(w.code, lang);
  const name = record.name?.[lang] || record.name?.vi || '';
  const kCode = c.koppen;
  const flag = flagEmoji(record.code);
  const uv = w.uv ?? w.daily?.[0]?.uv;
  const point = record.point || record.label || {};
  const terrainSummary = record.summaryText || '';

  const chips = [];
  if (kCode) chips.push(`<span class="chip chip--cyan"><span class="dot"></span>${escapeHtml(kCode)} · ${escapeHtml(koppenName(kCode, lang))}</span>`);
  if (record.offline) chips.push(`<span class="chip chip--offline">${escapeHtml(t('statusOffline'))}</span>`);
  else if (record.partial?.length) chips.push(`<span class="chip"><span class="dot" style="background:var(--orange)"></span>${escapeHtml(lang === 'en' ? 'Partial data' : 'Dữ liệu một phần')}</span>`);
  chips.push(`<span class="chip chip--cyan" id="compare-chip"${compare ? '' : ' hidden'}><span class="dot"></span>B · ${escapeHtml(compare)}</span>`);
  chips.push(`<button class="chip chip--action" id="compare-btn" type="button" aria-pressed="${compare ? 'true' : 'false'}">${escapeHtml(compare ? t('compareClear') : t('compareAdd'))}</button>`);

  return `
  <div class="country-hero">
    <div class="country-title">
      <div class="country-flag" aria-hidden="true">${flag}</div>
      <div style="min-width:0">
        <h3>${escapeHtml(name)}</h3>
        <div class="sub">
          <span>${icon('pin')}${escapeHtml(t('capital'))}: ${escapeHtml(record.capital || t('noData'))}</span>
          ${record.continent ? `<span>${icon('globe')}${escapeHtml(record.continent)}</span>` : ''}
          ${record.population ? `<span>${escapeHtml(t('population'))}: ${fmtNumber(record.population)}</span>` : ''}
        </div>
      </div>
    </div>
    ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
  </div>

  <div class="section-block">
    <div class="block-head"><h4>${escapeHtml(t('weatherNow'))}</h4></div>
    <div class="weather-top">
      ${weatherIconMarkup(wi.icon, w.isDay !== false)}
      <div>
        <div class="weather-temp">${fmtNumber(Math.round(w.temp ?? c.annualT ?? 0))}<sup>°C</sup></div>
        <div class="weather-desc">${escapeHtml(wi.label)}${w.feels != null ? ` · ${escapeHtml(t('feelsLike'))} ${Math.round(w.feels)}°` : ''}</div>
      </div>
    </div>
    <div class="weather-grid">
      <div class="metric"><div class="k">${icon('wind')}${escapeHtml(t('wind'))}</div><div class="v">${fmtNumber(Math.round(w.wind ?? 0))}<small>km/h</small> <span style="font-size:11.5px;color:var(--ink-3);display:inline-block;transform:rotate(${Number(w.windDir) || 0}deg)">↑</span> ${cardinal(w.windDir)}</div></div>
      <div class="metric"><div class="k">${icon('drop')}${escapeHtml(t('rain'))}</div><div class="v">${Number(w.precip ?? 0).toFixed(1)}<small>mm</small></div></div>
      <div class="metric"><div class="k">${icon('humidity')}${escapeHtml(t('humidity'))}</div><div class="v">${fmtNumber(Math.round(w.humidity ?? 0))}<small>%</small></div></div>
      <div class="metric"><div class="k">${icon('uv')}${escapeHtml(t('uv'))}</div><div class="v">${uv != null ? Math.round(uv) : '—'}<small>${escapeHtml(uvLabel(uv, lang))}</small></div></div>
      <div class="metric"><div class="k">${icon('cloud')}${escapeHtml(t('cloud'))}</div><div class="v">${fmtNumber(Math.round(w.cloud ?? 0))}<small>%</small></div></div>
      <div class="metric"><div class="k">${icon('mountain')}${escapeHtml(t('average'))}</div><div class="v">${fmtNumber(e.avg ?? 0)}<small>m</small></div></div>
    </div>
    ${terrainSummary ? `<div class="terrain-summary">${escapeHtml(terrainSummary)}</div>` : ''}
    <div class="coords">
      <div class="coord"><div class="k">${escapeHtml(t('center'))}</div><div class="v">${fmtCoord(record.label?.lat ?? 0, record.label?.lng ?? 0)}</div></div>
      <div class="coord"><div class="k">${escapeHtml(t('clicked'))}</div><div class="v">${fmtCoord(point.lat ?? 0, point.lng ?? 0)}</div></div>
    </div>
  </div>

  <div class="section-block" style="padding-bottom:8px">
    <div class="block-head" style="margin-bottom:0">
      <h4>${escapeHtml(t('details'))}</h4>
      <button class="link" id="details-toggle" type="button" aria-expanded="${expanded}" aria-controls="details-body">
        ${escapeHtml(expanded ? t('collapse') : t('viewDetail'))} ${icon('chev', 'chev')}
      </button>
    </div>
  </div>

  <div class="details" id="details-body" data-open="${expanded}">
    <div class="section-block">
      <div class="block-head"><h4>${escapeHtml(t('elevation'))}</h4><span style="font-size:11px;color:var(--ink-3)">${escapeHtml(t('estimate'))}</span></div>
      <div class="stat-rows">
        <div class="stat-row"><span class="k"><i style="background:var(--magenta)"></i>${escapeHtml(t('highest'))}</span><span class="v">${fmtNumber(e.max)}<small>m</small></span></div>
        <div class="stat-row"><span class="k"><i style="background:var(--cyan)"></i>${escapeHtml(t('lowest'))}</span><span class="v">${fmtNumber(e.min)}<small>m</small></span></div>
        <div class="stat-row"><span class="k"><i style="background:var(--lime)"></i>${escapeHtml(t('average'))}</span><span class="v">${fmtNumber(e.avg)}<small>m</small></span></div>
        <div class="stat-row"><span class="k"><i style="background:var(--orange)"></i>${escapeHtml(t('peak'))}</span><span class="v">${escapeHtml(e.peakName || t('noData'))}${e.peakElev ? `<small>${fmtNumber(e.peakElev)}m</small>` : ''}</span></div>
      </div>
    </div>

    <div class="section-block">
      <div class="block-head"><h4>${escapeHtml(t('distribution'))}</h4><span style="font-size:11px;color:var(--ink-3)">${escapeHtml(t('estimate'))}</span></div>
      ${distributionMarkup(record)}
    </div>

    <div class="section-block">
      <div class="block-head"><h4>${escapeHtml(t('climateChart'))}</h4><span style="font-size:11px;color:var(--ink-3)">NASA POWER</span></div>
      <div class="chart-wrap"><canvas id="climate-chart" role="img" aria-label="${escapeHtml(t('climateChart'))}"></canvas></div>
      <div class="chart-key">
        <span><i style="background:linear-gradient(180deg,#00E5FF,#00E5FF55)"></i>${escapeHtml(t('rain'))} (mm)</span>
        <span><i style="background:linear-gradient(90deg,#FFC24B,#FF8A00)"></i>${escapeHtml(t('temp'))} (°C)</span>
        <span style="margin-left:auto">TB ${round(c.annualT ?? 0, 1)}°C · ${fmtNumber(Math.round(c.annualP ?? 0))} mm</span>
      </div>
    </div>

    <div class="section-block">
      <div class="block-head"><h4>${escapeHtml(t('forecast'))}</h4></div>
      ${forecastMarkup(record, lang)}
    </div>

    <div class="section-block">
      <div class="block-head"><h4>${escapeHtml(t('koppen'))}</h4></div>
      <div class="koppen-card">
        <div class="koppen-code">${escapeHtml(kCode || '—')}</div>
        <div class="txt"><strong>${escapeHtml(koppenName(kCode, lang) || t('noData'))}</strong>
          ${escapeHtml(lang === 'en' ? 'Classified from 12-month NASA POWER climatology.' : 'Phân loại từ khí hậu 12 tháng của NASA POWER.')}
        </div>
      </div>
    </div>

    <div class="section-block">
      <div class="block-head"><h4>${escapeHtml(t('sources'))}</h4></div>
      <ul class="sources" style="list-style:none;padding:0;margin:0">
        ${(record.sources || []).map((s, i) => `<li><span class="num">${String(i + 1).padStart(2, '0')}</span><span>${escapeHtml(s)}</span></li>`).join('')}
      </ul>
      <p style="font-size:11px;color:var(--ink-3);margin-top:8px;line-height:1.5">${escapeHtml(t('dataCredit'))}</p>
    </div>
  </div>`;
}

export function renderLoadingPanel(record) {
  const name = record?.name?.vi || '';
  return `<div class="country-hero">
      <div class="country-title">
        <div class="country-flag" aria-hidden="true">${flagEmoji(record?.code)}</div>
        <div><h3>${escapeHtml(name)}</h3><div class="sub"><span>${escapeHtml(t('loadingData'))}</span></div></div>
      </div>
    </div>
    <div class="skeleton">
      <div class="sk sk--lg"></div>
      <div class="sk-grid"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>
      <div class="sk" style="margin-top:14px"></div>
      <div class="sk sk--sm"></div>
    </div>`;
}

export function renderErrorPanel(record, message) {
  const name = record?.name?.vi || '';
  return `<div class="country-hero">
      <div class="country-title">
        <div class="country-flag" aria-hidden="true">${flagEmoji(record?.code)}</div>
        <div><h3>${escapeHtml(name)}</h3></div>
      </div>
    </div>
    <div class="error-card">
      <strong>${escapeHtml(t('errorTitle'))}</strong>
      <span>${escapeHtml(message || t('errorBody'))}</span>
      <button class="btn btn--ghost" id="retry-btn" type="button">${escapeHtml(t('retry'))}</button>
    </div>`;
}
