/* =============================================================================
 * i18n.js — Song ngữ Việt / Anh + tiện ích dùng chung
 * Mọi chuỗi giao diện nằm ở đây. Thuộc tính data-i18n trong HTML sẽ được dịch
 * tự động qua applyStaticI18n(). Tên quốc gia lấy từ Natural Earth (NAME_VI).
 * ========================================================================== */

export const STRINGS = {
  vi: {
    searchLabel: 'Tìm quốc gia hoặc lãnh thổ',
    searchPlaceholder: 'Tìm quốc gia… (vd: Việt Nam, Nhật, Kenya)',
    clearSearch: 'Xoá tìm kiếm',
    random: 'Khám phá ngẫu nhiên',
    resetView: 'Vị trí ban đầu',
    helpAria: 'Hướng dẫn sử dụng',
    globeAria: 'Quả địa cầu 3D tương tác',
    legendTitle: 'Chú giải',
    legendDay: 'Ban ngày',
    legendNight: 'Đèn đêm',
    legendHover: 'Quốc gia đang trỏ',
    dragHint: 'Kéo để xoay · cuộn để thu phóng · chạm để chọn quốc gia',
    loadingTitle: 'Đang lắp ráp Trái Đất',
    loadingBody: 'Tải ảnh vệ tinh NASA · ranh giới Natural Earth · dữ liệu thời tiết Open-Meteo…',
    panelAria: 'Thông tin quốc gia',
    sheetHandle: 'Kéo để mở hoặc thu gọn bảng thông tin',
    panelTitle: 'Hồ sơ Trái Đất',
    panelSub: 'Chọn một quốc gia trên địa cầu',
    emptyTitle: 'Trái Đất đang chờ bạn lắng nghe',
    emptyBody: 'Xoay quả địa cầu, tìm một quốc gia rồi nhấn vào để nghe địa hình và khí hậu của nơi đó.',
    emptyExtra: 'Mẹo: dùng phím / để tìm nhanh, hoặc nút “Khám phá ngẫu nhiên”.',
    dockAria: 'Bảng điều khiển âm thanh',
    audioTitle: 'Phòng nghe Trái Đất',
    keyPlay: 'phát/dừng',
    keySeek: 'tua 10s',
    keyVol: 'âm lượng',
    masterVol: 'Tổng',
    masterMute: 'Tắt tiếng toàn bộ',
    trackTerrain: 'Âm thanh địa hình',
    trackTerrainSub: 'Độ cao · độ gồ ghề · rừng · biển · sông',
    trackClimate: 'Âm thanh khí hậu',
    trackClimateSub: 'Nhiệt độ · gió · mưa · độ ẩm · mây',
    stateIdle: 'Chờ chọn',
    stateReady: 'Sẵn sàng',
    statePlaying: 'Đang phát',
    statePaused: 'Tạm dừng',
    transportTerrain: 'Điều khiển track địa hình',
    transportClimate: 'Điều khiển track khí hậu',
    restart: 'Phát lại từ đầu',
    back: 'Tua lại 10 giây',
    fwd: 'Tua tới 10 giây',
    play: 'Phát',
    pause: 'Tạm dừng',
    stop: 'Dừng hẳn',
    seekTerrain: 'Tiến trình track địa hình',
    seekClimate: 'Tiến trình track khí hậu',
    muteTerrain: 'Tắt tiếng track địa hình',
    muteClimate: 'Tắt tiếng track khí hậu',
    volTerrain: 'Âm lượng track địa hình',
    volClimate: 'Âm lượng track khí hậu',
    onbEyebrow: 'NASA Space Apps Challenge · Lắng nghe Trái Đất',
    onbTitle: 'Mỗi quốc gia có một giọng nói riêng',
    onbLead: 'Ứng dụng biến dữ liệu địa hình và khí hậu thật thành âm thanh. Người khiếm thị có thể “nghe” Trái Đất; người nhìn thấy có thể khám phá bằng mắt và tai cùng lúc.',
    onbStep1Title: 'Chọn một quốc gia',
    onbStep1Body: 'Kéo xoay quả địa cầu, cuộn để phóng to, hoặc gõ tên quốc gia vào ô tìm kiếm (hỗ trợ tiếng Việt có dấu).',
    onbStep2Title: 'Nghe hai lớp âm thanh',
    onbStep2Body: 'Track A kể về núi, đồng bằng, rừng và biển. Track B kể về nắng, gió, mưa và mây của thời tiết hiện tại.',
    onbStep3Title: 'Điều khiển bằng bàn phím',
    onbStep3Body: 'Space phát/dừng, ←/→ tua 10 giây, ↑/↓ chỉnh âm lượng. Mọi nút đều có nhãn cho trình đọc màn hình.',
    onbNote: 'Trình duyệt chỉ cho phát âm thanh sau khi bạn tương tác. Nhấn “Bắt đầu nghe” để mở khoá âm thanh.',
    onbSkip: 'Bỏ qua',
    onbStart: 'Bắt đầu nghe',
    statusLoading: 'Đang tải dữ liệu Trái Đất…',
    statusReady: 'Dữ liệu trực tiếp · NASA & Open-Meteo',
    statusOffline: 'Đang dùng dữ liệu dự phòng',
    loadingCountries: 'Đang tải ranh giới quốc gia…',
    searchNoResults: 'Không tìm thấy quốc gia phù hợp',
    searchHint: 'Dùng ↑ ↓ để chọn, Enter để bay tới',
    capital: 'Thủ đô',
    center: 'Tâm quốc gia',
    clicked: 'Điểm đã chọn',
    weatherNow: 'Thời tiết hiện tại',
    details: 'Xem chi tiết',
    collapse: 'Thu gọn',
    terrain: 'Địa hình',
    terrainSummaryTitle: 'Đặc điểm địa hình',
    elevation: 'Độ cao',
    highest: 'Cao nhất',
    lowest: 'Thấp nhất',
    average: 'Trung bình',
    peak: 'Đỉnh núi cao nhất',
    distribution: 'Phân bố địa hình',
    climateChart: 'Khí hậu 12 tháng',
    forecast: 'Dự báo 7 ngày',
    koppen: 'Kiểu khí hậu Köppen',
    sources: 'Nguồn dữ liệu',
    offlineNotice: 'Không kết nối được API — đang hiển thị dữ liệu dự phòng cho quốc gia này.',
    estimate: 'ước tính',
    retry: 'Thử lại',
    loadingData: 'Đang tải dữ liệu quốc gia…',
    errorTitle: 'Chưa tải được dữ liệu',
    errorBody: 'Kết nối tới máy chủ dữ liệu bị gián đoạn. Bạn vẫn có thể nghe mô hình địa hình ước tính.',
    noData: 'Chưa có dữ liệu',
    temp: 'Nhiệt độ',
    wind: 'Gió',
    rain: 'Mưa',
    humidity: 'Độ ẩm',
    uv: 'Chỉ số UV',
    cloud: 'Mây',
    feelsLike: 'Cảm giác như',
    sunrise: 'Mặt trời mọc',
    sunset: 'Mặt trời lặn',
    annualTemp: 'Nhiệt độ TB năm',
    annualRain: 'Lượng mưa năm',
    forest: 'Rừng',
    water: 'Sông hồ & biển',
    desertShare: 'Sa mạc',
    mountainShare: 'Núi',
    hill: 'Đồi',
    plain: 'Đồng bằng',
    plateau: 'Cao nguyên',
    randomToast: 'Đang đưa bạn tới {name}…',
    offlineToast: 'API đang lỗi — dùng dữ liệu dự phòng cho {name}',
    errorToast: 'Không tải được dữ liệu thời tiết cho {name}. Bạn vẫn nghe được track địa hình.',
    audioLocked: 'Nhấn phát để bật âm thanh',
    keyboardTrack: 'Kênh đang điều khiển: {name}',
    toastOfflineMode: 'Chế độ dự phòng: dữ liệu tĩnh',
    close: 'Đóng',
    viewDetail: 'Mở rộng',
    languageName: 'Tiếng Việt',
    selectCountryFirst: 'Hãy chọn một quốc gia trước',
    unitKm: 'km/h',
    unitMm: 'mm',
    unitM: 'm',
    unitC: '°C',
    landArea: 'Diện tích',
    population: 'Dân số',
    months: ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'],
    weekdays: ['CN','T2','T3','T4','T5','T6','T7'],
    values: 'Giá trị',
    creditShort: 'Ảnh vệ tinh NASA Blue/Black Marble · ETOPO · Natural Earth · Open-Meteo · NASA POWER',
    dockToggleAria: 'Mở hoặc thu gọn bảng điều khiển âm thanh',
    miniTransportAria: 'Điều khiển nhanh hai track',
    dataCredit: 'Dữ liệu: NASA Blue Marble / Black Marble / ETOPO · Natural Earth · Open-Meteo · NASA POWER · REST Countries',
    season: 'Mùa',
    seasonAria: 'Chọn tháng để nghe khí hậu theo mùa',
    seasonAnnual: 'Cả năm',
    seasonValue: 'Tháng {month}',
    compareAdd: 'So sánh với nơi khác',
    compareClear: 'Bỏ so sánh',
    comparePicking: 'Đang chọn nơi thứ hai…',
    comparePick: 'Chọn quốc gia thứ hai trên địa cầu để ghép vào track B.',
    compareCancel: 'Đã huỷ chọn nơi so sánh',
    compareReady: 'Track B giờ là khí hậu của {name}',
    compareOff: 'Đã bỏ so sánh, track B trở lại nơi đang chọn',
    spatial: 'Không gian',
    spatialAria: 'Bật hoặc tắt âm thanh không gian theo hướng địa điểm',
    spatialOn: 'Đã bật âm thanh không gian — xoay địa cầu để nghe hướng',
    spatialOff: 'Đã tắt âm thanh không gian',
    labTitle: 'Phòng thử âm thanh',
    labHint: 'Thang âm · nhịp · nhạc cụ',
    labScale: 'Thang âm',
    labTempo: 'Nhịp',
    labInstrument: 'Nhạc cụ',
    labSave: 'Lưu preset',
    labShare: 'Chia sẻ',
    labSaved: 'Đã lưu preset trên thiết bị này',
    labShared: 'Đã sao chép liên kết preset',
    labShareLink: 'Đã cập nhật liên kết trên thanh địa chỉ',
    labShareFail: 'Không sao chép được — liên kết đã được cập nhật trên thanh địa chỉ',
    scaleAuto: 'Tự động',
    scalePentatonic: 'Ngũ cung',
    scaleMajor: 'Trưởng',
    scaleMinor: 'Thứ',
    scaleDorian: 'Dorian',
    instAuto: 'Theo vùng',
    instPluck: 'Chuông điện',
    instDanTranh: 'Đàn tranh',
    instDanBau: 'Đàn bầu',
    instSao: 'Sáo',
    instDrum: 'Trống',
    layerGroup: 'Lớp dữ liệu',
    layerClimate: 'Biến đổi khí hậu',
    layerHazards: 'Thiên tai',
    layerBio: 'Sinh quyển',
    layerWeather: 'Thời tiết hiện tại',
    layerLoading: 'Đang tải lớp dữ liệu…',
    layerError: 'Không tải được một lớp dữ liệu — lớp đó đang tắt tiếng.',
    layerClimateStatus: '{d}°C so với 1981–2010',
    layerHazardsStatus: '{n} động đất · {e} sự kiện',
    layerBioStatus: 'Rừng {f}% · {d}/km²',
    layerWeatherStatus: 'Thời tiết cập nhật {time}',
    hazardWindow: 'Cửa sổ',
    days30: '30 ngày',
    days90: '90 ngày',
    days365: '1 năm'
  },
  en: {
    searchLabel: 'Search for a country or territory',
    searchPlaceholder: 'Search countries… (e.g. Vietnam, Japan, Kenya)',
    clearSearch: 'Clear search',
    random: 'Random discovery',
    resetView: 'Reset view',
    helpAria: 'How to use',
    globeAria: 'Interactive 3D globe',
    legendTitle: 'Legend',
    legendDay: 'Daylight',
    legendNight: 'City lights',
    legendHover: 'Hovered country',
    dragHint: 'Drag to rotate · scroll to zoom · tap to select a country',
    loadingTitle: 'Assembling Earth',
    loadingBody: 'Loading NASA satellite imagery · Natural Earth borders · Open-Meteo weather…',
    panelAria: 'Country information',
    sheetHandle: 'Drag to expand or collapse the information panel',
    panelTitle: 'Earth profile',
    panelSub: 'Select a country on the globe',
    emptyTitle: 'Earth is waiting to be heard',
    emptyBody: 'Spin the globe, find a country and press it to hear its terrain and climate.',
    emptyExtra: 'Tip: press / to search, or try “Random discovery”.',
    dockAria: 'Audio control panel',
    audioTitle: 'Earth listening room',
    keyPlay: 'play/pause',
    keySeek: 'seek 10s',
    keyVol: 'volume',
    masterVol: 'Master',
    masterMute: 'Mute everything',
    trackTerrain: 'Terrain soundscape',
    trackTerrainSub: 'Elevation · roughness · forest · ocean · rivers',
    trackClimate: 'Climate soundscape',
    trackClimateSub: 'Temperature · wind · rain · humidity · cloud',
    stateIdle: 'No country',
    stateReady: 'Ready',
    statePlaying: 'Playing',
    statePaused: 'Paused',
    transportTerrain: 'Terrain track controls',
    transportClimate: 'Climate track controls',
    restart: 'Restart from the beginning',
    back: 'Rewind 10 seconds',
    fwd: 'Forward 10 seconds',
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    seekTerrain: 'Terrain track progress',
    seekClimate: 'Climate track progress',
    muteTerrain: 'Mute terrain track',
    muteClimate: 'Mute climate track',
    volTerrain: 'Terrain track volume',
    volClimate: 'Climate track volume',
    onbEyebrow: 'NASA Space Apps Challenge · Earth Listens',
    onbTitle: 'Every country has its own voice',
    onbLead: 'This app turns real terrain and climate data into sound. Blind and low-vision visitors can hear the Earth; sighted visitors can explore with eyes and ears together.',
    onbStep1Title: 'Pick a country',
    onbStep1Body: 'Drag the globe, scroll to zoom, or type a country name — Vietnamese names with diacritics are supported.',
    onbStep2Title: 'Listen to two layers',
    onbStep2Body: 'Track A tells the story of mountains, plains, forests and coastlines. Track B carries today’s sun, wind, rain and cloud.',
    onbStep3Title: 'Drive it from the keyboard',
    onbStep3Body: 'Space plays/pauses, ←/→ seek 10 seconds, ↑/↓ change volume. Every control has a screen-reader label.',
    onbNote: 'Browsers only allow audio after a user gesture. Press “Start listening” to unlock sound.',
    onbSkip: 'Skip',
    onbStart: 'Start listening',
    statusLoading: 'Loading Earth data…',
    statusReady: 'Live data · NASA & Open-Meteo',
    statusOffline: 'Using fallback data',
    loadingCountries: 'Loading country borders…',
    searchNoResults: 'No matching country found',
    searchHint: 'Use ↑ ↓ to choose, Enter to fly there',
    capital: 'Capital',
    center: 'Country centre',
    clicked: 'Selected point',
    weatherNow: 'Current weather',
    details: 'See details',
    collapse: 'Collapse',
    terrain: 'Terrain',
    terrainSummaryTitle: 'Terrain summary',
    elevation: 'Elevation',
    highest: 'Highest',
    lowest: 'Lowest',
    average: 'Average',
    peak: 'Highest peak',
    distribution: 'Terrain composition',
    climateChart: '12-month climate',
    forecast: '7-day forecast',
    koppen: 'Köppen climate type',
    sources: 'Data sources',
    offlineNotice: 'APIs are unreachable — showing the bundled fallback profile for this country.',
    estimate: 'estimated',
    retry: 'Retry',
    loadingData: 'Loading country data…',
    errorTitle: 'Data unavailable',
    errorBody: 'The data service could not be reached. You can still hear the modelled terrain profile.',
    noData: 'No data yet',
    temp: 'Temperature',
    wind: 'Wind',
    rain: 'Rain',
    humidity: 'Humidity',
    uv: 'UV index',
    cloud: 'Cloud',
    feelsLike: 'Feels like',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    annualTemp: 'Annual mean temp',
    annualRain: 'Annual rainfall',
    forest: 'Forest',
    water: 'Rivers & sea',
    desertShare: 'Desert',
    mountainShare: 'Mountains',
    hill: 'Hills',
    plain: 'Plains',
    plateau: 'Plateaus',
    randomToast: 'Flying you to {name}…',
    offlineToast: 'API error — using the fallback profile for {name}',
    errorToast: 'Could not load weather for {name}. Terrain sound is still available.',
    audioLocked: 'Press play to enable sound',
    keyboardTrack: 'Controlling channel: {name}',
    toastOfflineMode: 'Fallback mode: bundled data',
    close: 'Close',
    viewDetail: 'Expand',
    languageName: 'English',
    selectCountryFirst: 'Choose a country first',
    unitKm: 'km/h',
    unitMm: 'mm',
    unitM: 'm',
    unitC: '°C',
    landArea: 'Area',
    population: 'Population',
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    weekdays: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    values: 'Value',
    creditShort: 'NASA Blue/Black Marble imagery · ETOPO · Natural Earth · Open-Meteo · NASA POWER',
    dockToggleAria: 'Expand or collapse the audio panel',
    miniTransportAria: 'Quick controls for both tracks',
    dataCredit: 'Data: NASA Blue Marble / Black Marble / ETOPO · Natural Earth · Open-Meteo · NASA POWER · REST Countries',
    season: 'Season',
    seasonAria: 'Choose a month to hear the seasonal climate',
    seasonAnnual: 'All year',
    seasonValue: 'Month {month}',
    compareAdd: 'Compare with another place',
    compareClear: 'Clear comparison',
    comparePicking: 'Pick the second place…',
    comparePick: 'Choose a second country on the globe to load into track B.',
    compareCancel: 'Comparison pick cancelled',
    compareReady: 'Track B now carries the climate of {name}',
    compareOff: 'Comparison cleared; track B is back to the selected country',
    spatial: 'Spatial',
    spatialAria: 'Toggle spatial audio oriented to the place direction',
    spatialOn: 'Spatial audio on — rotate the globe to hear the direction',
    spatialOff: 'Spatial audio off',
    labTitle: 'Sound lab',
    labHint: 'Scale · tempo · instrument',
    labScale: 'Scale',
    labTempo: 'Tempo',
    labInstrument: 'Instrument',
    labSave: 'Save preset',
    labShare: 'Share',
    labSaved: 'Preset saved on this device',
    labShared: 'Preset link copied',
    labShareLink: 'Link updated in the address bar',
    labShareFail: 'Could not copy — the link was updated in the address bar',
    scaleAuto: 'Auto',
    scalePentatonic: 'Pentatonic',
    scaleMajor: 'Major',
    scaleMinor: 'Minor',
    scaleDorian: 'Dorian',
    instAuto: 'By region',
    instPluck: 'Electric bell',
    instDanTranh: 'Zither',
    instDanBau: 'Monochord',
    instSao: 'Flute',
    instDrum: 'Drum',
    layerGroup: 'Data layers',
    layerClimate: 'Climate change',
    layerHazards: 'Hazards',
    layerBio: 'Biosphere',
    layerWeather: 'Current weather',
    layerLoading: 'Loading data layers…',
    layerError: 'A data layer could not load — it is muted.',
    layerClimateStatus: '{d}°C vs 1981–2010',
    layerHazardsStatus: '{n} quakes · {e} events',
    layerBioStatus: 'Forest {f}% · {d}/km²',
    layerWeatherStatus: 'Weather updated {time}',
    hazardWindow: 'Window',
    days30: '30 days',
    days90: '90 days',
    days365: '1 year'
  }
};

