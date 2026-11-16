import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  WAREHOUSES, WALL_HEIGHT, MEZZ_HEIGHT, MEZZ_FRACTION, LEVEL_STEP, fmt,
} from './data.js';

/**
 * Orbitable schematic 3D massing. Coordinates are arbitrary model units (NOT
 * metres); plan x → x, plan y → z. Boxes are equal-sized placeholders.
 */
export function createScene(container, { onSelect }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xeef1f5);
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 2000);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c0cc, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(80, 140, 60);
  scene.add(sun);

  // Centre the layout at the origin
  const minX = Math.min(...WAREHOUSES.map((w) => w.x));
  const maxX = Math.max(...WAREHOUSES.map((w) => w.x + w.width));
  const minZ = Math.min(...WAREHOUSES.map((w) => w.z));
  const maxZ = Math.max(...WAREHOUSES.map((w) => w.z + w.depth));
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ);

  const grid = new THREE.GridHelper(Math.ceil(span * 1.4 / 10) * 10, Math.ceil(span * 1.4 / 10), 0xc3cad3, 0xdde2e8);
  grid.position.y = -0.02;
  scene.add(grid);

  const pickables = [];
  const units = new Map();

  const mat = (color, opacity) => new THREE.MeshStandardMaterial({
    color, transparent: true, opacity, roughness: 0.85, metalness: 0, depthWrite: opacity > 0.9,
  });

  for (const w of WAREHOUSES) {
    const g = new THREE.Group();
    g.position.set(w.x - cx + w.width / 2, 0, w.z - cz + w.depth / 2);
    const base = w.level ?? 0;
    const color = new THREE.Color(w.color);

    // Plinth showing the ground-floor level (only visible where level > 0)
    const plinthH = Math.max(base, 0) + 0.25;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w.width, plinthH, w.depth), mat(color, 1));
    slab.position.y = base + 0.25 - plinthH / 2;

    // Walls / volume (translucent so internals are visible)
    const volGeo = new THREE.BoxGeometry(w.width, WALL_HEIGHT, w.depth);
    const vol = new THREE.Mesh(volGeo, mat(color, 0.18));
    vol.position.y = base + 0.25 + WALL_HEIGHT / 2;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(volGeo),
      new THREE.LineBasicMaterial({ color: 0x1d2733, transparent: true, opacity: 0.55 }),
    );
    edges.position.copy(vol.position);

    // Indicative mezzanine placeholder — presence/extent unconfirmed for every unit
    const md = w.depth * MEZZ_FRACTION;
    const mezzGeo = new THREE.BoxGeometry(w.width - 0.4, 0.3, md);
    const mezz = new THREE.Mesh(mezzGeo, mat(color.clone().offsetHSL(0, -0.1, 0.12), 0.85));
    mezz.position.set(0, base + 0.25 + MEZZ_HEIGHT, -w.depth / 2 + md / 2 + 0.2);
    const mezzEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mezzGeo),
      new THREE.LineBasicMaterial({ color: 0x1d2733, transparent: true, opacity: 0.7 }),
    );
    mezzEdges.position.copy(mezz.position);

    for (const m of [slab, vol, mezz]) {
      m.userData.id = w.id;
      pickables.push(m);
    }
    g.add(slab, vol, edges, mezz, mezzEdges);

    const div = document.createElement('div');
    div.className = 'label3d';
    div.innerHTML = `<b>${w.name}</b><span>${fmt(w.gross)} m² gross</span>`;
    div.addEventListener('pointerdown', (e) => e.stopPropagation());
    div.addEventListener('click', () => onSelect(w.id));
    const label = new CSS2DObject(div);
    label.position.set(0, base + WALL_HEIGHT + 2.5, 0);
    g.add(label);

    scene.add(g);
    units.set(w.id, { slab, vol, edges, mezz, mezzEdges, div, color });
  }

  // Level-step annotation between NAU 3 and NAU 4
  {
    const n3 = WAREHOUSES.find((w) => w.id === 'nau3');
    const n4 = WAREHOUSES.find((w) => w.id === 'nau4');
    const div = document.createElement('div');
    div.className = 'label3d step';
    div.textContent = `≈ ${LEVEL_STEP.toFixed(2)} m step (direction assumed)`;
    const obj = new CSS2DObject(div);
    obj.position.set((n3.x + n3.width + n4.x) / 2 - cx, LEVEL_STEP + 0.6, n3.z + n3.depth - cz + 2);
    scene.add(obj);
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minDistance = 15;
  controls.maxDistance = span * 3;

  function resetView() {
    camera.position.set(span * 0.35, span * 0.55, span * 0.85);
    controls.target.set(0, 2, 0);
    controls.update();
  }
  resetView();

  // Click-to-select (ignore drags)
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables.filter((m) => m.visible), false)[0];
    if (hit) onSelect(hit.object.userData.id);
  });

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  let running = false;
  function loop() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  return {
    resetView,
    setActive(on) {
      if (on && !running) { running = true; resize(); requestAnimationFrame(loop); }
      if (!on) running = false;
    },
    update({ selected, floor }) {
      for (const [id, u] of units) {
        const on = id === selected;
        const dim = selected && !on;
        const showGround = floor !== 'mezz';
        const showMezz = floor !== 'ground';

        u.slab.material.opacity = showGround ? (dim ? 0.45 : 1) : 0.15;
        u.slab.material.depthWrite = u.slab.material.opacity > 0.9;
        u.vol.visible = showGround;
        u.vol.material.opacity = on ? 0.32 : dim ? 0.08 : 0.18;
        u.edges.visible = showGround || on;
        u.edges.material.color.set(on ? 0x000000 : 0x1d2733);
        u.edges.material.opacity = on ? 1 : dim ? 0.25 : 0.55;

        u.mezz.visible = showMezz;
        u.mezzEdges.visible = showMezz;
        u.mezz.material.opacity = dim ? 0.3 : 0.85;

        for (const m of [u.slab.material, u.vol.material, u.mezz.material]) {
          m.emissive.copy(on ? u.color : new THREE.Color(0));
          m.emissiveIntensity = on ? 0.35 : 0;
        }
        u.div.classList.toggle('selected', on);
        u.div.classList.toggle('dim', !!dim);
      }
    },
  };
}
