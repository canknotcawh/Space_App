/* =============================================================================
 * app.js — Khởi động & điều phối
 *  - Kết nối GlobeView ↔ DataService ↔ AudioEngine ↔ Info panel
 *  - Transport UI, visualizer, phím tắt, tìm kiếm, song ngữ, onboarding
 * ========================================================================== */

import {
  t, state, applyStaticI18n, fold, fmtTime, debounce, setStatus, announce, saveLang, fmtNumber, escapeHtml
} from './i18n.js';
import {
  loadCountries, getCountryProfile, searchCountries, clearProfileCache,
  fetchClimateDelta, fetchHazards, fetchBiosphere, fetchWeatherNow
} from './data.js';
import { buildTerrainProfile, buildClimateProfile, terrainShortSummary } from './model.js';
import { GlobeView } from './globe.js';
import { AudioEngine } from './audio.js';
import { renderPanel, renderLoadingPanel, renderErrorPanel } from './panel.js';
import { drawDonut, drawClimateChart, drawWaveform, TERRAIN_COLORS } from './charts.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const app = {
  features: [],
  selected: null,
  record: null,
  requestSeq: 0,
  expanded: false,
  statusMode: 'loading',
  sheet: 'peek',
  dockOpen: false,
  compare: null,
  pickCompare: false,
  compareVols: null
};

const LAB_KEY = 'etl.soundPreset';
const LAB_SCALES = ['auto', 'pentatonic', 'major', 'minor', 'dorian'];
const LAB_INSTRUMENTS = ['auto', 'pluck', 'dan-tranh', 'dan-bau', 'sao', 'drum'];

const audio = new AudioEngine();

const globe = new GlobeView($('#globe'), {
  onReady: () => { revealWhenReady('globe'); },
  onHover: (feature) => showTooltip(feature),
  onSelect: (feature, point) => selectCountry(feature, point),
  onInteract: () => {
    $('#stage')?.classList.add('is-engaged');
    hideTooltip();
  }
});

/* ------------------------------ Elements -------------------------------- */
const dom = {
  search: $('#search'),
  searchWrap: $('#search-wrap'),
  searchClear: $('#search-clear'),
  results: $('#search-results'),
  panel: $('#info-panel'),
  panelBody: $('#panel-body'),
  panelContent: $('#panel-content'),
  emptyState: $('#empty-state'),
  badge: $('#panel-badge span'),
  loader: $('#globe-loader'),
  loaderMsg: $('#loader-message'),
  tooltip: $('#globe-tooltip'),
  stage: $('#stage'),
  dock: $('#dock'),
  dockToggle: $('#dock-toggle'),
  miniTransport: $('#mini-transport'),
  onboarding: $('#onboarding'),
  live: $('#live-region')
};

const trackEls = {
  terrain: $('.track[data-track="terrain"]'),
  climate: $('.track[data-track="climate"]')
};
const trackUI = {};
Object.entries(trackEls).forEach(([kind, root]) => {
  trackUI[kind] = {
    root,
    seek: $('.seek', root),
    vol: $('.vol', root),
    time: $('[data-time]', root),
    stateLabel: $('[data-state-label]', root),
    playBtn: $('[data-act="toggle"]', root),
    playUse: $('[data-act="toggle"] use', root),
    muteBtn: $('[data-act="mute"]', root),
    muteUse: $('[data-act="mute"] use', root),
    source: $('[data-source]', root),
    viz: $('[data-viz]', root),
    volVal: $('[data-vol]', root),
    dragging: false
  };
});

/* ------------------------------- Boot ----------------------------------- */
boot();

async function boot() {
  applyStaticI18n();
  updateLangButtons();
  setupStars();
  bindUI();
  startOnboardingIfNeeded();
  updateMasterUI();
  audio.setMaster(0.85);
  initLab();
  audio.setTempo(state.tempo);
  setInterval(refreshWeatherNow, 60 * 60 * 1000);
  audio.setSpatial(state.spatial);
  syncSpatialButton();
  requestAnimationFrame(vizLoop);

  if (!location.protocol.startsWith('http')) {
    toast('Hãy chạy qua HTTP server để tải dữ liệu (vd: python3 -m http.server).', 'warn', 9000);
  }

  dom.loaderMsg.textContent = t('loadingCountries');
  const [globeRes, countriesRes] = await Promise.allSettled([globe.init(), loadCountries()]);

  if (countriesRes.status === 'fulfilled') {
    app.features = countriesRes.value;
    globe.setCountries(app.features);
    setStatus(t('statusReady'), { offline: false });
    app.statusMode = 'ready';
    dom.loader.dataset.done = 'true';
    dom.loaderMsg.textContent = '';
  } else {
    console.error(countriesRes.reason);
    setStatus(t('statusOffline'), { offline: true });
    dom.loaderMsg.textContent = t('errorBody');
    dom.loader.dataset.done = 'true';
    toast(t('errorBody'), 'warn', 8000);
  }
  if (globeRes.status === 'rejected') {
    console.error(globeRes.reason);
    dom.loader.dataset.done = 'true';
    toast(globeRes.reason?.message || 'WebGL không khả dụng', 'warn', 9000);
  }
}