function initialLang() {
  try {
    const saved = localStorage.getItem('etl.lang');
    if (saved === 'vi' || saved === 'en') return saved;
  } catch (e) { /* chế độ riêng tư */ }
  // Mặc định tiếng Việt cho cuộc thi; người dùng có thể chuyển sang EN.
  return 'vi';
}

export const state = {
  lang: initialLang(),
  countries: [],
  selected: null,       // country feature
  record: null,         // normalised country profile
  activeTrack: 'terrain',
  season: 0,            // 0 = trung bình năm, 1..12 = tháng
  spatial: false,
  scale: 'auto',
  tempo: 1,
  instrument: 'auto',
  layers: { climate: false, hazards: false, bio: false, weather: true },
  hazardDays: 365,
  loading: false,
  offline: false,
  panelExpanded: false,
  onboarded: (() => { try { return localStorage.getItem('etl.onboarded') === '1'; } catch (e) { return false; } })()
};

/** Dịch một khoá, hỗ trợ nội suy {name}. */
export function t(key, vars) {
  const dict = STRINGS[state.lang] || STRINGS.vi;
  let out = dict[key];
  if (out === undefined) out = STRINGS.vi[key] !== undefined ? STRINGS.vi[key] : key;
  if (vars && typeof out === 'string') {
    out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  }
  return out;
}

