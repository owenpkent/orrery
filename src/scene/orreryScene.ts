/**
 * The hero scene: sun, Earth on its true orbital angle, the moon at its real phase, and a
 * starfield. three.js is imported only here, and this module is loaded lazily by the home view.
 */
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  AmbientLight,
  PointLight,
} from 'three';
import { MS_PER_DAY, UNIX_EPOCH_JDN } from '../calendars/jdn';
import { moonStateAt } from '../sky/events';
import { angleOf, windowFor } from '../sky/orbit';
import { reducedMotion } from '../ui/fx';

export interface SceneOptions {
  /** Fewer stars, no antialiasing, lower pixel ratio. */
  lite: boolean;
  /** Called whenever Earth's position on screen changes (CSS pixels, relative to the canvas). */
  onEarth: (x: number, y: number, r: number) => void;
}

export interface SceneHandle {
  /** Resolves once shaders are compiled and the first frame can be drawn without a hitch. */
  ready: Promise<void>;
  setJdn(jdn: number, instant?: boolean): void;
  /** Orbital angle (degrees, counter-clockwise from above) under a pointer, or null. */
  angleAt(clientX: number, clientY: number): number | null;
  setActive(on: boolean): void;
  resize(): void;
  dispose(): void;
}

const R = 10;
const noise = (octaves: number) => /* glsl */ `
float hash(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<${octaves};i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
`;

const EARTH_VERT = /* glsl */ `
varying vec3 vPos; varying vec3 vN; varying vec3 vWorld;
void main(){
  vPos = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vWorld = (modelMatrix * vec4(position,1.)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld,1.);
}`;

const earthFrag = (octaves: number) => /* glsl */ `
varying vec3 vPos; varying vec3 vN; varying vec3 vWorld;
uniform vec3 uSun; uniform float uTime;
${noise(octaves)}
void main(){
  vec3 p = normalize(vPos);
  float h = fbm(p*2.2+3.1);
  float land = smoothstep(.5,.54,h);
  vec3 ocean = mix(vec3(.02,.08,.26), vec3(.05,.3,.66), smoothstep(.2,.5,h));
  vec3 ground = mix(vec3(.12,.36,.16), vec3(.58,.48,.3), smoothstep(.54,.72,h));
  float ice = smoothstep(.84,.94,abs(p.y)+(fbm(p*6.)-.5)*.18);
  vec3 col = mix(ocean, ground, land);
  col = mix(col, vec3(.93,.96,1.), ice);
  float cl = smoothstep(.55,.8, fbm(p*3.4+vec3(uTime*.012,0.,0.)+9.));
  col = mix(col, vec3(1.), cl*.72);
  vec3 n = normalize(vN);
  float d = dot(n, uSun);
  float lit = smoothstep(-.1,.3,d);
  vec3 night = col*.05 + vec3(.008,.015,.04);
  vec3 dayc = col*(.18+1.15*max(d,0.));
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 hv = normalize(uSun + v);
  float spec = pow(max(dot(n,hv),0.),48.)*(1.-land)*(1.-cl)*.6;
  vec3 c = mix(night, dayc, lit) + vec3(1.,.95,.85)*spec*lit;
  float fres = pow(1.-max(dot(n,v),0.), 3.);
  c += vec3(.25,.55,1.)*fres*.6*(.25+lit);
  gl_FragColor = vec4(c,1.);
}`;