/* ------------------------------ Selection -------------------------------- */
async function selectCountry(feature, point, { retry = false } = {}) {
  if (!feature) return;
  if (app.pickCompare) { await selectCompareCountry(feature, point); return; }
  app.pickCompare = false;
  if (app.compareVols) {
    audio.tracks.terrain.fadeTo(app.compareVols.terrain, 0.8);
    audio.tracks.climate.fadeTo(app.compareVols.climate, 0.8);
  }
  app.compare = null;
  app.compareVols = null;
  app.selected = feature;
  app.record = null;
  app.expanded = false;
  app.requestSeq += 1;
  const seq = app.requestSeq;

  globe.setSelected(feature);
  globe.flyTo(feature);
  hideTooltip();
  closeSearch();
  updateDockNow(feature);
  dom.panel.classList.add('has-country');
  setSheet('mid');
  dom.emptyState.hidden = true;
  dom.panelContent.hidden = false;
  dom.panelContent.innerHTML = renderLoadingPanel(feature);
  dom.badge.textContent = feature.__name?.[state.lang] || feature.__name?.vi || '';
  dom.panelBody.scrollTop = 0;

  audio.clear();
  updateTrackShells();
  if (retry) clearProfileCache(feature.__code);

  try {
    const record = await getCountryProfile(feature, point);
    if (seq !== app.requestSeq) return;
    applyRecord(record);
    if (record.offline) toast(t('offlineToast', { name: record.name[state.lang] || record.name.vi }), 'warn', 6000);
  } catch (err) {
    console.error(err);
    if (seq !== app.requestSeq) return;
    dom.panelContent.innerHTML = renderErrorPanel(feature, t('errorBody'));
    $('#retry-btn')?.addEventListener('click', () => selectCountry(feature, point, { retry: true }));
    toast(t('errorTitle'), 'warn', 6000);
  }
}

function labOptions() {
  return { scale: state.scale, instrument: state.instrument };
}

function terrainOptions() {
  return {
    ...labOptions(),
    hazards: state.layers.hazards ? app.record?.extras?.hazards : null,
    bio: state.layers.bio ? app.record?.extras?.bio : null
  };
}

function climateOptions(target) {
  return {
    month: state.season,
    ...labOptions(),
    climateDelta: state.layers.climate ? target?.extras?.climateDelta : null,
    weatherOverlay: state.layers.weather
  };
}

/** Dựng lại cả hai track; mặc định giữ nguyên vị trí và trạng thái phát. */
function rebuildTracks(preserve = true) {
  if (!app.record) return;
  const target = app.compare || app.record;
  const terrain = buildTerrainProfile(app.record, terrainOptions());
  const climate = buildClimateProfile(target, climateOptions(target));
  if (preserve) {
    audio.tracks.terrain.reload(terrain, `${app.record.code}-terrain`);
    audio.tracks.climate.reload(climate, `${target.code}-climate-${state.season}`);
  } else {
    audio.loadProfiles(terrain, climate, app.record.code);
  }
  updateTrackShells();
  updateTrackSources();
  syncTransport();
}

/** Tải dữ liệu cho các lớp đang bật (chỉ một lần cho mỗi hồ sơ). */
async function ensureLayerData() {
  const rec = app.record;
  if (!rec) return;
  const jobs = [];
  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
  const prepare = (r, primary) => {
    if (!r) return;
    r.extras = r.extras || {};
    if (state.layers.climate && !r.extras.climateDelta) {
      jobs.push(withTimeout(fetchClimateDelta(r), 18000).then((v) => { r.extras.climateDelta = v; }));
    }
    if (primary && state.layers.hazards && (!r.extras.hazards || r.extras.hazards.days !== state.hazardDays)) {
      jobs.push(withTimeout(fetchHazards(r, state.hazardDays), 15000).then((v) => { r.extras.hazards = v; }));
    }
    if (primary && state.layers.bio && !r.extras.bio) {
      jobs.push(withTimeout(fetchBiosphere(r), 15000).then((v) => { r.extras.bio = v; }));
    }
  };
  prepare(rec, true);
  if (app.compare) prepare(app.compare, false);
  if (!jobs.length) { updateLayerStatus(); return; }
  const status = $('#layer-status');
  if (status) status.textContent = t('layerLoading');
  const results = await Promise.allSettled(jobs);
  if (results.some((r) => r.status === 'rejected')) {
    console.warn('[layers]', results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message));
    toast(t('layerError'), 'warn', 6000);
  }
  if (app.record !== rec) return;
  rebuildTracks(true);
  updateLayerStatus();
}

