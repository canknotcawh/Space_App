/* =============================================================================
 * globe.js — Quả địa cầu 3D
 *  - Three.js + Globe.gl (bản UMD cố định)
 *  - Texture NASA Blue Marble (ngày), Black Marble (đêm), topology (bump)
 *  - Shader riêng trộn ngày/đêm theo vị trí Mặt Trời thực (subsolar point)
 *  - Lớp mây procedural quay chậm, khí quyển phát sáng của Globe.gl
 *  - Ranh giới quốc gia 1:50m, hover neon, click → bay tới
 * ========================================================================== */

import { subsolarPoint } from './model.js';

const IMG = 'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/';
const TEX = {
  day: `${IMG}earth-blue-marble.jpg`,
  night: `${IMG}earth-night.jpg`,
  bump: `${IMG}earth-topology.png`
};

const HOME = { lat: 12, lng: 104, altitude: 2.15 };

/** Chuyển lat/lng sang vector 3D cùng quy ước với Globe.gl. */
function latLngToVec3(lat, lng, r = 1) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 90) * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/** Texture 1x1 dự phòng khi ảnh CDN lỗi. */
function solidTexture(color = '#000') {
  const c = document.createElement('canvas');
  c.width = 1; c.height = 1;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/** Mây procedural (nhiễu tuần hoàn, alpha mềm) — không cần tải asset. */
function makeCloudTexture(w = 1024, h = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) p[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lattice = (x, y, seed) => {
    const xi = ((x % 256) + 256) % 256;
    const yi = ((y % 256) + 256) % 256;
    return perm[(perm[xi % 256] + yi + seed) % 512] / 255;
  };
  const noise = (x, y, seed) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = fade(x - xi), yf = fade(y - yi);
    const v00 = lattice(xi, yi, seed), v10 = lattice(xi + 1, yi, seed);
    const v01 = lattice(xi, yi + 1, seed), v11 = lattice(xi + 1, yi + 1, seed);
    return (v00 * (1 - xf) + v10 * xf) * (1 - yf) + (v01 * (1 - xf) + v11 * xf) * yf;
  };
  for (let y = 0; y < h; y += 1) {
    const v = y / h;
    const band = Math.sin(v * Math.PI); // mây dày hơn ở xích đạo & vĩ trung
    for (let x = 0; x < w; x += 1) {
      const u = x / w;
      let n = 0, amp = 0.5, fx = 8, fy = 4;
      for (let o = 0; o < 5; o += 1) {
        n += noise(u * fx, v * fy, o * 17) * amp;
        amp *= 0.5; fx *= 2; fy *= 2;
      }
      const shaped = (n * 1.35 - 0.42) * band;
      let a = Math.max(0, Math.min(1, (shaped - 0.16) * 2.6));
      a = a ** 1.6;
      const idx = (y * w + x) * 4;
      img.data[idx] = 255; img.data[idx + 1] = 255; img.data[idx + 2] = 255;
      img.data[idx + 3] = Math.round(a * 210);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export class GlobeView {
  constructor(container, handlers = {}) {
    this.container = container;
    this.handlers = handlers;
    this.world = null;
    this.cloudMesh = null;
    this.features = [];
    this.selectedCode = null;
    this.hoverCode = null;
    this.sunUniform = { value: new THREE.Vector3(1, 0, 0) };
    // Tôn trọng thiết lập giảm chuyển động của hệ điều hành.
    this.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.autoRotate = !this.reduceMotion;
    this.idleTimer = 0;
    this._raf = 0;
    this._last = performance.now();
    this._destroyed = false;
  }

  /** Góc lệch (độ, -180..180) từ hướng nhìn camera tới kinh độ `lng`. */
  bearingTo(lng) {
    if (!this.world) return 0;
    const cam = this.world.camera();
    if (!cam) return 0;
    const camLng = (Math.atan2(cam.position.z, cam.position.x) * 180) / Math.PI - 90;
    return ((Number(lng) - camLng + 540) % 360) - 180;
  }

  async init() {
    if (typeof Globe === 'undefined') throw new Error('Globe.gl chưa tải được từ CDN');
    // UMD của globe.gl xuất factory Kapsule: Globe()(element)
    const world = Globe({ animateIn: true })(this.container);
    this.world = world;

    world
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#5fd8ff')
      .atmosphereAltitude(0.19)
      .showGraticules(false);

    // --- Texture ---------------------------------------------------------
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const load = (url, srgb) => new Promise((resolve) => {
      loader.load(url, (tex) => {
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        resolve(tex);
      }, undefined, () => resolve(null));
    });
    const [dayTex, nightTex, bumpTex] = await Promise.all([
      load(TEX.day, true).catch(() => null),
      load(TEX.night, true).catch(() => null),
      load(TEX.bump, false).catch(() => null)
    ]);

    const material = world.globeMaterial();
    material.map = dayTex || solidTexture('#123456');
    material.color = new THREE.Color(0xffffff);
    material.needsUpdate = true;
    const night = nightTex || solidTexture('#000000');
    const bump = bumpTex || solidTexture('#808080');

    this.patchDayNightShader(material, night, bump);

    // --- Mây -------------------------------------------------------------
    try {
      const cloudGeo = new THREE.SphereGeometry(101.6, 64, 64);
      const cloudMat = new THREE.MeshPhongMaterial({
        map: makeCloudTexture(),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.FrontSide
      });
      this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      world.scene().add(this.cloudMesh);
    } catch (err) {
      console.warn('Cloud layer skipped:', err);
    }

    // --- Renderer tuning -------------------------------------------------
    try {
      const renderer = world.renderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (err) { /* noop */ }

    // --- Camera controls -------------------------------------------------
    const controls = world.controls();
    if (controls) {
      // Globe.gl dùng TrackballControls (không có autoRotate) → tự xoay camera trong _loop().
      if ('staticMoving' in controls) { controls.staticMoving = false; controls.dynamicDampingFactor = 0.08; }
      controls.rotateSpeed = 0.8;
      controls.zoomSpeed = 1.1;
      controls.minDistance = 130;
      controls.maxDistance = 620;
      controls.addEventListener('start', () => {
        this.pauseAutoRotate();
        this.handlers.onInteract?.();
      });
      controls.addEventListener('end', () => this.scheduleAutoRotate());
    }
    world.pointOfView(HOME, 0);

    const resize = () => {
      if (!this.world || this._destroyed) return;
      const rect = this.container.getBoundingClientRect();
      this.world.width(Math.max(1, Math.round(rect.width))).height(Math.max(1, Math.round(rect.height)));
    };
    this._resizeObserver = new ResizeObserver(resize);
    this._resizeObserver.observe(this.container);
    resize();

    // --- Sun --------------------------------------------------------------
    this.updateSun();
    this._sunTimer = setInterval(() => this.updateSun(), 60000);

    this._loop();
    this.handlers.onReady?.();
    return this;
  }

  /** Chèn shader ngày/đêm + relief vào material Phong của Globe.gl. */
  patchDayNightShader(material, nightTex, bumpTex) {
    const self = this;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uNightMap = { value: nightTex };
      shader.uniforms.uBumpMap = { value: bumpTex };
      shader.uniforms.uSunDir = self.sunUniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObjNormal;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvObjNormal = normalize(normal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uNightMap;
          uniform sampler2D uBumpMap;
          uniform vec3 uSunDir;
          varying vec3 vObjNormal;`)
        .replace('#include <output_fragment>', `
          vec3 dayCol = texture2D(map, vMapUv).rgb;
          vec3 nightCol = texture2D(uNightMap, vMapUv).rgb;
          vec3 n = normalize(vObjNormal);
          vec3 sun = normalize(uSunDir);
          float sunDot = dot(n, sun);
          float dayAmt = smoothstep(-0.14, 0.2, sunDot);
          // Relief nhẹ từ bump map: tạo cảm giác núi thật dưới nắng
          float hC = texture2D(uBumpMap, vMapUv).r;
          float hX = texture2D(uBumpMap, vMapUv + vec2(0.0008, 0.0)).r;
          float hY = texture2D(uBumpMap, vMapUv + vec2(0.0, 0.0016)).r;
          float relief = clamp(1.0 + (hX - hC) * 16.0 + (hY - hC) * 16.0, 0.72, 1.3);
          vec3 litSide = dayCol * (0.13 + 1.15 * clamp(sunDot, 0.0, 1.0)) * relief;
          litSide += vec3(0.03, 0.06, 0.12);
          vec3 darkSide = nightCol * 1.55 + dayCol * 0.022;
          vec3 col = mix(darkSide, litSide, dayAmt);
          gl_FragColor = vec4(col, diffuseColor.a);
        `);
      material.userData.shader = shader;
    };
    material.needsUpdate = true;
  }

  updateSun() {
    const { lat, lng } = subsolarPoint(new Date());
    this.sunUniform.value.copy(latLngToVec3(lat, lng)).normalize();
    if (this.world && this.world.globeMaterial()?.userData?.shader) {
      this.world.globeMaterial().userData.shader.uniforms.uSunDir.value = this.sunUniform.value;
    }
  }

  _loop() {
    if (this._destroyed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    if (this.cloudMesh && !this.reduceMotion) this.cloudMesh.rotation.y += dt * 0.0035;
    // Tự xoay chậm quanh trục Y khi người dùng không tương tác.
    if (this.autoRotate && !this._flying && this.world) {
      const cam = this.world.camera();
      if (cam) {
        const a = 0.055 * dt;
        const cos = Math.cos(a), sin = Math.sin(a);
        const x = cam.position.x, z = cam.position.z;
        cam.position.x = x * cos - z * sin;
        cam.position.z = x * sin + z * cos;
        cam.lookAt(0, 0, 0);
      }
    }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  setCountries(features) {
    this.features = features;
    const world = this.world;
    if (!world) return;
    world
      .polygonsData(features)
      .polygonAltitude((f) => (f.__code === this.selectedCode ? 0.012 : 0.006))
      .polygonCapColor((f) => {
        if (f.__code === this.selectedCode) return 'rgba(0, 229, 255, 0.34)';
        if (f.__code === this.hoverCode) return 'rgba(198, 255, 61, 0.24)';
        return 'rgba(120, 170, 255, 0.035)';
      })
      .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
      .polygonStrokeColor((f) => {
        if (f.__code === this.selectedCode) return '#FF3CAC';
        if (f.__code === this.hoverCode) return '#C6FF3D';
        return 'rgba(150, 195, 255, 0.32)';
      })
      .polygonsTransitionDuration(180)
      .onPolygonHover((poly) => this._onHover(poly))
      .onPolygonClick((poly, event, coords) => {
        if (!poly) return;
        this.handlers.onSelect?.(poly, { lat: coords?.lat ?? poly.__label.lat, lng: coords?.lng ?? poly.__label.lng });
      });
    this._refreshPolygonStyles();
  }

  _onHover(poly) {
    const code = poly?.__code || null;
    if (code === this.hoverCode) return;
    this.hoverCode = code;
    this._refreshPolygonStyles();
    this.handlers.onHover?.(poly || null);
  }

  _refreshPolygonStyles() {
    const world = this.world;
    if (!world) return;
    const sel = this.selectedCode;
    const hov = this.hoverCode;
    world
      .polygonAltitude((f) => (f.__code === sel ? 0.012 : 0.006))
      .polygonCapColor((f) => {
        if (f.__code === sel) return 'rgba(0, 229, 255, 0.36)';
        if (f.__code === hov) return 'rgba(198, 255, 61, 0.26)';
        return 'rgba(120, 170, 255, 0.03)';
      })
      .polygonStrokeColor((f) => {
        if (f.__code === sel) return '#FF3CAC';
        if (f.__code === hov) return '#C6FF3D';
        return 'rgba(150, 195, 255, 0.3)';
      });
  }

  setSelected(feature) {
    this.selectedCode = feature?.__code || null;
    this._refreshPolygonStyles();
  }

  flyTo(feature, altitude) {
    if (!this.world || !feature) return;
    const target = feature.__label || feature.__bbox?.center || { lat: 0, lng: 0 };
    const bbox = feature.__bbox;
    let alt = altitude;
    if (!alt) {
      const span = bbox ? Math.max(bbox.maxLat - bbox.minLat, bbox.maxLng - bbox.minLng) : 12;
      alt = Math.max(0.42, Math.min(1.9, 1.55 - span / 38));
    }
    this.pauseAutoRotate();
    this._flying = true;
    this.world.pointOfView({ lat: target.lat, lng: target.lng, altitude: alt }, 1250);
    setTimeout(() => { this._flying = false; }, 1300);
    this.scheduleAutoRotate(10000);
  }

  resetView() {
    if (!this.world) return;
    this.selectedCode = null;
    this._refreshPolygonStyles();
    this._flying = true;
    this.world.pointOfView(HOME, 1100);
    setTimeout(() => { this._flying = false; }, 1150);
    this.scheduleAutoRotate(8000);
  }

  pauseAutoRotate() {
    this.autoRotate = false;
    clearTimeout(this.idleTimer);
  }

  scheduleAutoRotate(delay = 6500) {
    clearTimeout(this.idleTimer);
    if (this.reduceMotion) return;
    this.idleTimer = setTimeout(() => { this.autoRotate = true; }, delay);
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    clearInterval(this._sunTimer);
    clearTimeout(this.idleTimer);
    this._resizeObserver?.disconnect();
  }
}
