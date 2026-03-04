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
  // IMPORTANT: Set your repo base here (GitHub Pages: https://USER.github.io/REPO/)
  const BASE = "/testche-model";

  // Building model path
  const BUILDING_URL = `${BASE}/models/Testche.glb`;

  // Floors shown on the right table (edit freely)
  const floors = [
    { key: "EG", name: "Etage EG", floor: "EG", size: "—", price: "—", status: "free" },
    { key: "1OG", name: "Etage 1. OG", floor: "1OG", size: "—", price: "—", status: "free" },
    { key: "2OG", name: "Etage 2. OG", floor: "2OG", size: "—", price: "—", status: "reserved" },
    { key: "3OG", name: "Etage 3. OG", floor: "3OG", size: "—", price: "—", status: "free" },
    { key: "4OG", name: "Etage 4. OG", floor: "4OG", size: "—", price: "—", status: "sold" },
  ];

  // Hover highlight colors by status
  const STATUS_COLOR = {
    free: new THREE.Color(0x00ff88),
    reserved: new THREE.Color(0xffcc00),
    sold: new THREE.Color(0xff4444),
  };

  // Optional: tint floors differently (keeps textures, just tints)
  const FLOOR_BASE_COLORS = {
    EG: 0xe74c3c,
    "1OG": 0x3498db,
    "2OG": 0x2ecc71,
    "3OG": 0xf1c40f,
    "4OG": 0x9b59b6,
  };

  // Camera fly targets per floor (placeholders; tweak later)
  const ENTRY = {
    EG: { cam: new THREE.Vector3(10, 6, 10), target: new THREE.Vector3(0, 2, 0) },
    "1OG": { cam: new THREE.Vector3(10, 10, 10), target: new THREE.Vector3(0, 6, 0) },
    "2OG": { cam: new THREE.Vector3(10, 14, 10), target: new THREE.Vector3(0, 10, 0) },
    "3OG": { cam: new THREE.Vector3(10, 18, 10), target: new THREE.Vector3(0, 14, 0) },
    "4OG": { cam: new THREE.Vector3(10, 22, 10), target: new THREE.Vector3(0, 18, 0) },
  };

  // Map floorKey -> tourKey (for now everything goes to W1)
  function tourKeyFromFloorKey(_floorKey) {
    return "W1";
  }

  // ---------------- TOUR DATA (SCALABLE) ----------------
  // ✅ NO manual yaw/pitch.
  // You only provide: pano position in the apartment (pos) and camera yaw (yawDeg).
  // Hotspots are computed automatically from the graph edges (links).
  //
  // Folder suggestion:
  //   /panos/W1/01.png ... 04.png
  //
  // For big projects: move this into JSON and load via fetch (function is included below).
  const TOURS = {
    W1: {
      label: "Wohnung W1",
      start: "p1",
      // World positions are arbitrary units (meters-ish). Only relative layout matters.
      nodes: {
        p1: { title: "Spot 1", src: `${BASE}/panos/W1/01.png`, pos: [0, 0, 0], yawDeg: 0, links: ["p2", "p3"] },
        p2: { title: "Spot 2", src: `${BASE}/panos/W1/02.png`, pos: [3, 0, 1], yawDeg: 90, links: ["p1", "p4"] },
        p3: { title: "Spot 3", src: `${BASE}/panos/W1/03.png`, pos: [-2, 0, 2], yawDeg: -45, links: ["p1", "p4"] },
        p4: { title: "Spot 4", src: `${BASE}/panos/W1/04.png`, pos: [5, 0, 2], yawDeg: 130, links: ["p2", "p3"] },
      },
      // Visual hotspot pitch: negative means "towards floor"
      hotspotPitchDeg: -35,
    },
  };

  // Optional: if you want to load a tour from JSON instead of inline:
  // JSON format expected: same as TOURS.W1 shape (label,start,nodes,hotspotPitchDeg).
  async function loadTourJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Tour JSON fetch failed: ${res.status} ${url}`);
    return await res.json();
  }

  // ---------------- RIGHT TABLE ----------------
  function renderTable(highlightKey = null) {
    if (!infoRows) return;
    infoRows.innerHTML = floors
      .map((f) => {
        const active = highlightKey === f.key;
        return `
        <tr ${active ? `style="background:rgba(0,0,0,0.05)"` : ""}>
          <td>${f.name}</td>
          <td>${f.floor}</td>
          <td>${f.size}</td>
          <td>${f.price}</td>
          <td>${f.status}</td>
        </tr>
      `;
      })
      .join("");

    if (panelNote) {
      panelNote.textContent = highlightKey ? `Hover: ${highlightKey}` : "Hover über Etagen — Click zum Reingehen";
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

  // ---------------- UI: Fade + Back Button + Hotspot Layer ----------------
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
  wrapper.appendChild(hotspotLayer);

  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse {
      0% { transform: scale(0.90); opacity: 0.35; }
      70% { transform: scale(1.25); opacity: 0.00; }
      100% { transform: scale(1.25); opacity: 0.00; }
    }
  `;
  document.head.appendChild(style);

  // ---------------- MODEL (BUILDING) ----------------
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);

  let mode = "building"; // "building" | "tour"

  let buildingRoot = null;
  let root = null;
  let pickMeshes = [];

  const floorGroups = new Map(); // key->Object3D
  const floorBaseMaterials = new Map(); // key -> Map(mesh->mat)

  function floorKeyFromName(nameRaw) {
    const n = (nameRaw || "").toUpperCase().replace(/\s+/g, "");
    if (n === "EG" || n.includes("ERDGESCHOSS")) return "EG";
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
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map((m) => cloneAndTint(m, hex));
    else mesh.material = cloneAndTint(mesh.material, hex);
  }

  function cacheMaterialsForGroup(key, group) {
    const map = new Map();
    group.traverse((o) => {
      if (o.isMesh) map.set(o, o.material);
    });
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
    root.traverse((obj) => {
      const key = floorKeyFromName(obj.name);
      if (key && !floorGroups.has(key)) floorGroups.set(key, obj);
    });
    console.log("Floor groups found:", [...floorGroups.keys()]);

    for (const [key, group] of floorGroups.entries()) {
      cacheMaterialsForGroup(key, group);
      const hex = FLOOR_BASE_COLORS[key] ?? 0xcccccc;
      group.traverse((o) => {
        if (o.isMesh) applyTintToMesh(o, hex);
      });
      cacheMaterialsForGroup(key, group); // save "base tinted"
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
        window.root = root; // debug access
        scene.add(root);

        pickMeshes = [];
        root.traverse((obj) => {
          if (obj.isMesh) pickMeshes.push(obj);
        });
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
  const hoverOriginalMaterials = new Map(); // mesh->mat

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

    hoveredRoot.traverse((child) => {
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
    group.traverse((child) => {
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

  function onPointerMove(event) {
    if (!root || mode !== "building") return;

    setPointerFromEvent(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickMeshes, true);

    if (!hits.length) {
      resetHighlight();
      renderTable(null);
      return;
    }

    const hitObj = hits[0].object;
    const key = findKeyByWalkingParents(hitObj);

    if (!key) {
      resetHighlight();
      renderTable(null);
      return;
    }
    if (hoveredKey === key) return;

    resetHighlight();
    hoveredKey = key;
    hoveredRoot = floorGroups.get(key) || hitObj;

    const data = floors.find((f) => f.key === key);
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
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

  // ---------------- PANORAMA TOUR (AUTO HOTSPOTS) ----------------
  const pano = {
    root: new THREE.Group(),
    sphere: null,
    texLoader: new THREE.TextureLoader(),
    cache: new Map(), // src -> texture
    currentTour: null,
    currentNode: null,
    hotspotPitchDeg: -35,
  };

  pano.root.visible = false;
  scene.add(pano.root);

  function setMode(next) {
    mode = next;
    if (buildingRoot) buildingRoot.visible = mode === "building";
    pano.root.visible = mode === "tour";
    hotspotLayer.style.display = mode === "tour" ? "block" : "none";
    backBtn.style.display = mode === "tour" ? "block" : "none";

    if (mode === "tour") {
      // lock zoom/pan so it's a proper panorama look-around
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.minDistance = 0.01;
      controls.maxDistance = 0.01;
    } else {
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.minDistance = 0.1;
      controls.maxDistance = Infinity;
    }
  }

  async function getTexture(src) {
    if (pano.cache.has(src)) return pano.cache.get(src);

    const tex = await new Promise((resolve, reject) => {
      pano.texLoader.load(
        src,
        (t) => resolve(t),
        undefined,
        (e) => reject(e)
      );
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

  // ---- Hotspots (DOM) ----
  let hotspotEls = []; // { el, yawRad, pitchRad, to }
  function clearHotspots() {
    hotspotEls.forEach((h) => h.el.remove());
    hotspotEls = [];
  }

  function makeSpotElement(label) {
    const el = document.createElement("div");
    el.title = label || "";
    el.style.position = "absolute";
    el.style.width = "18px";
    el.style.height = "18px";
    el.style.borderRadius = "999px";
    el.style.background = "rgba(255,255,255,0.95)";
    el.style.border = "2px solid rgba(0,0,0,0.35)";
    el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
    el.style.transform = "translate(-50%,-50%)";
    el.style.pointerEvents = "auto";
    el.style.cursor = "pointer";

    const ring = document.createElement("div");
    ring.style.position = "absolute";
    ring.style.inset = "-10px";
    ring.style.borderRadius = "999px";
    ring.style.border = "2px solid rgba(255,255,255,0.35)";
    ring.style.animation = "pulse 1.6s infinite";
    el.appendChild(ring);

    return el;
  }

  // Convert world-direction to yaw relative to node yaw
  function computeYawDegFromPositions(nodeA, nodeB, nodeYawDeg) {
    const a = new THREE.Vector3(...nodeA.pos);
    const b = new THREE.Vector3(...nodeB.pos);
    const v = b.clone().sub(a);
    // yaw in world: atan2(x, z)
    const yawWorld = THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z));
    // hotspot yaw in pano space = worldYaw - cameraYaw
    let yawLocal = yawWorld - (nodeYawDeg || 0);
    // normalize to [-180,180]
    yawLocal = ((yawLocal + 180) % 360) - 180;
    return yawLocal;
  }

  function buildAutoHotspots(tour, nodeId) {
    clearHotspots();
    const node = tour.nodes[nodeId];
    if (!node) return;

    const pitchDeg = tour.hotspotPitchDeg ?? pano.hotspotPitchDeg ?? -35;

    (node.links || []).forEach((toId) => {
      const toNode = tour.nodes[toId];
      if (!toNode) return;

      const yawDeg = computeYawDegFromPositions(node, toNode, node.yawDeg);
      const el = makeSpotElement(`${toNode.title || toId}`);

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

    hotspotEls.forEach((h) => {
      // direction from yaw/pitch (local)
      const x = Math.cos(h.pitchRad) * Math.sin(h.yawRad);
      const y = Math.sin(h.pitchRad);
      const z = Math.cos(h.pitchRad) * Math.cos(h.yawRad);

      const v = new THREE.Vector3(x, y, z).project(camera);

      // if behind camera, hide
      if (v.z > 1) {
        h.el.style.display = "none";
        return;
      }

      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;

      h.el.style.display = "block";
      h.el.style.left = `${sx}px`;
      h.el.style.top = `${sy}px`;

      const onScreen = sx >= -50 && sx <= rect.width + 50 && sy >= -50 && sy <= rect.height + 50;
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

    // Build auto hotspots from positions graph
    buildAutoHotspots(tour, nodeId);

    if (loaderEl) loaderEl.style.display = "none";
    if (loaderInfo) loaderInfo.textContent = "";

    await setFade(false);
  }

  async function enterTour(tourKey) {
    // Option A: inline
    let tour = TOURS[tourKey];

    // Option B: load JSON (uncomment if you want)
    // let tour = await loadTourJson(`${BASE}/tour/${tourKey}.json`);

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

  // ---------------- CLICK: fly-in then tour ----------------
  renderer.domElement.addEventListener("click", async (e) => {
    if (!root || mode !== "building") return;

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

  // ---------------- LOOP ----------------
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateHotspotPositions();
    renderer.render(scene, camera);
  }
  animate();

  // auto-load building when you call viewer.loadModel()
  return { loadModel, exitTour };
}