function updateLayerStatus() {
  const el = $('#layer-status');
  if (!el) return;
  const rec = app.record;
  if (!rec) { el.textContent = ''; return; }
  const parts = [];
  const delta = rec.extras?.climateDelta;
  if (state.layers.climate && delta) {
    parts.push(t('layerClimateStatus', { d: `${delta.dT >= 0 ? '+' : ''}${delta.dT.toFixed(1)}` }));
  }
  const hz = rec.extras?.hazards;
  if (state.layers.hazards && hz) {
    parts.push(t('layerHazardsStatus', { n: hz.quakes.length, e: hz.events.length }));
  }
  const bio = rec.extras?.bio;
  if (state.layers.bio && bio) {
    parts.push(t('layerBioStatus', {
      f: bio.forestPct != null ? Math.round(bio.forestPct) : '—',
      d: bio.density != null ? Math.round(bio.density).toLocaleString(state.lang === 'en' ? 'en-US' : 'vi-VN') : '—'
    }));
  }
  if (state.layers.weather && rec.weather) {
    const time = new Date(rec.fetchedAt || Date.now()).toLocaleTimeString(state.lang === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' });
    parts.push(t('layerWeatherStatus', { time }));
  }
  el.textContent = parts.join(' · ');
}

function syncLayerUI() {
  ['climate', 'hazards', 'bio', 'weather'].forEach((key) => {
    const input = $(`#layer-${key}`);
    if (input) input.checked = !!state.layers[key];
  });
  const range = $('#hazard-range');
  if (range) range.value = String(state.hazardDays);
}

/** Vẽ lại panel (dùng khi thời tiết được làm mới). */
function repaintPanel() {
  if (!app.record) return;
  const compareName = app.compare ? (app.compare.name[state.lang] || app.compare.name.vi) : '';
  dom.panelContent.innerHTML = renderPanel(app.record, { expanded: app.expanded, compare: compareName });
  bindDetailsToggle();
  $('#compare-btn')?.addEventListener('click', toggleCompare);
  const body = $('#details-body');
  if (body) body.style.maxHeight = app.expanded ? 'none' : '0px';
  if (app.expanded) setTimeout(drawCharts, 120);
}

async function refreshWeatherNow() {
  if (!state.layers.weather || !app.record || document.hidden) return;
  try {
    app.record.weather = await fetchWeatherNow(app.record);
    app.record.fetchedAt = Date.now();
    rebuildTracks(true);
    repaintPanel();
    updateLayerStatus();
  } catch (err) {
    console.warn('[weather] không làm mới được:', err.message);
  }
}

function applyRecord(record) {
  app.record = record;
  record.summaryText = terrainShortSummary(record, state.lang);
  const compareName = app.compare ? (app.compare.name[state.lang] || app.compare.name.vi) : '';
  dom.panelContent.innerHTML = renderPanel(record, { expanded: app.expanded, compare: compareName });
  bindDetailsToggle();
  $('#compare-btn')?.addEventListener('click', toggleCompare);
  const detailsBody = $('#details-body');
  if (detailsBody) detailsBody.style.maxHeight = app.expanded ? 'none' : '0px';

  audio.setTempo(state.tempo);
  rebuildTracks(false);
  syncSeasonUI();
  ensureLayerData();

  const name = record.name[state.lang] || record.name.vi;
  dom.badge.textContent = name;
  announce(`${name}. ${record.summaryText || ''}`);
  if (app.expanded) drawCharts();
}

function bindDetailsToggle() {
  const btn = $('#details-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => setDetailsOpen(!app.expanded));
}

/** Mở/đóng phần chi tiết. Chiều cao đặt tường minh để không phụ thuộc transition. */
function setDetailsOpen(open) {
  app.expanded = open;
  const body = $('#details-body');
  const btn = $('#details-toggle');
  if (!body) return;
  body.dataset.open = String(open);
  if (btn) {
    btn.setAttribute('aria-expanded', String(open));
    const label = btn.firstChild;
    if (label && label.nodeType === 3) label.nodeValue = (open ? t('collapse') : t('viewDetail')) + ' ';
  }
  if (open) {
    body.style.maxHeight = body.scrollHeight + 'px';
    setTimeout(() => { if (app.expanded) body.style.maxHeight = 'none'; }, 520);
    setTimeout(drawCharts, 140);
  } else {
    body.style.maxHeight = '0px';
  }
}

function drawCharts() {
  const rec = app.record;
  if (!rec) return;
  const donut = document.getElementById('terrain-donut');
  if (donut) {
    const tr = rec.terrain || {};
    drawDonut(donut, [
      { value: tr.mountain, color: TERRAIN_COLORS.mountain },
      { value: tr.plateau, color: TERRAIN_COLORS.plateau },
      { value: tr.hill, color: TERRAIN_COLORS.hill },
      { value: tr.plain, color: TERRAIN_COLORS.plain },
      { value: tr.desert, color: TERRAIN_COLORS.desert },
      { value: tr.water, color: TERRAIN_COLORS.water }
    ], state.lang === 'en' ? 'Terrain' : 'Địa hình');
  }
  const chart = document.getElementById('climate-chart');
  if (chart && rec.climate?.temps) {
    drawClimateChart(chart, rec.climate.temps, rec.climate.precips || [], t('months'), state.season);
  }
}

/* ------------------------------- Tooltip --------------------------------- */
let tooltipX = 0, tooltipY = 0;
function showTooltip(feature) {
  if (!feature) { hideTooltip(); return; }
  const name = feature.__name?.[state.lang] || feature.__name?.vi || '';
  dom.tooltip.textContent = name;
  dom.tooltip.dataset.show = 'true';
  dom.tooltip.setAttribute('aria-hidden', 'false');
}
function hideTooltip() {
  dom.tooltip.dataset.show = 'false';
  dom.tooltip.setAttribute('aria-hidden', 'true');
}
function positionTooltip(clientX, clientY) {
  const rect = dom.stage.getBoundingClientRect();
  tooltipX = clientX - rect.left;
  tooltipY = clientY - rect.top;
  dom.tooltip.style.left = `${tooltipX}px`;
  dom.tooltip.style.top = `${tooltipY}px`;
}

/* -------------------------------- Tracks --------------------------------- */
function ensureAudio() {
  try {
    audio.ensure();
    return true;
  } catch (err) {
    toast(err.message || 'Audio không khả dụng', 'warn');
    return false;
  }
}

function activeTrack() { return audio.tracks[state.activeTrack]; }

function toggleTrack(kind) {
  const tr = audio.tracks[kind];
  if (!tr.profile) {
    toast(t('selectCountryFirst'), 'warn');
    announce(t('selectCountryFirst'));
    return;
  }
  if (!ensureAudio()) return;
  state.activeTrack = kind;
  if (tr.playing) tr.pause(); else tr.play();
  updateTrackShells();
  syncTransport();
}

function updateTrackShells() {
  Object.entries(trackUI).forEach(([kind, ui]) => {
    const tr = audio.tracks[kind];
    ui.root.dataset.playing = String(tr.playing);
    ui.root.dataset.active = String(state.activeTrack === kind);
    ui.stateLabel.textContent = !tr.profile ? t('stateIdle') : tr.playing ? t('statePlaying') : (tr.getPosition() > 0.05 ? t('statePaused') : t('stateReady'));
    ui.playUse?.setAttribute('href', tr.playing ? '#i-pause' : '#i-play');
    ui.playBtn?.setAttribute('aria-label', tr.playing ? t('pause') : t('play'));
    ui.muteUse?.setAttribute('href', tr.muted ? '#i-mute' : '#i-vol');
    ui.muteBtn?.setAttribute('aria-pressed', String(tr.muted));
    ui.root.style.setProperty('--accent', kind === 'terrain' ? 'var(--orange)' : 'var(--cyan)');
  });
}

function updateTrackSources() {
  const rec = app.record;
  const vi = state.lang !== 'en';
  const ter = trackUI.terrain.source;
  const cli = trackUI.climate.source;
  if (!rec) {
    if (ter) ter.textContent = t('stateIdle');
    if (cli) cli.textContent = t('stateIdle');
    return;
  }
  if (ter) {
    ter.textContent = `${fmtNumber(rec.elevation?.avg ?? 0)} m ${vi ? 'TB' : 'avg'} · ${fmtNumber(rec.elevation?.max ?? 0)} m ${vi ? 'cao nhất' : 'max'}`;
  }
  if (cli) {
    const p = audio.tracks.climate.profile || {};
    const month = p.seasonMonth ? `${t('months')[p.seasonMonth - 1]} · ` : '';
    const cmp = app.compare ? `${app.compare.name[state.lang] || app.compare.name.vi} · ` : '';
    cli.textContent = `${cmp}${month}${Math.round(p.temp ?? rec.weather?.temp ?? 0)}°C · ${Math.round(p.wind ?? 0)} km/h · ${Number(p.precip ?? 0).toFixed(1)} mm`;
  }
}

/* ------------------------------ Sound lab ------------------------------- */
function initLab() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LAB_KEY) || 'null'); } catch (e) { /* chế độ riêng tư */ }
  if (saved) {
    if (LAB_SCALES.includes(saved.scale)) state.scale = saved.scale;
    if (LAB_INSTRUMENTS.includes(saved.instrument)) state.instrument = saved.instrument;
    if (Number.isFinite(saved.tempo)) state.tempo = Math.min(1.6, Math.max(0.6, saved.tempo));
    if (saved.layers) {
      Object.keys(state.layers).forEach((k) => { if (k in saved.layers) state.layers[k] = !!saved.layers[k]; });
    }
    if ([30, 90, 365].includes(saved.hazardDays)) state.hazardDays = saved.hazardDays;
  }
  const params = new URLSearchParams(location.search);
  if (LAB_SCALES.includes(params.get('scale'))) state.scale = params.get('scale');
  if (LAB_INSTRUMENTS.includes(params.get('instr'))) state.instrument = params.get('instr');
  const tempo = Number(params.get('tempo'));
  if (tempo >= 60 && tempo <= 160) state.tempo = tempo / 100;
  const season = Number(params.get('season'));
  if (Number.isInteger(season) && season >= 0 && season <= 12) state.season = season;
  if (params.get('layers') != null) {
    const on = new Set(params.get('layers').split(',').filter(Boolean));
    Object.keys(state.layers).forEach((k) => { state.layers[k] = on.has(k); });
  }
  const hazardDays = Number(params.get('hazardDays'));
  if ([30, 90, 365].includes(hazardDays)) state.hazardDays = hazardDays;
  syncLabUI();
  syncLayerUI();
  syncSeasonUI();
}