const ATMO_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vWorld; uniform vec3 uSun;
void main(){
  vec3 v = normalize(cameraPosition - vWorld);
  float d = -dot(normalize(vN), v);
  float rim = pow(clamp(d * 1.6, 0., 1.), 2.5);
  gl_FragColor = vec4(vec3(.3,.6,1.)*rim*1.6, rim*1.2);
}`;

const sunFrag = (octaves: number) => /* glsl */ `
varying vec3 vPos; varying vec3 vN; varying vec3 vWorld; uniform float uTime;
${noise(octaves)}
void main(){
  vec3 p = normalize(vPos);
  float t = fbm(p*3.+vec3(0.,uTime*.05,0.));
  float g = fbm(p*9.-vec3(uTime*.09,0.,0.));
  vec3 c = mix(vec3(1.,.42,.06), vec3(1.,.82,.36), g);
  c = mix(c, vec3(1.,.97,.8), pow(t,2.2)*1.3);
  vec3 v = normalize(cameraPosition - vWorld);
  float limb = pow(max(dot(normalize(vN),v),0.),.45);
  c *= .55+.65*limb;
  gl_FragColor = vec4(c,1.);
}`;

function radialTexture(stops: [number, string][], size = 256): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const hs = size / 2;
  const gr = g.createRadialGradient(hs, hs, 0, hs, hs, hs);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function moonTexture(lite: boolean): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = lite ? 128 : 256;
  c.height = lite ? 64 : 128;
  const g = c.getContext('2d')!;
  g.scale(c.width / 256, c.height / 128);
  g.fillStyle = '#b9b7b2';
  g.fillRect(0, 0, 256, 128);
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 256;
    const y = rnd() * 128;
    const r = 2 + rnd() * rnd() * 16;
    g.fillStyle = `rgba(60,58,62,${0.12 + rnd() * 0.22})`;
    g.beginPath();
    g.arc(x, y, r, 0, 7);
    g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function stars(count: number, radius: number, size: number, seed: number, texSize = 256): Points {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const tint = [
    new Color('#cfe0ff'),
    new Color('#ffffff'),
    new Color('#ffe2b8'),
    new Color('#c9b8ff'),
  ];
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = radius * (0.85 + rnd() * 0.3);
    const q = Math.sqrt(1 - u * u);
    pos[i * 3] = r * q * Math.cos(a);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * q * Math.sin(a);
    const c = tint[Math.floor(rnd() * tint.length)];
    const k = 0.35 + rnd() * rnd() * 0.9;
    col[i * 3] = c.r * k;
    col[i * 3 + 1] = c.g * k;
    col[i * 3 + 2] = c.b * k;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const mat = new PointsMaterial({
    size,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    map: radialTexture(
      [
        [0, 'rgba(255,255,255,1)'],
        [0.35, 'rgba(255,255,255,.7)'],
        [1, 'rgba(255,255,255,0)'],
      ],
      texSize,
    ),
  });
  return new Points(geo, mat);
}

function ringLine(radius: number, opacity: number, color: string, seg = 160): LineLoop {
  const pts: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(Math.cos(a) * radius, 0, -Math.sin(a) * radius);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  return new LineLoop(
    g,
    new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
}

const rad = (d: number) => (d * Math.PI) / 180;

export function createScene(canvas: HTMLCanvasElement, opts: SceneOptions): SceneHandle {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !opts.lite,
    powerPreference: opts.lite ? 'default' : 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  const maxDpr = opts.lite ? 1.5 : 1.75;
  const seg = (full: number, lite: number) => (opts.lite ? lite : full);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 400);
  const rig = new Group();
  scene.add(rig);

  // starfield (outside the rig so it only parallaxes)
  const farStars = stars(opts.lite ? 520 : 2200, 160, 1.6, 11, seg(256, 64));
  const nearStars = stars(opts.lite ? 90 : 420, 120, 2.8, 29, seg(256, 64));
  scene.add(farStars, nearStars);

  // sun
  const sunMat = new ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: sunFrag(opts.lite ? 3 : 5),
    uniforms: { uTime: { value: 0 } },
  });
  const sun = new Mesh(new SphereGeometry(2.0, seg(48, 28), seg(32, 18)), sunMat);
  rig.add(sun);
  const glowTex = radialTexture(
    [
      [0, 'rgba(255,214,130,0.95)'],
      [0.12, 'rgba(255,170,70,0.55)'],
      [0.4, 'rgba(255,120,40,0.14)'],
      [1, 'rgba(255,100,30,0)'],
    ],
    seg(256, 128),
  );
  const glowA = new Sprite(
    new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, depthWrite: false }),
  );
  glowA.scale.setScalar(13);
  const glowB = new Sprite(
    new SpriteMaterial({
      map: radialTexture([
        [0, 'rgba(255,190,110,0.3)'],
        [0.5, 'rgba(255,140,60,0.06)'],
        [1, 'rgba(255,120,40,0)'],
      ]),
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  glowB.scale.setScalar(30);
  rig.add(glowA, glowB);

  // orbit furniture: guide rings, month divisions, travelled arc
  rig.add(ringLine(R, 0.34, '#9db4ff', seg(220, 120)));
  rig.add(ringLine(R * 0.78, 0.1, '#9db4ff'));
  rig.add(ringLine(R * 0.58, 0.07, '#9db4ff'));
  let divisions: LineSegments | null = null;
  let divisionsFor = -1;
  const arcGeo = new BufferGeometry();
  const ARC_N = 180;
  arcGeo.setAttribute('position', new BufferAttribute(new Float32Array(ARC_N * 3), 3));
  const arc = new Line(
    arcGeo,
    new LineBasicMaterial({
      color: '#ffc15a',
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  rig.add(arc);

  // Earth
  const earthGroup = new Group();
  rig.add(earthGroup);
  const earthMat = new ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: earthFrag(opts.lite ? 3 : 5),
    uniforms: { uSun: { value: new Vector3(-1, 0, 0) }, uTime: { value: 0 } },
  });
  const earth = new Mesh(new SphereGeometry(0.8, seg(64, 36), seg(48, 26)), earthMat);
  earth.rotation.z = rad(23.4);
  earthGroup.add(earth);
  const atmo = new Mesh(
    new SphereGeometry(0.8 * 1.16, seg(48, 24), seg(32, 16)),
    new ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { uSun: { value: new Vector3() } },
      side: BackSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  earthGroup.add(atmo);
  const halo = new Sprite(
    new SpriteMaterial({
      map: radialTexture([
        [0, 'rgba(120,180,255,0.0)'],
        [0.3, 'rgba(120,180,255,0.35)'],
        [0.5, 'rgba(120,180,255,0.1)'],
        [1, 'rgba(120,180,255,0)'],
      ]),
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(4.2);
  earthGroup.add(halo);

  // moon
  const moonPivot = new Group();
  earthGroup.add(moonPivot);
  const moon = new Mesh(
    new SphereGeometry(0.21, seg(32, 16), seg(24, 12)),
    new MeshLambertMaterial({ map: moonTexture(opts.lite) }),
  );
  moonPivot.add(moon);
  const moonOrbit = ringLine(1.6, 0.16, '#ffffff', seg(64, 40));
  earthGroup.add(moonOrbit);
  const sunLight = new PointLight(0xfff0d8, 900, 0, 2);
  rig.add(sunLight, new AmbientLight(0x303850, 0.5));

  // state
  let curAngle = 0;
  let targetAngle = 0;
  let angleReady = false;
  let moonPhase = 0;
  let active = true;
  let raf = 0;
  let last = performance.now();
  let time = 0;
  let w = 1;
  let h = 1;
  let pmx = 0;
  let pmy = 0;
  let smx = 0;
  let smy = 0;
  let dirty = true;
  let compiled = false;
  let lastDraw = 0;
  const still = reducedMotion();
  // Phones render at 30 fps while idle; a drag or a date change still runs at full rate.
  const idleFrameMs = opts.lite ? 1000 / 30 : 0;

  const unit = (deg: number) => new Vector3(Math.cos(rad(deg)), 0, -Math.sin(rad(deg)));

  function buildDivisions(start: number) {
    if (divisionsFor === start) return;
    divisionsFor = start;
    if (divisions) {
      rig.remove(divisions);
      divisions.geometry.dispose();
    }
    const win = windowFor(start);
    const pts: number[] = [];
    for (let k = 0; k <= 12; k++) {
      const u = unit(angleOf(win, win.start + k * 30));
      const long = k === 0 ? 1.04 : 1;
      pts.push(u.x * R * 0.58, 0, u.z * R * 0.58, u.x * R * long, 0, u.z * R * long);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    divisions = new LineSegments(
      g,
      new LineBasicMaterial({
        color: '#9db4ff',
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    rig.add(divisions);
  }

  let arcStart = 0;
  function updateArc() {
    // travelled arc from the window start (December solstice) to Earth
    const total = Math.max(0.0001, curAngle - arcStart);
    const attr = arcGeo.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < ARC_N; i++) {
      const a = arcStart + (total * i) / (ARC_N - 1);
      attr.setXYZ(i, Math.cos(rad(a)) * R, 0, -Math.sin(rad(a)) * R);
    }
    attr.needsUpdate = true;
    arcGeo.setDrawRange(0, ARC_N);
  }

  function layout() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    const tilt = rad(27);
    const fov = rad(camera.fov);
    // Fit the orbit across the width, but never closer than a cinematic minimum.
    const need = (R * (aspect < 1.2 ? 2.5 : 2.9)) / (2 * Math.tan(fov / 2) * aspect);
    const dist = Math.max(need, 21);
    camera.position.set(0, Math.sin(tilt) * dist, Math.cos(tilt) * dist);
    camera.lookAt(0, 0, 0);
    if (aspect > 1.2 && w >= 760) {
      // sun to the right of centre so the headline has room on the left
      camera.setViewOffset(w, h, -w * 0.13, h * 0.02, w, h);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    dirty = true;
  }

  const earthPos = new Vector3();
  const ndc = new Vector3();
  function place() {
    const u = unit(curAngle);
    earthGroup.position.set(u.x * R, 0, u.z * R);
    earthPos.copy(earthGroup.position);
    const toSun = earthPos.clone().negate().normalize();
    (earthMat.uniforms.uSun.value as Vector3).copy(toSun);
    // moon: new moon sits between Earth and Sun; waxing moons are east of the Sun
    const mAng = curAngle + 180 + moonPhase;
    const mu = unit(mAng);
    moon.position.set(mu.x * 1.6, 0, mu.z * 1.6);
    moon.rotation.y = -rad(mAng) + Math.PI / 2;
    updateArc();
    camera.updateMatrixWorld();
    ndc.copy(earthPos).project(camera);
    const px = (ndc.x * 0.5 + 0.5) * w;
    const py = (-ndc.y * 0.5 + 0.5) * h;
    const edge = earthPos
      .clone()
      .add(new Vector3(0.8, 0, 0))
      .project(camera);
    const pr = Math.abs((edge.x - ndc.x) * 0.5 * w);
    opts.onEarth(px, py, pr);
  }

  function frame(now: number) {
    raf = 0;
    if (!active || !compiled) return;
    if (
      idleFrameMs &&
      !dirty &&
      Math.abs(targetAngle - curAngle) < 0.01 &&
      now - lastDraw < idleFrameMs - 2
    ) {
      schedule();
      return;
    }
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    const diff = targetAngle - curAngle;
    const moving = Math.abs(diff) > 0.01;
    if (moving) curAngle += diff * (1 - Math.exp(-dt * 8));
    else curAngle = targetAngle;
    smx += (pmx - smx) * (1 - Math.exp(-dt * 3));
    smy += (pmy - smy) * (1 - Math.exp(-dt * 3));
    farStars.rotation.y = smx * 0.035 + time * 0.002;
    farStars.rotation.x = smy * 0.02;
    nearStars.rotation.y = smx * 0.08 - time * 0.004;
    nearStars.rotation.x = smy * 0.04;
    rig.rotation.y = smx * 0.03;
    rig.rotation.x = smy * 0.015;
    sunMat.uniforms.uTime.value = time;
    earthMat.uniforms.uTime.value = time;
    earth.rotation.y += dt * 0.35;
    const pulse = 1 + Math.sin(time * 0.8) * 0.025;
    glowA.scale.setScalar(13 * pulse);
    (nearStars.material as PointsMaterial).opacity = 0.78 + Math.sin(time * 1.3) * 0.2;
    place();
    renderer.render(scene, camera);
    dirty = false;
    schedule();
  }

  function schedule() {
    if (raf || !active || !compiled) return;
    if (still && !dirty) return;
    raf = requestAnimationFrame(frame);
  }

  function onMove(e: PointerEvent) {
    pmx = (e.clientX / window.innerWidth) * 2 - 1;
    pmy = (e.clientY / window.innerHeight) * 2 - 1;
    if (still) return;
    schedule();
  }
  if (!still) window.addEventListener('pointermove', onMove, { passive: true });

  const api: SceneHandle = {
    ready: Promise.resolve(),
    setJdn(jdn, instant = false) {
      const win = windowFor(jdn);
      arcStart = win.angle0;
      buildDivisions(win.start);
      let a = angleOf(win, jdn);
      // keep the display angle continuous across the year boundary
      const base = a % 360;
      const ref = angleReady ? curAngle : base;
      a = base + Math.round((ref - base) / 360) * 360;
      moonPhase = moonStateAt((jdn - UNIX_EPOCH_JDN) * MS_PER_DAY + MS_PER_DAY / 2).angle;
      targetAngle = a;
      if (!angleReady || instant || still) {
        curAngle = a;
        angleReady = true;
      }
      arcStart = a - ((((a - win.angle0) % 360) + 360) % 360);
      dirty = true;
      schedule();
    },
    angleAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const p = new Vector3(x, y, 0.5).unproject(camera);
      const dir = p.sub(camera.position).normalize();
      if (Math.abs(dir.y) < 1e-4) return null;
      const t = -camera.position.y / dir.y;
      if (t < 0) return null;
      const hit = camera.position.clone().addScaledVector(dir, t);
      return (Math.atan2(-hit.z, hit.x) * 180) / Math.PI;
    },
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on) {
        last = performance.now();
        dirty = true;
        schedule();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    resize: layout,
    dispose() {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      scene.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as { dispose?: () => void; map?: { dispose(): void } } | undefined;
        mat?.map?.dispose();
        mat?.dispose?.();
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
  layout();
  // Compile shaders off the main thread where the browser allows it, then start drawing.
  api.ready = renderer
    .compileAsync(scene, camera)
    .catch(() => undefined)
    .then(() => {
      compiled = true;
      dirty = true;
      last = performance.now();
      schedule();
    });
  return api;
}