export function monthNames() { return t('months'); }

/** Dịch toàn bộ phần tử tĩnh có data-i18n / data-i18n-attr. */
export function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (typeof val === 'string') el.innerHTML = val.replace(/<kbd>/g, '<kbd>');
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr').split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
  document.documentElement.lang = state.lang;
}

/* ----- Tiện ích ---------------------------------------------------------- */

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu. */
export function fold(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, p) => a + (b - a) * p;
export const round = (v, d = 0) => { const m = 10 ** d; return Math.round(v * m) / m; };
export const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
export const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtCoord(lat, lng) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lng).toFixed(2)}°${ew}`;
}

export function fmtNumber(n, lang = state.lang) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 }).format(n);
}

export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function debounce(fn, ms = 220) {
  let timer = 0;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((c) => {
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

/** Gọi API có timeout, trả JSON. */
export async function fetchJson(url, { timeout = 12000, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Mã cờ emoji từ ISO-3166 alpha-2. */
export function flagEmoji(code) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function setStatus(text, { offline = false } = {}) {
  const chip = document.getElementById('status-text');
  const dot = document.getElementById('status-dot');
  if (chip) chip.textContent = text;
  if (dot) dot.dataset.offline = String(!!offline);
}

export function announce(text) {
  const region = document.getElementById('live-region');
  if (region) { region.textContent = ''; setTimeout(() => { region.textContent = text; }, 40); }
}

export function saveLang(lang) { localStorage.setItem('etl.lang', lang); }