function syncLabUI() {
  const scale = $('#lab-scale');
  if (scale) scale.value = state.scale;
  const instrument = $('#lab-instrument');
  if (instrument) instrument.value = state.instrument;
  const tempo = $('#lab-tempo');
  if (tempo) {
    const pct = Math.round(state.tempo * 100);
    tempo.value = String(pct);
    tempo.style.setProperty('--fill', `${((pct - 60) / 100) * 100}%`);
    $('#lab-tempo-out').textContent = `${pct}%`;
  }
}

function setLabStatus(message) {
  const el = $('#lab-status');
  if (!el) return;
  el.textContent = message;
  clearTimeout(setLabStatus._timer);
  setLabStatus._timer = setTimeout(() => { el.textContent = ''; }, 4500);
}

/** Áp dụng thang âm/nhạc cụ mới cho cả hai track, giữ nguyên vị trí phát. */
function applyLab() {
  rebuildTracks(true);
}

function syncSpatialButton() {
  const btn = $('#spatial-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(state.spatial));
}

function syncSeasonUI() {
  const range = $('#season-range');
  const out = $('#season-out');
  if (range) {
    range.disabled = !app.record;
    range.value = String(state.season);
    range.style.setProperty('--fill', `${(state.season / 12) * 100}%`);
    range.setAttribute('aria-valuetext', state.season
      ? `${t('seasonValue', { month: state.season })}: ${t('months')[state.season - 1]}`
      : t('seasonAnnual'));
  }
  if (out) out.textContent = state.season ? t('months')[state.season - 1] : t('seasonAnnual');
}

function updateCompareChip() {
  const btn = $('#compare-btn');
  if (btn) {
    btn.textContent = app.compare ? t('compareClear') : app.pickCompare ? t('comparePicking') : t('compareAdd');
    btn.setAttribute('aria-pressed', String(!!app.compare));
  }
  const chip = $('#compare-chip');
  if (chip) {
    if (app.compare) {
      chip.hidden = false;
      chip.textContent = `B · ${app.compare.name[state.lang] || app.compare.name.vi}`;
    } else {
      chip.hidden = true;
    }
  }
}

function toggleCompare() {
  if (!app.record) { toast(t('selectCountryFirst'), 'warn'); return; }
  if (app.compare) { clearCompare(); return; }
  app.pickCompare = !app.pickCompare;
  updateCompareChip();
  toast(app.pickCompare ? t('comparePick') : t('compareCancel'), app.pickCompare ? 'ok' : 'warn', 6000);
  if (app.pickCompare) announce(t('comparePick'));
}

/** Chọn nơi thứ hai: chỉ nạp vào track B, panel vẫn giữ nơi A. */
async function selectCompareCountry(feature, point) {
  app.pickCompare = false;
  const fallbackName = feature.__name?.[state.lang] || feature.__name?.vi || '';
  try {
    const record = await getCountryProfile(feature, point);
    app.compare = record;
    if (!app.record) { applyRecord(record); return; }
    app.compareVols = app.compareVols || {
      terrain: audio.tracks.terrain.volume,
      climate: audio.tracks.climate.volume
    };
    const profile = buildClimateProfile(record, climateOptions(record));
    audio.loadClimate(profile, `${record.code}-climate-${state.season}`);
    audio.tracks.terrain.fadeTo(0.4, 2.5);
    audio.tracks.climate.fadeTo(0.95, 2.5);
    updateTrackSources();
    updateCompareChip();
    syncTransport();
    const name = record.name[state.lang] || record.name.vi;
    toast(t('compareReady', { name }), 'ok', 6000);
    announce(t('compareReady', { name }));
    if (state.layers.climate && !record.extras?.climateDelta) ensureLayerData();
  } catch (err) {
    console.error(err);
    toast(t('errorTitle'), 'warn', 5000);
    announce(t('errorTitle'));
    app.compare = null;
    app.pickCompare = false;
    updateCompareChip();
    if (!app.record && fallbackName) dom.badge.textContent = fallbackName;
  }
}

function clearCompare() {
  app.compare = null;
  app.pickCompare = false;
  if (app.record) {
    audio.loadClimate(buildClimateProfile(app.record, climateOptions(app.record)), `${app.record.code}-climate-${state.season}`);
    updateTrackSources();
  }
  const vols = app.compareVols;
  if (vols) {
    audio.tracks.terrain.fadeTo(vols.terrain, 1.2);
    audio.tracks.climate.fadeTo(vols.climate, 1.2);
  }
  app.compareVols = null;
  updateCompareChip();
  syncTransport();
  toast(t('compareOff'), 'ok');
  announce(t('compareOff'));
}

/** Đổi tháng cho track khí hậu: dựng lại profile theo mùa, giữ nguyên vị trí phát. */
function setSeason(month) {
  const next = Math.max(0, Math.min(12, Number(month) || 0));
  const changed = next !== state.season;
  state.season = next;
  syncSeasonUI();
  if (!app.record || !changed) return;
  const target = app.compare || app.record;
  const profile = buildClimateProfile(target, climateOptions(target));
  audio.loadClimate(profile, `${target.code}-climate-${state.season}`);
  updateTrackSources();
  if (app.expanded) drawCharts();
  announce(state.season
    ? `${t('seasonValue', { month: state.season })}: ${Math.round(profile.temp)}°C · ${Math.round(profile.precip)} mm`
    : t('seasonAnnual'));
}

function syncTransport() {
  Object.entries(trackUI).forEach(([kind, ui]) => {
    const tr = audio.tracks[kind];
    const pos = tr.getPosition();
    const dur = tr.duration || 60;
    if (!ui.dragging) {
      ui.seek.value = String(Math.min(dur, pos));
      ui.seek.style.setProperty('--fill', `${(pos / dur) * 100}%`);
    }
    ui.time.textContent = `${fmtTime(pos)} / ${fmtTime(dur)}`;
    ui.stateLabel.textContent = !tr.profile
      ? t('stateIdle')
      : tr.playing ? t('statePlaying') : pos > 0.05 ? t('statePaused') : t('stateReady');
    ui.playUse?.setAttribute('href', tr.playing ? '#i-pause' : '#i-play');
    const pct = Math.round(tr.volume * 100);
    ui.volVal.textContent = `${pct}%`;
    ui.vol.value = String(pct);
    ui.vol.style.setProperty('--fill', `${pct}%`);
  });
  updateMiniTransport();
}

function updateMiniTransport() {
  if (!dom.miniTransport) return;
  ['terrain', 'climate'].forEach((kind) => {
    const btn = dom.miniTransport.querySelector(`[data-mini="${kind}"]`);
    if (!btn) return;
    const tr = audio.tracks[kind];
    btn.classList.toggle('is-playing', tr.playing);
    btn.setAttribute('aria-label', `${kind === 'terrain' ? t('trackTerrain') : t('trackClimate')}: ${tr.playing ? t('pause') : t('play')}`);
    btn.setAttribute('aria-disabled', String(!tr.profile));
  });
}

let vizLast = 0;
let spatialLast = 0;
const vizBuffers = {};
function vizLoop(ts = 0) {
  if (ts - spatialLast > 220) {
    spatialLast = ts;
    if (state.spatial && app.record) {
      audio.tracks.terrain.setSpatialAngle(globe.bearingTo(app.record.label?.lng ?? 0));
      audio.tracks.climate.setSpatialAngle(globe.bearingTo((app.compare || app.record).label?.lng ?? 0));
    }
  }
  if (ts - vizLast > 33) {
    vizLast = ts;
    ['terrain', 'climate'].forEach((kind) => {
      const ui = trackUI[kind];
      const tr = audio.tracks[kind];
      if (!ui?.viz) return;
      const n = tr.analyser?.fftSize || 1024;
      if (!vizBuffers[kind] || vizBuffers[kind].length !== n) vizBuffers[kind] = new Uint8Array(n);
      const data = tr.playing ? tr.waveform(vizBuffers[kind]) : null;
      drawWaveform(ui.viz, data, kind === 'terrain' ? '#FF8A00' : '#00E5FF', !tr.playing);
    });
  }
  requestAnimationFrame(vizLoop);
}

/* ------------------------------- Search ---------------------------------- */
let searchResults = [];
let searchIndex = -1;

function runSearch() {
  const q = dom.search.value.trim();
  dom.searchWrap.classList.toggle('has-query', !!q);
  if (!q) { closeSearch(); return; }
  searchResults = searchCountries(app.features, q, fold, 9);
  searchIndex = searchResults.length ? 0 : -1;
  renderSearchResults();
}

function renderSearchResults() {
  const q = dom.search.value.trim();
  dom.results.hidden = false;
  dom.search.setAttribute('aria-expanded', 'true');
  if (!searchResults.length) {
    dom.results.innerHTML = `<li class="empty" role="option" aria-disabled="true">${escapeHtml(t('searchNoResults'))}</li>`;
    return;
  }
  dom.results.innerHTML = searchResults.map((f, i) => `<li role="option" id="sr-${i}" data-i="${i}" aria-selected="${i === searchIndex}">
      <span class="flag" aria-hidden="true">${flagSafe(f)}</span>
      <span>${escapeHtml(f.__name[state.lang] || f.__name.vi)}</span>
      <span class="code">${escapeHtml(f.__code)}</span>
    </li>`).join('');
}

function flagSafe(f) {
  const code = f.__code;
  if (!/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...code.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function closeSearch() {
  dom.results.hidden = true;
  dom.search.setAttribute('aria-expanded', 'false');
  dom.search.removeAttribute('aria-activedescendant');
  searchIndex = -1;
}

function pickResult(index) {
  const feature = searchResults[index];
  if (!feature) return;
  dom.search.value = feature.__name[state.lang] || feature.__name.vi;
  dom.searchWrap.classList.add('has-query');
  closeSearch();
  selectCountry(feature, null);
}

/* ------------------------------- Sheets ---------------------------------- */
function setSheet(next) {
  app.sheet = next;
  dom.panel.dataset.sheet = next;
}
function cycleSheet() {
  if (app.sheet === 'peek') setSheet('mid');
  else if (app.sheet === 'mid') setSheet('full');
  else setSheet('peek');
}
function setDockOpen(open) {
  app.dockOpen = open;
  dom.dock.dataset.open = String(open);
  dom.dockToggle?.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('dock-open', open);
  if (open) setSheet('peek');
}

/* ---------------------------- UI bindings -------------------------------- */
function bindUI() {
  // tìm kiếm
  dom.search.addEventListener('input', debounce(runSearch, 140));
  dom.search.addEventListener('focus', () => { if (dom.search.value.trim()) runSearch(); });
  dom.search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!searchResults.length) return;
      searchIndex = (searchIndex + 1) % searchResults.length;
      renderSearchResults();
      dom.search.setAttribute('aria-activedescendant', `sr-${searchIndex}`);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!searchResults.length) return;
      searchIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
      renderSearchResults();
      dom.search.setAttribute('aria-activedescendant', `sr-${searchIndex}`);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Người dùng có thể nhấn Enter nhanh hơn debounce → chạy tìm ngay.
      if (!searchResults.length) runSearch();
      if (searchResults.length) pickResult(Math.max(0, searchIndex));
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  });
  dom.results.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) pickResult(Number(li.dataset.i));
  });
  dom.searchClear.addEventListener('click', () => {
    dom.search.value = '';
    dom.search.focus();
    dom.searchWrap.classList.remove('has-query');
    closeSearch();
  });
  document.addEventListener('click', (e) => {
    if (!dom.searchWrap.contains(e.target)) closeSearch();
  });

  // thanh công cụ
  $('#random-btn').addEventListener('click', randomCountry);
  $('#reset-btn').addEventListener('click', () => {
    globe.resetView();
    hideTooltip();
  });
  $('#help-btn').addEventListener('click', openOnboarding);
  $$('.lang-switch [data-lang]').forEach((btn) => btn.addEventListener('click', () => setLang(btn.dataset.lang)));

  // track controls
  Object.entries(trackUI).forEach(([kind, ui]) => {
    ui.root.addEventListener('pointerdown', () => { state.activeTrack = kind; updateTrackShells(); });
    ui.root.addEventListener('focusin', () => { state.activeTrack = kind; updateTrackShells(); });
    $$('[data-act]', ui.root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = audio.tracks[kind];
        const act = btn.dataset.act;
        if (act !== 'mute') {
          if (!tr.profile) { toast(t('selectCountryFirst'), 'warn'); return; }
          if (!ensureAudio()) return;
        }
        switch (act) {
          case 'toggle': toggleTrack(kind); break;
          case 'stop': tr.stop(); updateTrackShells(); syncTransport(); break;
          case 'restart': tr.restart(); updateTrackShells(); break;
          case 'back': tr.seekBy(-10); syncTransport(); break;
          case 'fwd': tr.seekBy(10); syncTransport(); break;
          case 'mute':
            tr.setMuted(!tr.muted);
            updateTrackShells();
            break;
          default: break;
        }
      });
    });
    ui.seek.addEventListener('pointerdown', () => { ui.dragging = true; });
    ui.seek.addEventListener('input', () => {
      ui.seek.style.setProperty('--fill', `${(Number(ui.seek.value) / 60) * 100}%`);
      ui.time.textContent = `${fmtTime(ui.seek.value)} / ${fmtTime(60)}`;
    });
    ui.seek.addEventListener('change', () => {
      audio.ensure();
      audio.tracks[kind].seekTo(Number(ui.seek.value));
      ui.dragging = false;
      syncTransport();
    });
    ui.vol.addEventListener('input', () => {
      audio.ensure();
      audio.tracks[kind].setVolume(Number(ui.vol.value) / 100);
      ui.volVal.textContent = `${ui.vol.value}%`;
      ui.vol.style.setProperty('--fill', `${ui.vol.value}%`);
    });
  });

  // master volume
  const master = $('#master-vol');
  master.addEventListener('input', () => { audio.setMaster(Number(master.value) / 100); updateMasterUI(); });
  $('#master-mute').addEventListener('click', () => {
    audio.muteAll(!audio.muted);
    updateMasterUI();
  });

  // phòng thử âm thanh
  const labToggle = $('#lab-toggle');
  labToggle?.addEventListener('click', () => {
    const open = labToggle.getAttribute('aria-expanded') !== 'true';
    labToggle.setAttribute('aria-expanded', String(open));
    $('#lab-bar')?.classList.toggle('is-open', open);
    const body = $('#lab-body');
    if (body) body.inert = !open;
  });
  $('#lab-scale')?.addEventListener('change', (e) => { state.scale = e.target.value; applyLab(); });
  $('#lab-instrument')?.addEventListener('change', (e) => { state.instrument = e.target.value; applyLab(); });
  $('#lab-tempo')?.addEventListener('input', (e) => {
    state.tempo = Math.min(1.6, Math.max(0.6, Number(e.target.value) / 100));
    $('#lab-tempo-out').textContent = `${e.target.value}%`;
    e.target.style.setProperty('--fill', `${((Number(e.target.value) - 60) / 100) * 100}%`);
    audio.setTempo(state.tempo);
  });
  $('#hazard-range')?.addEventListener('change', (e) => {
    state.hazardDays = Number(e.target.value) || 365;
    if (app.record?.extras) app.record.extras.hazards = null;
    if (state.layers.hazards) ensureLayerData(); else updateLayerStatus();
  });

  ['climate', 'hazards', 'bio', 'weather'].forEach((key) => {
    $(`#layer-${key}`)?.addEventListener('change', (e) => {
      state.layers[key] = e.target.checked;
      updateLayerStatus();
      if (key === 'weather') {
        rebuildTracks(true);
      } else if (state.layers[key]) {
        ensureLayerData();
      } else {
        rebuildTracks(true);
      }
    });
  });

  $('#lab-save')?.addEventListener('click', () => {
    try {
      localStorage.setItem(LAB_KEY, JSON.stringify({ scale: state.scale, tempo: state.tempo, instrument: state.instrument, layers: state.layers, hazardDays: state.hazardDays }));
      setLabStatus(t('labSaved'));
    } catch (err) {
      setLabStatus(t('labShareFail'));
    }
  });
  $('#lab-share')?.addEventListener('click', async () => {
    const url = new URL(location.href);
    url.searchParams.set('scale', state.scale);
    url.searchParams.set('tempo', String(Math.round(state.tempo * 100)));
    url.searchParams.set('instr', state.instrument);
    url.searchParams.set('season', String(state.season));
    url.searchParams.set('layers', Object.entries(state.layers).filter(([, on]) => on).map(([k]) => k).join(','));
    url.searchParams.set('hazardDays', String(state.hazardDays));
    history.replaceState(null, '', url);
    setLabStatus(t('labShareLink'));
    try {
      const copy = navigator.clipboard?.writeText(url.toString());
      if (copy && typeof copy.then === 'function') {
        copy.then(() => setLabStatus(t('labShared'))).catch(() => setLabStatus(t('labShareFail')));
      } else {
        setLabStatus(t('labShareFail'));
      }
    } catch (err) {
      setLabStatus(t('labShareFail'));
    }
  });

  // âm thanh không gian
  $('#spatial-toggle')?.addEventListener('click', () => {
    state.spatial = !state.spatial;
    audio.setSpatial(state.spatial);
    syncSpatialButton();
    toast(state.spatial ? t('spatialOn') : t('spatialOff'), 'ok', 5000);
    announce(state.spatial ? t('spatialOn') : t('spatialOff'));
  });

  // mùa cho track khí hậu
  const seasonRange = $('#season-range');
  seasonRange?.addEventListener('input', () => setSeason(Number(seasonRange.value)));

  // tooltip theo con trỏ
  dom.stage.addEventListener('mousemove', (e) => positionTooltip(e.clientX, e.clientY));
  dom.stage.addEventListener('touchmove', (e) => {
    const t0 = e.touches[0];
    if (t0) positionTooltip(t0.clientX, t0.clientY);
  }, { passive: true });
  dom.stage.addEventListener('mouseleave', hideTooltip);

  // mobile sheet
  $('#sheet-handle').addEventListener('click', cycleSheet);
  let dragStart = null;
  const handle = $('#sheet-handle');
  handle.addEventListener('pointerdown', (e) => { dragStart = e.clientY; handle.setPointerCapture?.(e.pointerId); });
  handle.addEventListener('pointerup', (e) => {
    if (dragStart == null) return;
    const dy = e.clientY - dragStart;
    dragStart = null;
    if (dy < -30) setSheet(app.sheet === 'peek' ? 'mid' : 'full');
    else if (dy > 30) setSheet(app.sheet === 'full' ? 'mid' : 'peek');
  });

  // mobile dock
  dom.dockToggle?.addEventListener('click', () => setDockOpen(!app.dockOpen));
  dom.miniTransport?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mini]');
    if (!btn) return;
    toggleTrack(btn.dataset.mini);
  });

  // onboarding
  $('#onb-start').addEventListener('click', () => { closeOnboarding(); ensureAudio(); });
  $('#onb-skip').addEventListener('click', closeOnboarding);

  // phím tắt toàn cục
  window.addEventListener('keydown', onGlobalKeydown);
  window.addEventListener('resize', debounce(() => { if (app.expanded) drawCharts(); }, 200));
}

