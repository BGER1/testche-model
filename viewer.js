import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js";

export function Viewer() {
  const wrapper = document.getElementById("viewerCanvasWrapper");
  const loaderEl = document.getElementById("loader");
  const loaderInfo = document.getElementById("loaderInfo");
  const infoRows = document.getElementById("infoRows");
  const panelNote = document.getElementById("panelNote");
  if (!wrapper) throw new Error("Missing #viewerCanvasWrapper");

  // ---------------- CONFIG ----------------
  const BASE = "/testche-model";
  const BUILDING_URL = `${BASE}/models/Testche.glb`;

  const floors = [
    { key: "EG",  name: "Etage EG",     floor: "EG",  size: "—", price: "—", status: "free" },
    { key: "1OG", name: "Etage 1. OG",  floor: "1OG", size: "—", price: "—", status: "free" },
    { key: "2OG", name: "Etage 2. OG",  floor: "2OG", size: "—", price: "—", status: "reserved" },
    { key: "3OG", name: "Etage 3. OG",  floor: "3OG", size: "—", price: "—", status: "free" },
    { key: "4OG", name: "Etage 4. OG",  floor: "4OG", size: "—", price: "—", status: "sold" },
  ];

  const STATUS_COLOR = {
    free: new THREE.Color(0x00ff88),
    reserved: new THREE.Color(0xffcc00),
    sold: new THREE.Color(0xff4444),
  };

  const FLOOR_BASE_COLORS = {
    EG: 0xe74c3c,
    "1OG": 0x3498db,
    "2OG": 0x2ecc71,
    "3OG": 0xf1c40f,
    "4OG": 0x9b59b6,
  };

  const ENTRY = {
    EG:   { cam: new THREE.Vector3(10,  6, 10), target: new THREE.Vector3(0,  2, 0) },
    "1OG":{ cam: new THREE.Vector3(10, 10, 10), target: new THREE.Vector3(0,  6, 0) },
    "2OG":{ cam: new THREE.Vector3(10, 14, 10), target: new THREE.Vector3(0, 10, 0) },
    "3OG":{ cam: new THREE.Vector3(10, 18, 10), target: new THREE.Vector3(0, 14, 0) },
    "4OG":{ cam: new THREE.Vector3(10, 22, 10), target: new THREE.Vector3(0, 18, 0) },
  };

  function tourKeyFromFloorKey(_floorKey) {
    return "W1";
  }

  // Auto-hotspots (pos + yawDeg + links)
  const TOURS = {
    W1: {
      label: "Wohnung W1",
      start: "p1",
      hotspotPitchDeg: -35,
      nodes: {
        p1: { title: "Spot 1", src: `${BASE}/panos/W1/01.png`, pos: [0, 0, 0],  yawDeg: 0,   links: ["p2", "p3"] },
        p2: { title: "Spot 2", src: `${BASE}/panos/W1/02.png`, pos: [3, 0, 1],  yawDeg: 90,  links: ["p1", "p4"] },
        p3: { title: "Spot 3", src: `${BASE}/panos/W1/03.png`, pos: [-2,0, 2],  yawDeg: -45, links: ["p1", "p4"] },
        p4: { title: "Spot 4", src: `${BASE}/panos/W1/04.png`, pos: [5, 0, 2],  yawDeg: 130, links: ["p2", "p3"] },
      },
    },
  };

  // ---------------- RIGHT TABLE ----------------
  function renderTable(highlightKey = null) {
    if (!infoRows) return;
    infoRows.innerHTML = floors.map(f => {
      const active = highlightKey === f.key;
      return `
        <tr ${active ? `style="background:rgba(0,0,0,0.05)"` : ""}>
          <td>${f.name}</td>
          <td>${f.floor}</td>
          <td>${f.size}</td>
          <td>${f.price}</td>
          <td>${f.status}</td>
        </tr>`;
    }).join("");

    if (panelNote) {
      panelNote.textContent = highlightKey
        ? `Hover: ${highlightKey}`
        : "Hover über Etagen — Click zum Reingehen";
    }
  }
  renderTable(null);

  // ---------------- THREE SETUP ----------------
  wrapper.style.position = "relative";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eeeeee");

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10000);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  wrapper.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Building feel
  controls.rotateSpeed = 0.8;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  function resize() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------------- UI (Fade / Back / Hotspot Layer) ----------------
  const fade = document.createElement("div");
  fade.style.position = "absolute";
  fade.style.inset = "0";
  fade.style.background = "#000";
  fade.style.opacity = "0";
  fade.style.pointerEvents = "none";
  fade.style.transition = "opacity 260ms ease";
  wrapper.appendChild(fade);

  function setFade(on) {
    return new Promise((resolve) => {
      const done = () => {
        fade.removeEventListener("transitionend", done);
        resolve();
      };
      fade.addEventListener("transitionend", done);
      fade.style.opacity = on ? "1" : "0";
    });
  }

  const backBtn = document.createElement("button");
  backBtn.textContent = "Zurück zur Übersicht";
  backBtn.style.position = "absolute";
  backBtn.style.right = "12px";
  backBtn.style.bottom = "12px";
  backBtn.style.padding = "10px 12px";
  backBtn.style.borderRadius = "12px";
  backBtn.style.border = "1px solid rgba(0,0,0,0.12)";
  backBtn.style.background = "rgba(255,255,255,0.92)";
  backBtn.style.cursor = "pointer";
  backBtn.style.fontWeight = "700";
  backBtn.style.display = "none";
  backBtn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)";
  wrapper.appendChild(backBtn);

  const hotspotLayer = document.createElement("div");
  hotspotLayer.style.position = "absolute";
  hotspotLayer.style.inset = "0";
  hotspotLayer.style.pointerEvents = "none";
  hotspotLayer.style.display = "none";
  wrapper.appendChild(hotspotLayer);

  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulseRing {
      0% { transform: scale(0.85); opacity: 0.45; }
      70% { transform: scale(1.35); opacity: 0.00; }
      100% { transform: scale(1.35); opacity: 0.00; }
    }
    .tour-spot {
      position:absolute;
      width: 34px; height: 34px;
      transform: translate(-50%,-50%);
      pointer-events:auto;
      cursor:pointer;
      border-radius: 999px;
      background: rgba(255,255,255,0.16);
      border: 3px solid rgba(255,255,255,0.90);
      box-shadow: 0 10px 26px rgba(0,0,0,0.30);
      backdrop-filter: blur(2px);
    }
    .tour-spot::after {
      content:"";
      position:absolute;
      inset: -12px;
      border-radius:999px;
      border: 3px solid rgba(255,255,255,0.40);
      animation: pulseRing 1.6s infinite;
    }
    .tour-spot:hover {
      transform: translate(-50%,-50%) scale(1.06);
    }
  `;
  document.head.appendChild(style);

  // ---------------- MODEL (BUILDING) ----------------
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);

  let mode = "building"; // "building" | "tour"
  let root = null;
  let buildingRoot = null;
  let pickMeshes = [];

  const floorGroups = new Map();
  const floorBaseMaterials = new Map();

  function floorKeyFromName(nameRaw) {
    const n = (nameRaw || "").toUpperCase().replace(/\s+/g, "");
    if (n === "EG"  || n.includes("ERDGESCHOSS")) return "EG";
    if (n === "1OG" || n.includes("1.OG") || n.includes("LEVEL1") || n.includes("FLOOR1")) return "1OG";
    if (n === "2OG" || n.includes("2.OG") || n.includes("LEVEL2") || n.includes("FLOOR2")) return "2OG";
    if (n === "3OG" || n.includes("3.OG") || n.includes("LEVEL3") || n.includes("FLOOR3")) return "3OG";
    if (n === "4OG" || n.includes("4.OG") || n.includes("LEVEL4") || n.includes("FLOOR4")) return "4OG";
    return null;
  }

  function cloneAndTint(material, hex) {
    if (!material) return material;
    const m = material.clone();
    if (m.color) m.color.setHex(hex);
    m.needsUpdate = true;
    return m;
  }

  function applyTintToMesh(mesh, hex) {
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(m => cloneAndTint(m, hex));
    else mesh.material = cloneAndTint(mesh.material, hex);
  }

  function cacheMaterialsForGroup(key, group) {
    const map = new Map();
    group.traverse(o => { if (o.isMesh) map.set(o, o.material); });
    floorBaseMaterials.set(key, map);
  }

  function restoreBaseForKey(key) {
    const map = floorBaseMaterials.get(key);
    if (!map) return;
    for (const [mesh, mat] of map.entries()) {
      if (mesh && mesh.isMesh) mesh.material = mat;
    }
  }

  function colorizeFloorsOnce() {
    floorGroups.clear();
    root.traverse(obj => {
      const key = floorKeyFromName(obj.name);
      if (key && !floorGroups.has(key)) floorGroups.set(key, obj);
    });
    console.log("Floor groups found:", [...floorGroups.keys()]);

    for (const [key, group] of floorGroups.entries()) {
      cacheMaterialsForGroup(key, group);
      const hex = FLOOR_BASE_COLORS[key] ?? 0xcccccc;
      group.traverse(o => { if (o.isMesh) applyTintToMesh(o, hex); });
      cacheMaterialsForGroup(key, group);
    }
  }

  function fitCamera(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    camera.position.copy(center);
    camera.position.x += size / 2;
    camera.position.y += size / 4;
    camera.position.z += size / 2;

    controls.target.copy(center);
    controls.update();
  }

  function loadModel(url = BUILDING_URL) {
    if (loaderEl) loaderEl.style.display = "block";
    if (loaderInfo) loaderInfo.textContent = "Loading…";

    gltfLoader.load(
      url,
      (gltf) => {
        root = gltf.scene;
        buildingRoot = root;
        window.root = root; // debug
        scene.add(root);

        pickMeshes = [];
        root.traverse(o => { if (o.isMesh) pickMeshes.push(o); });
        console.log("Meshes:", pickMeshes.length);

        colorizeFloorsOnce();
        fitCamera(root);

        if (loaderEl) loaderEl.style.display = "none";
        if (loaderInfo) loaderInfo.textContent = "";
      },
      (ev) => {
        if (loaderInfo && ev.total) {
          const p = Math.round((ev.loaded / ev.total) * 100);
          loaderInfo.textContent = `Loading… ${p}%`;
        }
      },
      (err) => {
        console.error(err);
        if (loaderInfo) loaderInfo.textContent = "Fehler beim Laden.";
        if (loaderEl) loaderEl.style.display = "none";
      }
    );
  }

  // ---------------- HOVER / HIGHLIGHT ----------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let hoveredKey = null;
  let hoveredRoot = null;
  const hoverOriginalMaterials = new Map();

  function setPointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findKeyByWalkingParents(obj) {
    let cur = obj;
    while (cur && cur !== root) {
      const key = floorKeyFromName(cur.name);
      if (key) return key;
      cur = cur.parent;
    }
    return null;
  }

  function resetHighlight() {
    if (!hoveredRoot) return;

    hoveredRoot.traverse(child => {
      if (!child.isMesh) return;
      if (hoverOriginalMaterials.has(child)) {
        child.material = hoverOriginalMaterials.get(child);
        hoverOriginalMaterials.delete(child);
      }
    });

    if (hoveredKey) restoreBaseForKey(hoveredKey);
    hoveredRoot = null;
    hoveredKey = null;
  }

  function applyHighlight(group, color) {
    group.traverse(child => {
      if (!child.isMesh || !child.material) return;

      if (!hoverOriginalMaterials.has(child)) hoverOriginalMaterials.set(child, child.material);

      const applyToMaterial = (m) => {
        const mat = m.clone();
        if (mat.emissive) {
          mat.emissive.set(color);
          mat.emissiveIntensity = 1.5;
        } else if (mat.color) {
          mat.color.set(color);
        }
        mat.needsUpdate = true;
        return mat;
      };

      if (Array.isArray(child.material)) child.material = child.material.map(applyToMaterial);
      else child.material = applyToMaterial(child.material);
    });
  }

  function onPointerMove(e) {
    if (!root || mode !== "building") return;

    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(pickMeshes, true);
    if (!hits.length) {
      resetHighlight();
      renderTable(null);
      return;
    }

    const key = findKeyByWalkingParents(hits[0].object);
    if (!key) {
      resetHighlight();
      renderTable(null);
      return;
    }
    if (hoveredKey === key) return;

    resetHighlight();
    hoveredKey = key;
    hoveredRoot = floorGroups.get(key) || hits[0].object;

    const data = floors.find(f => f.key === key);
    const color = data ? STATUS_COLOR[data.status] : new THREE.Color(0x00aaff);
    applyHighlight(hoveredRoot, color);
    renderTable(key);
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", () => {
    resetHighlight();
    renderTable(null);
  });

  // ---------------- CAMERA FLY ----------------
  function easeInOutCubic(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
  }

  function flyCameraTo(entry, ms = 1100) {
    return new Promise((resolve) => {
      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      const t0 = performance.now();

      function step(now) {
        const t = Math.min(1, (now - t0) / ms);
        const k = easeInOutCubic(t);

        camera.position.lerpVectors(startPos, entry.cam, k);
        controls.target.lerpVectors(startTarget, entry.target, k);
        controls.update();

        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  // ---------------- PANORAMA TOUR ----------------
  const pano = {
    root: new THREE.Group(),
    sphere: null,
    texLoader: new THREE.TextureLoader(),
    cache: new Map(),
    currentTour: null,
    currentNode: null,
    hotspotPitchDeg: -35,
  };
  pano.root.visible = false;
  scene.add(pano.root);

  function setMode(next) {
    mode = next;

    if (buildingRoot) buildingRoot.visible = (mode === "building");
    pano.root.visible = (mode === "tour");

    hotspotLayer.style.display = (mode === "tour") ? "block" : "none";
    backBtn.style.display = (mode === "tour") ? "block" : "none";

    if (mode === "tour") {
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.minDistance = 0.01;
      controls.maxDistance = 0.01;

      // ✅ Matterport-like “grab image”: invert drag direction
      controls.rotateSpeed = -0.75;
    } else {
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.minDistance = 0.1;
      controls.maxDistance = Infinity;

      controls.rotateSpeed = 0.8;
    }
  }

  async function getTexture(src) {
    if (pano.cache.has(src)) return pano.cache.get(src);

    const tex = await new Promise((resolve, reject) => {
      pano.texLoader.load(src, (t) => resolve(t), undefined, (e) => reject(e));
    });

    tex.colorSpace = THREE.SRGBColorSpace;
    pano.cache.set(src, tex);
    return tex;
  }

  function ensureSphere() {
    if (pano.sphere) return;

    const geom = new THREE.SphereGeometry(50, 64, 48);
    geom.scale(-1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    pano.sphere = new THREE.Mesh(geom, mat);
    pano.root.add(pano.sphere);
  }

  // ---- Hotspots ----
  let hotspotEls = []; // { el, yawRad, pitchRad, to }
  function clearHotspots() {
    hotspotEls.forEach(h => h.el.remove());
    hotspotEls = [];
  }

  function makeSpot(label) {
    const el = document.createElement("div");
    el.className = "tour-spot";
    el.title = label || "";
    return el;
  }

  function computeYawDegFromPositions(nodeA, nodeB, nodeYawDeg) {
    const a = new THREE.Vector3(...nodeA.pos);
    const b = new THREE.Vector3(...nodeB.pos);
    const v = b.clone().sub(a);

    const yawWorldDeg = THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z));
    let yawLocal = yawWorldDeg - (nodeYawDeg || 0);
    yawLocal = ((yawLocal + 180) % 360) - 180;
    return yawLocal;
  }

  function buildAutoHotspots(tour, nodeId) {
    clearHotspots();

    const node = tour.nodes[nodeId];
    if (!node) return;

    const pitchDeg = tour.hotspotPitchDeg ?? pano.hotspotPitchDeg ?? -35;

    (node.links || []).forEach(toId => {
      const toNode = tour.nodes[toId];
      if (!toNode) return;

      const yawDeg = computeYawDegFromPositions(node, toNode, node.yawDeg);
      const el = makeSpot(toNode.title || toId);

      el.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await showTourNode(toId);
      });

      hotspotLayer.appendChild(el);
      hotspotEls.push({
        el,
        to: toId,
        yawRad: THREE.MathUtils.degToRad(yawDeg),
        pitchRad: THREE.MathUtils.degToRad(pitchDeg),
      });
    });
  }

  function updateHotspotPositions() {
    if (mode !== "tour" || !pano.currentTour || !pano.currentNode) return;
    const rect = renderer.domElement.getBoundingClientRect();

    hotspotEls.forEach(h => {
      const x = Math.cos(h.pitchRad) * Math.sin(h.yawRad);
      const y = Math.sin(h.pitchRad);
      const z = Math.cos(h.pitchRad) * Math.cos(h.yawRad);

      const v = new THREE.Vector3(x, y, z).project(camera);

      if (v.z > 1) {
        h.el.style.display = "none";
        return;
      }

      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;

      h.el.style.display = "block";
      h.el.style.left = `${sx}px`;
      h.el.style.top = `${sy}px`;

      const onScreen = sx >= -60 && sx <= rect.width + 60 && sy >= -60 && sy <= rect.height + 60;
      h.el.style.opacity = onScreen ? "1" : "0";
    });
  }

  async function showTourNode(nodeId) {
    const tour = pano.currentTour;
    const node = tour?.nodes?.[nodeId];
    if (!tour || !node) throw new Error(`Missing node: ${nodeId}`);

    await setFade(true);

    if (loaderEl) loaderEl.style.display = "block";
    if (loaderInfo) loaderInfo.textContent = `Loading: ${node.title || nodeId}…`;

    ensureSphere();
    const tex = await getTexture(node.src);
    pano.sphere.material.map = tex;
    pano.sphere.material.needsUpdate = true;

    pano.currentNode = nodeId;

    buildAutoHotspots(tour, nodeId);

    if (loaderEl) loaderEl.style.display = "none";
    if (loaderInfo) loaderInfo.textContent = "";

    await setFade(false);
  }

  async function enterTour(tourKey) {
    const tour = TOURS[tourKey];
    if (!tour) throw new Error(`Unknown tour: ${tourKey}`);

    pano.currentTour = tour;
    pano.currentNode = null;
    pano.hotspotPitchDeg = tour.hotspotPitchDeg ?? -35;

    // Panorama camera setup
    camera.position.set(0, 0, 0.01);
    controls.target.set(0, 0, 0);
    controls.update();

    setMode("tour");
    await showTourNode(tour.start);
  }

  async function exitTour() {
    await setFade(true);

    clearHotspots();
    pano.currentTour = null;
    pano.currentNode = null;

    setMode("building");
    if (buildingRoot) fitCamera(buildingRoot);

    await setFade(false);
  }

  backBtn.addEventListener("click", () => exitTour());

  // ---------------- "REAL CLICK" DETECTION (Fix: no tour on drag-release) ----------------
  // We treat click only if pointer moved less than threshold between down/up.
  const clickState = {
    downX: 0,
    downY: 0,
    downTime: 0,
    isDown: false,
  };

  const CLICK_MOVE_PX = 6;
  const CLICK_MAX_MS = 550;

  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (mode !== "building") return;
    clickState.isDown = true;
    clickState.downX = e.clientX;
    clickState.downY = e.clientY;
    clickState.downTime = performance.now();
  });

  renderer.domElement.addEventListener("pointerup", async (e) => {
    if (mode !== "building") return;
    if (!clickState.isDown) return;
    clickState.isDown = false;

    const dx = e.clientX - clickState.downX;
    const dy = e.clientY - clickState.downY;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - clickState.downTime;

    // If user was orbiting (drag), ignore.
    if (dist > CLICK_MOVE_PX || dt > CLICK_MAX_MS) return;

    // ✅ This is a real click → raycast floor
    if (!root) return;

    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickMeshes, true);
    if (!hits.length) return;

    const key = findKeyByWalkingParents(hits[0].object);
    if (!key) return;

    const entry = ENTRY[key] || ENTRY.EG;
    const tourKey = tourKeyFromFloorKey(key);

    try {
      if (loaderEl) loaderEl.style.display = "block";
      if (loaderInfo) loaderInfo.textContent = `Entering ${key}…`;

      await flyCameraTo(entry, 1100);
      await enterTour(tourKey);

      if (loaderEl) loaderEl.style.display = "none";
      if (loaderInfo) loaderInfo.textContent = "";
    } catch (err) {
      console.error(err);
      if (loaderInfo) loaderInfo.textContent = "Fehler beim Öffnen der Tour.";
      if (loaderEl) loaderEl.style.display = "none";
    }
  });

  // ---------------- YAW CALIBRATION (K) ----------------
  // Use this to fix spot directions quickly: look where "forward" should be, press K.
  function getCameraYawDeg() {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    return THREE.MathUtils.radToDeg(e.y);
  }

  function setNodeYawToCurrentLook() {
    const tour = pano.currentTour;
    const nodeId = pano.currentNode;
    if (!tour || !nodeId) return;

    tour.nodes[nodeId].yawDeg = getCameraYawDeg();
    console.log(`[CALIB] ${nodeId} yawDeg =`, tour.nodes[nodeId].yawDeg.toFixed(1));
    buildAutoHotspots(tour, nodeId);
  }

  window.addEventListener("keydown", (e) => {
    if (mode !== "tour") return;
    if (e.key.toLowerCase() === "k") setNodeYawToCurrentLook();
    if (e.key === "Escape") exitTour();
  });

  // ---------------- LOOP ----------------
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateHotspotPositions();
    renderer.render(scene, camera);
  }
  animate();

  return { loadModel, exitTour };
}
