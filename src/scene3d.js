import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { WAREHOUSES, SITES, WALL_HEIGHT, siteBox } from './data.js';
import { t, fmt } from './i18n.js';
import { BOX, GAP_V, stackHeight } from './capacity.js';

// Above this many box instances, each stack is drawn as one column instead.
const MAX_BOX_INSTANCES = 30000;

/**
 * Orbitable 3D massing in metres. Plan x → x, plan y → z. Ground-floor outlines
 * are extruded to an ASSUMED wall height; upper-floor zones are slabs at the
 * measured (NAU 16) or assumed level. Floor levels within sheet A follow the
 * measured spot levels (NAU 4–6 1.25 m below NAU 1–3).
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
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c0cc, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(80, 140, 60);
  scene.add(sun);

  const boxes = SITES.map((s) => ({ s, b: siteBox(s.id) }));
  const minX = Math.min(...boxes.map((x) => x.b.x0));
  const maxX = Math.max(...boxes.map((x) => x.b.x1));
  const minZ = Math.min(...boxes.map((x) => x.b.y0));
  const maxZ = Math.max(...boxes.map((x) => x.b.y1));
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxZ - minZ);

  const gridSize = Math.ceil((span * 1.2) / 10) * 10;
  const grid = new THREE.GridHelper(gridSize, gridSize / 10, 0xc3cad3, 0xdde2e8); // 10 m cells
  grid.position.y = -0.03;
  scene.add(grid);

  const shapeOf = (poly) => new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x - cx, -(y - cz))));
  const extrude = (poly, h) => {
    const geo = new THREE.ExtrudeGeometry(shapeOf(poly), { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return geo;
  };
  const mat = (color, opacity) => new THREE.MeshStandardMaterial({
    color, transparent: true, opacity, roughness: 0.85, metalness: 0, depthWrite: opacity > 0.9,
  });
  const edgeMat = (o) => new THREE.LineBasicMaterial({ color: 0x1d2733, transparent: true, opacity: o });

  const label = (cls, html, pos) => {
    const div = document.createElement('div');
    div.className = cls;
    div.innerHTML = html;
    const obj = new CSS2DObject(div);
    obj.position.copy(pos);
    scene.add(obj);
    return div;
  };

  // Sheet frames on the ground
  const sheetLabels = [];
  for (const { s, b } of boxes) {
    const p = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]]
      .map(([x, y]) => new THREE.Vector3(x - cx, 0.02, y - cz));
    const frame = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(p),
      new THREE.LineDashedMaterial({ color: 0x5f6b7a, dashSize: 2, gapSize: 1.2 }),
    );
    frame.computeLineDistances();
    scene.add(frame);
    sheetLabels.push({ s, div: label('label3d sheet', '', new THREE.Vector3(b.x0 - cx + 2, 0.5, b.y0 - cz + 1)) });
  }

  const pickables = [];
  const units = new Map();

  for (const w of WAREHOUSES) {
    const color = new THREE.Color(w.color);
    const base = w.base;

    const slab = new THREE.Mesh(extrude(w.outline, base + 0.3), mat(color, 1));
    slab.position.y = -0.0;
    const volGeo = extrude(w.outline, WALL_HEIGHT);
    const vol = new THREE.Mesh(volGeo, mat(color, 0.16));
    vol.position.y = base + 0.3;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(volGeo), edgeMat(0.55));
    edges.position.y = vol.position.y;

    const mezz = [];
    const mezzEdges = [];
    for (const poly of w.mezz) {
      const g = extrude(poly, 0.3);
      const m = new THREE.Mesh(g, mat(color.clone().offsetHSL(0, -0.1, 0.12), 0.85));
      m.position.y = base + 0.3 + w.mezzAbove;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat(0.7));
      e.position.y = m.position.y;
      mezz.push(m); mezzEdges.push(e);
    }

    for (const m of [slab, vol, ...mezz]) {
      m.userData.id = w.id;
      pickables.push(m);
    }
    scene.add(slab, vol, edges, ...mezz, ...mezzEdges);

    const ccx = (w.bbox.x0 + w.bbox.x1) / 2 - cx;
    const ccz = (w.bbox.y0 + w.bbox.y1) / 2 - cz;
    const div = label('label3d', '', new THREE.Vector3(ccx, base + WALL_HEIGHT + 2.5, ccz));
    div.addEventListener('pointerdown', (e) => e.stopPropagation());
    div.addEventListener('click', () => onSelect(w.id));
    units.set(w.id, { slab, vol, edges, mezz, mezzEdges, div, color, w });
  }

  // ---- Box-capacity layout (instanced: one draw call per unit) ----------------
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const flatGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const boxUnits = new Map(); // id → { boxes, flat }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const vp = new THREE.Vector3();
  const vs = new THREE.Vector3();
  let boxView = { show: false, floor: 'all', selected: null };

  function clearBoxes() {
    for (const u of boxUnits.values()) {
      for (const m of [u.boxes, u.flat, u.idle]) {
        if (!m) continue;
        scene.remove(m);
        m.material.dispose();
        m.dispose();
        const i = pickables.indexOf(m);
        if (i >= 0) pickables.splice(i, 1);
      }
    }
    boxUnits.clear();
  }

  /** Build instanced boxes for all units; returns { columns } (true = simplified). */
  function setBoxes(results, levels) {
    clearBoxes();
    if (!results) return { columns: false };
    // Only kept positions that hold a FULL `levels` stack are drawn as boxes
    // (same set as the scenario totals); reserved / too-low positions are
    // shown as flat grey footprints.
    const isFull = (L, i) => !L.reserved[i] && L.caps[i] >= levels;
    let total = 0;
    for (const r of results.values()) total += r.layout.eligible[levels] * levels;
    const columns = total > MAX_BOX_INSTANCES;
    for (const w of WAREHOUSES) {
      const r = results.get(w.id);
      if (!r) continue;
      const L = r.layout;
      const y0 = w.base + 0.3;
      const n = columns ? L.eligible[levels] : L.eligible[levels] * levels;
      const boxes = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial({
        color: new THREE.Color(w.color).offsetHSL(0, 0.05, -0.1),
      }), Math.max(n, 1));
      let k = 0;
      const idle = [];
      L.stacks.forEach((st, i) => {
        if (!isFull(L, i)) { idle.push(st); return; }
        const lv = levels;
        const x = (st[0] + st[2]) / 2 - cx;
        const z = (st[1] + st[3]) / 2 - cz;
        const sx = st[2] - st[0];
        const sz = st[3] - st[1];
        if (columns) {
          const h = stackHeight(lv);
          m4.compose(vp.set(x, y0 + h / 2, z), q, vs.set(sx, h, sz));
          boxes.setMatrixAt(k++, m4);
        } else {
          for (let l = 0; l < lv; l++) {
            m4.compose(vp.set(x, y0 + l * (BOX.H + GAP_V) + BOX.H / 2, z), q, vs.set(sx, BOX.H, sz));
            boxes.setMatrixAt(k++, m4);
          }
        }
      });
      boxes.count = k;
      boxes.instanceMatrix.needsUpdate = true;
      boxes.computeBoundingSphere();
      boxes.userData.id = w.id;

      const rects = [...L.aisles, ...L.cross];
      let flat = null;
      if (rects.length) {
        flat = new THREE.InstancedMesh(flatGeo, new THREE.MeshBasicMaterial({
          color: 0xf3d27a, transparent: true, opacity: 0.55, depthWrite: false,
        }), rects.length);
        rects.forEach((a, i) => {
          m4.compose(vp.set((a[0] + a[2]) / 2 - cx, y0 + 0.03, (a[1] + a[3]) / 2 - cz), q, vs.set(a[2] - a[0], 1, a[3] - a[1]));
          flat.setMatrixAt(i, m4);
        });
        flat.instanceMatrix.needsUpdate = true;
        flat.computeBoundingSphere();
      }
      let idleMesh = null;
      if (idle.length) {
        idleMesh = new THREE.InstancedMesh(flatGeo, new THREE.MeshBasicMaterial({
          color: 0x9aa5b1, transparent: true, opacity: 0.7, depthWrite: false,
        }), idle.length);
        idle.forEach((a, i) => {
          m4.compose(vp.set((a[0] + a[2]) / 2 - cx, y0 + 0.04, (a[1] + a[3]) / 2 - cz), q, vs.set(a[2] - a[0], 1, a[3] - a[1]));
          idleMesh.setMatrixAt(i, m4);
        });
        idleMesh.instanceMatrix.needsUpdate = true;
        idleMesh.computeBoundingSphere();
      }
      scene.add(boxes);
      if (flat) scene.add(flat);
      if (idleMesh) scene.add(idleMesh);
      pickables.push(boxes);
      boxUnits.set(w.id, { boxes, flat, idle: idleMesh });
    }
    applyBoxView();
    return { columns };
  }

  function applyBoxView() {
    const { show, floor, selected } = boxView;
    for (const [id, u] of boxUnits) {
      const vis = show && floor !== 'upper';
      const dim = !!selected && id !== selected;
      u.boxes.visible = vis;
      u.boxes.material.transparent = dim;
      u.boxes.material.opacity = dim ? 0.25 : 1;
      u.boxes.material.depthWrite = !dim;
      if (u.flat) u.flat.visible = vis && !dim;
      if (u.idle) u.idle.visible = vis && !dim;
    }
  }

  // Level-step annotation on the NAU 3 / NAU 4–6 wall line (x = 47.5)
  const stepDiv = label('label3d step', '', new THREE.Vector3(47.5 - cx, 2.2, 44 - cz));

  function relabel() {
    for (const { s, div } of sheetLabels) div.textContent = t(s.titleKey);
    for (const u of units.values()) {
      u.div.innerHTML = `<b>${u.w.name}</b><span>Σ ${fmt(u.w.areas.total)} m²</span>`;
    }
    stepDiv.textContent = `NAU 4–6: ${t('step')}`;
  }
  relabel();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minDistance = 15;
  controls.maxDistance = span * 3;

  function resetView() {
    camera.position.set(span * 0.2, span * 0.55, span * 0.8);
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
    relabel,
    setBoxes,
    setActive(on) {
      if (on && !running) { running = true; resize(); requestAnimationFrame(loop); }
      if (!on) running = false;
    },
    update({ selected, floor, boxes }) {
      boxView = { show: !!boxes, floor, selected };
      applyBoxView();
      for (const [id, u] of units) {
        const on = id === selected;
        const dim = selected && !on;
        const showGround = floor !== 'upper';
        const showMezz = floor !== 'ground';

        u.slab.material.opacity = showGround ? (dim ? 0.45 : 1) : 0.2;
        u.slab.material.depthWrite = u.slab.material.opacity > 0.9;
        u.vol.visible = showGround;
        u.vol.material.opacity = on ? 0.3 : dim ? 0.06 : 0.16;
        u.edges.visible = showGround || on;
        u.edges.material.color.set(on ? 0x000000 : 0x1d2733);
        u.edges.material.opacity = on ? 1 : dim ? 0.2 : 0.55;

        for (const m of u.mezz) {
          m.visible = showMezz;
          m.material.opacity = dim ? 0.3 : 0.9;
          m.material.emissive.copy(on ? u.color : new THREE.Color(0));
          m.material.emissiveIntensity = on ? 0.35 : 0;
        }
        for (const e of u.mezzEdges) e.visible = showMezz;
        for (const m of [u.slab.material, u.vol.material]) {
          m.emissive.copy(on ? u.color : new THREE.Color(0));
          m.emissiveIntensity = on ? 0.35 : 0;
        }
        u.div.classList.toggle('selected', on);
        u.div.classList.toggle('dim', !!dim);
      }
    },
  };
}