function updateMasterUI() {
  const master = $('#master-vol');
  if (master) {
    master.value = String(Math.round(audio.masterVolume * 100));
    master.style.setProperty('--fill', `${Math.round(audio.masterVolume * 100)}%`);
  }
  const btn = $('#master-mute');
  if (btn) {
    btn.setAttribute('aria-pressed', String(audio.muted));
    btn.querySelector('use')?.setAttribute('href', audio.muted ? '#i-mute' : '#i-vol');
  }
}

function onGlobalKeydown(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;
  if (typing) return;
  // Để trình duyệt tự xử lý Space trên button/link (tránh kích hoạt kép).
  if (e.code === 'Space' && e.target.closest?.('button, a, summary, [role="button"]')) return;
  if (e.key === '/') { e.preventDefault(); dom.search.focus(); return; }
  if (e.key === 'Escape') { closeOnboarding(); closeSearch(); setDockOpen(false); return; }
  if (e.code === 'Space') {
    e.preventDefault();
    toggleTrack(state.activeTrack);
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const tr = activeTrack();
    if (!tr.profile) { toast(t('selectCountryFirst'), 'warn'); return; }
    ensureAudio();
    const delta = e.key === 'ArrowLeft' ? -10 : 10;
    tr.seekBy(delta);
    syncTransport();
    announce(`${t('seekTerrain')} ${fmtTime(tr.getPosition())}`);
    return;
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    const tr = activeTrack();
    const delta = e.key === 'ArrowUp' ? 0.05 : -0.05;
    tr.setVolume(Math.min(1, Math.max(0, tr.volume + delta)));
    syncTransport();
    announce(`${Math.round(tr.volume * 100)}%`);
    return;
  }
  if (e.key.toLowerCase() === 'r') { randomCountry(); }
}

