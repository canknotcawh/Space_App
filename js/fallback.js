/* =============================================================================
 * fallback.js — Hồ sơ dự phòng đóng gói sẵn cho 8 quốc gia phổ biến.
 * Dùng khi cả Open-Meteo và NASA POWER đều không truy cập được. Số liệu mang
 * tính đại diện (khí hậu gần đúng theo tháng), đủ để minh hoạ âm thanh.
 * ========================================================================== */

const day = (tmax, tmin, precip, code, uv = null) => ({ date: '', code, tmax, tmin, precip, uv });
const week = (a, b, c, d, e, f, g) => [a, b, c, d, e, f, g];

export const FALLBACK_PROFILES = {
  VN: {
    weather: {
      temp: 24, feels: 26, humidity: 78, precip: 0, code: 2, cloud: 45, wind: 9, windDir: 120,
      isDay: true, uv: 7,
      daily: week(day(29, 21, 0, 1, 7), day(30, 22, 2, 3, 6), day(28, 21, 6, 61, 4), day(27, 20, 12, 63, 3), day(29, 21, 1, 2, 7), day(31, 22, 0, 0, 8), day(30, 22, 3, 80, 6))
    },
    climate: {
      temps: [17, 18, 21, 25, 28, 30, 30, 29, 28, 25, 22, 18],
      precips: [20, 25, 45, 90, 190, 240, 290, 320, 265, 130, 45, 20],
      annualT: 24.4, annualP: 1680, koppen: 'Cwa', source: 'fallback'
    },
    elevation: { avg: 400, max: 3143, min: 0, peakName: 'Fansipan', peakElev: 3143, samples: [], source: 'fallback' },
    terrain: { mountain: 0.31, plateau: 0.12, hill: 0.24, plain: 0.22, desert: 0.01, water: 0.1, forest: 0.42, relief: 3143 }
  },
  US: {
    weather: {
      temp: 14, feels: 13, humidity: 58, precip: 0, code: 1, cloud: 20, wind: 14, windDir: 250,
      isDay: true, uv: 4,
      daily: week(day(19, 7, 0, 1, 4), day(21, 9, 0, 0, 4), day(18, 8, 2, 3, 3), day(15, 5, 0, 1, 4), day(17, 6, 0, 2, 4), day(20, 8, 1, 61, 3), day(16, 4, 0, 1, 5))
    },
    climate: {
      temps: [2, 4, 9, 15, 20, 25, 28, 27, 23, 17, 11, 5],
      precips: [75, 70, 90, 85, 105, 100, 105, 95, 95, 90, 80, 80],
      annualT: 15.5, annualP: 1070, koppen: 'Cfa', source: 'fallback'
    },
    elevation: { avg: 760, max: 6190, min: 0, peakName: 'Denali', peakElev: 6190, samples: [], source: 'fallback' },
    terrain: { mountain: 0.29, plateau: 0.16, hill: 0.22, plain: 0.25, desert: 0.05, water: 0.03, forest: 0.34, relief: 6190 }
  },
  JP: {
    weather: {
      temp: 17, feels: 17, humidity: 66, precip: 0, code: 2, cloud: 40, wind: 12, windDir: 200,
      isDay: true, uv: 4,
      daily: week(day(20, 12, 0, 1, 4), day(21, 13, 0, 2, 3), day(19, 12, 4, 61, 2), day(18, 11, 0, 3, 3), day(20, 12, 0, 1, 4), day(22, 13, 1, 51, 3), day(21, 13, 0, 2, 4))
    },
    climate: {
      temps: [6, 7, 10, 15, 20, 23, 27, 29, 25, 19, 13, 8],
      precips: [50, 60, 115, 130, 130, 170, 160, 155, 210, 165, 90, 50],
      annualT: 17.1, annualP: 1485, koppen: 'Cfa', source: 'fallback'
    },
    elevation: { avg: 440, max: 3776, min: 0, peakName: 'Fuji', peakElev: 3776, samples: [], source: 'fallback' },
    terrain: { mountain: 0.52, plateau: 0.09, hill: 0.22, plain: 0.13, desert: 0, water: 0.04, forest: 0.62, relief: 3776 }
  },
  FR: {
    weather: {
      temp: 12, feels: 11, humidity: 72, precip: 1, code: 3, cloud: 70, wind: 16, windDir: 240,
      isDay: true, uv: 2,
      daily: week(day(15, 7, 1, 3, 2), day(16, 8, 0, 2, 2), day(14, 7, 3, 61, 1), day(13, 6, 0, 3, 2), day(15, 7, 0, 1, 3), day(17, 8, 0, 2, 2), day(14, 6, 2, 80, 2))
    },
    climate: {
      temps: [5, 6, 9, 12, 16, 19, 21, 21, 18, 14, 9, 6],
      precips: [50, 45, 50, 55, 65, 55, 60, 60, 55, 60, 55, 55],
      annualT: 12.7, annualP: 665, koppen: 'Cfb', source: 'fallback'
    },
    elevation: { avg: 375, max: 4808, min: 0, peakName: 'Mont Blanc', peakElev: 4808, samples: [], source: 'fallback' },
    terrain: { mountain: 0.24, plateau: 0.1, hill: 0.27, plain: 0.34, desert: 0, water: 0.05, forest: 0.31, relief: 4808 }
  },
  BR: {
    weather: {
      temp: 23, feels: 24, humidity: 71, precip: 0, code: 2, cloud: 35, wind: 10, windDir: 90,
      isDay: true, uv: 11,
      daily: week(day(28, 18, 0, 1, 11), day(29, 18, 0, 0, 11), day(27, 17, 7, 80, 8), day(26, 17, 3, 61, 7), day(28, 18, 0, 2, 10), day(30, 19, 0, 1, 11), day(29, 19, 4, 80, 9))
    },
    climate: {
      temps: [22, 22, 23, 22, 21, 20, 20, 22, 23, 23, 22, 22],
      precips: [240, 200, 190, 110, 30, 5, 5, 10, 45, 130, 220, 250],
      annualT: 21.8, annualP: 1435, koppen: 'Aw', source: 'fallback'
    },
    elevation: { avg: 320, max: 2995, min: 0, peakName: 'Pico da Neblina', peakElev: 2995, samples: [], source: 'fallback' },
    terrain: { mountain: 0.2, plateau: 0.28, hill: 0.24, plain: 0.17, desert: 0.01, water: 0.1, forest: 0.83, relief: 2995 }
  },
  AU: {
    weather: {
      temp: 15, feels: 14, humidity: 52, precip: 0, code: 1, cloud: 15, wind: 18, windDir: 300,
      isDay: true, uv: 6,
      daily: week(day(22, 8, 0, 1, 6), day(24, 9, 0, 0, 7), day(26, 11, 0, 0, 7), day(23, 10, 0, 2, 5), day(20, 8, 1, 61, 4), day(21, 7, 0, 1, 6), day(23, 8, 0, 1, 6))
    },
    climate: {
      temps: [21, 21, 18, 14, 10, 7, 6, 7, 10, 13, 16, 19],
      precips: [60, 55, 50, 45, 45, 50, 50, 55, 55, 60, 65, 60],
      annualT: 13.2, annualP: 650, koppen: 'Cfb', source: 'fallback'
    },
    elevation: { avg: 330, max: 2228, min: 0, peakName: 'Mount Kosciuszko', peakElev: 2228, samples: [], source: 'fallback' },
    terrain: { mountain: 0.08, plateau: 0.2, hill: 0.22, plain: 0.22, desert: 0.26, water: 0.02, forest: 0.17, relief: 2228 }
  },
  EG: {
    weather: {
      temp: 26, feels: 25, humidity: 42, precip: 0, code: 0, cloud: 5, wind: 15, windDir: 330,
      isDay: true, uv: 6,
      daily: week(day(28, 17, 0, 0, 5), day(29, 18, 0, 0, 6), day(27, 17, 0, 0, 6), day(28, 17, 0, 1, 6), day(30, 18, 0, 0, 5), day(29, 18, 0, 0, 6), day(28, 17, 0, 0, 6))
    },
    climate: {
      temps: [14, 16, 19, 23, 27, 30, 30, 30, 28, 25, 20, 16],
      precips: [5, 4, 4, 1, 0, 0, 0, 0, 0, 1, 3, 5],
      annualT: 22.3, annualP: 23, koppen: 'BWh', source: 'fallback'
    },
    elevation: { avg: 320, max: 2629, min: -133, peakName: 'Mount Catherine', peakElev: 2629, samples: [], source: 'fallback' },
    terrain: { mountain: 0.1, plateau: 0.24, hill: 0.14, plain: 0.06, desert: 0.42, water: 0.04, forest: 0.0, relief: 2762 }
  },
  IN: {
    weather: {
      temp: 27, feels: 28, humidity: 55, precip: 0, code: 1, cloud: 20, wind: 8, windDir: 280,
      isDay: true, uv: 6,
      daily: week(day(31, 18, 0, 1, 6), day(32, 19, 0, 0, 6), day(30, 18, 2, 3, 5), day(29, 17, 0, 1, 6), day(31, 18, 0, 0, 6), day(33, 20, 0, 0, 7), day(32, 19, 0, 1, 6))
    },
    climate: {
      temps: [14, 18, 24, 30, 33, 33, 31, 30, 29, 26, 21, 16],
      precips: [20, 20, 15, 10, 30, 80, 200, 230, 130, 15, 5, 5],
      annualT: 25.1, annualP: 760, koppen: 'BSh', source: 'fallback'
    },
    elevation: { avg: 500, max: 8586, min: 0, peakName: 'Kangchenjunga', peakElev: 8586, samples: [], source: 'fallback' },
    terrain: { mountain: 0.3, plateau: 0.2, hill: 0.22, plain: 0.24, desert: 0.02, water: 0.02, forest: 0.24, relief: 8586 }
  }
};