/* -------------------------------- Lang ----------------------------------- */
function setLang(lang) {
  if (!['vi', 'en'].includes(lang) || state.lang === lang) return;
  state.lang = lang;
  saveLang(lang);
  applyStaticI18n();
  updateLangButtons();
  if (app.statusMode === 'ready') setStatus(t('statusReady'));
  else if (app.statusMode === 'offline') setStatus(t('statusOffline'), { offline: true });
  updateTrackSources();
  updateTrackShells();
  syncSeasonUI();
  updateLayerStatus();
  if (app.record) {
    app.record.summaryText = terrainShortSummary(app.record, state.lang);
    const compareName = app.compare ? (app.compare.name[state.lang] || app.compare.name.vi) : '';
    dom.panelContent.innerHTML = renderPanel(app.record, { expanded: app.expanded, compare: compareName });
    bindDetailsToggle();
    $('#compare-btn')?.addEventListener('click', toggleCompare);
    const body = $('#details-body');
    if (body) body.style.maxHeight = app.expanded ? 'none' : '0px';
    dom.badge.textContent = app.record.name[lang] || app.record.name.vi;
    if (app.expanded) setTimeout(drawCharts, 120);
  }
  closeSearch();
  updateMiniTransport();
  announce(t('languageName'));
}

function updateLangButtons() {
  $$('.lang-switch [data-lang]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.lang === state.lang)));
}

/* -------------------------------- Misc ----------------------------------- */
function randomCountry() {
  if (!app.features.length) { toast(t('loadingCountries'), 'warn'); return; }
  const pool = app.features.filter((f) => f.properties?.TYPE !== 'Dependency' || Math.random() < 0.25);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return;
  toast(t('randomToast', { name: pick.__name[state.lang] || pick.__name.vi }), 'ok', 2600);
  selectCountry(pick, null);
}

function updateDockNow(feature) {
  const el = $('#dock-now');
  if (!el) return;
  if (!feature) { el.innerHTML = ''; return; }
  const name = feature.__name?.[state.lang] || feature.__name?.vi || '';
  el.innerHTML = `<svg aria-hidden="true" style="width:11px;height:11px"><use href="#i-pin"/></svg><strong>${escapeHtml(name)}</strong>`;
}

let toastTimer = 0;
function toast(message, kind = 'warn', ms = 4200) {
  const stack = $('#toasts');
  if (!stack || !message) return;
  const node = document.createElement('div');
  node.className = 'toast';
  node.dataset.kind = kind;
  node.innerHTML = `<svg aria-hidden="true"><use href="${kind === 'ok' ? '#i-info' : '#i-info'}"/></svg><span>${escapeHtml(message)}</span>`;
  stack.append(node);
  setTimeout(() => node.remove(), ms);
}

/* ------------------------------ Onboarding -------------------------------- */
function startOnboardingIfNeeded() {
  const done = localStorage.getItem('etl.onboarded') === '1';
  dom.onboarding.dataset.open = done ? 'false' : 'true';
  dom.onboarding.setAttribute('aria-hidden', String(done));
  if (!done) setTimeout(() => $('#onb-start')?.focus(), 250);
}
function openOnboarding() {
  dom.onboarding.dataset.open = 'true';
  dom.onboarding.setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#onb-start')?.focus(), 120);
}
function closeOnboarding() {
  if (dom.onboarding.dataset.open !== 'true') return;
  dom.onboarding.dataset.open = 'false';
  dom.onboarding.setAttribute('aria-hidden', 'true');
  localStorage.setItem('etl.onboarded', '1');
  ensureAudio();
}

/* ------------------------------- Stars ----------------------------------- */
function setupStars() {
  const canvas = $('#starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const resize = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    const count = Math.round((window.innerWidth * window.innerHeight) / 9000);
    stars = Array.from({ length: Math.min(260, Math.max(70, count)) }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: (Math.random() * 1.3 + 0.25) * dpr,
      a: Math.random() * 0.55 + 0.18,
      speed: Math.random() * 0.0016 + 0.0007,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.16 ? '198,255,255' : Math.random() < 0.3 ? '255,190,235' : '235,242,255'
    }));
  };
  resize();
  window.addEventListener('resize', debounce(resize, 250));

  const draw = (now) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach((s) => {
      const alpha = reduced ? s.a : s.a * (0.55 + 0.45 * Math.sin(now * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.hue},${alpha})`;
      ctx.fill();
    });
    if (!reduced) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}

/* --------------------------- Loader / reveal ------------------------------ */
let globeReady = false;
function revealWhenReady(what) {
  if (what === 'globe') globeReady = true;
  if (globeReady) {
    setTimeout(() => { dom.loader.dataset.done = 'true'; }, 380);
  }
}

/* ------------------------------- Resize ---------------------------------- */
window.addEventListener('orientationchange', () => setTimeout(syncTransport, 250));

/* Tay nắm debug (hữu ích khi kiểm thử/trình diễn; không ảnh hưởng UI). */
window.__etl = { app, audio, globe, state, selectCountry };
