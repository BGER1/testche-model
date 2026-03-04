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

  // ---------------- DATA ----------------
  // Floors (keys must match node names in GLB like EG, 1OG, ...)
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

  // Static base color per floor (optional; keep if you want)
  const FLOOR_BASE_COLORS = {
    EG: 0xe74c3c,
    "1OG": 0x3498db,
    "2OG": 0x2ecc71,
    "3OG": 0xf1c40f,
    "4OG": 0x9b59b6,
  };

  // ---------------- TOUR CONFIG ----------------
  // One apartment (W1) with 6 panorama photos.
  // Replace the file paths with your real ones.
  // You can later map floor->apartment (EG->W1 etc.). For now: clicking any floor enters W1.
const BASE = "/testche-model"; // GitHub Pages repo base
const TOUR = {
  W1: {
    start: "p1",
    nodes: {
      p1: {
        title: "Spot 1",
        src: `${BASE}/panos/W1/01.png`,
        links: [
          { to: "p2", label: "→ Spot 2" },
          { to: "p3", label: "→ Spot 3" },
        ],
      },
      p2: {
        title: "Spot 2",
        src: `${BASE}/panos/W1/02.png`,
        links: [
          { to: "p1", label: "→ Spot 1" },
          { to: "p4", label: "→ Spot 4" },
        ],
      },
      p3: {
        title: "Spot 3",
        src: `${BASE}/panos/W1/03.png`,
        links: [
          { to: "p1", label: "→ Spot 1" },
          { to: "p4", label: "→ Spot 4" },
        ],
      },
      p4: {
        title: "Spot 4",
        src: `${BASE}/panos/W1/04.png`,
        links: [
          { to: "p2", label: "→ Spot 2" },
          { to: "p3", label: "→ Spot 3" },
        ],
      },
    },
  },
};

  // Map a clicked floor -> which tour to open
  function tourKeyFromFloorKey(floorKey) {
    // TODO later: map EG->W01, 1OG->W02 etc.
    return "W1";
  }

  // Camera fly targets per floor (placeholder values; tweak once)
  const ENTRY = {
    EG:   { cam: new THREE.Vector3(10, 6, 10), target: new THREE.Vector3(0, 2, 0) },
    "1OG":{ cam: new THREE.Vector3(10,10, 10), target: new THREE.Vector3(0, 6, 0) },
    "2OG":{ cam: new THREE.Vector3(10,14, 10), target: new THREE.Vector3(0,10, 0) },
    "3OG":{ cam: new THREE.Vector3(10,18, 10), target: new THREE.Vector3(0,14, 0) },
    "4OG":{ cam: new THREE.Vector3(10,22, 10), target: new THREE.Vector3(0,18, 0) },
  };

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
        </tr>
      `;
    }).join("");

    if (panelNote) {
      panelNote.textContent = highlightKey ? `Hover: ${highlightKey}` : "Hover über Etagen — click zum Reingehen";
    }
  }
  renderTable(null);

  // ---------------- THREE SETUP ----------------
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

  // ---------------- UI: Fade + Tour Panel ----------------
  const fade = document.createElement("div");
  fade.style.position = "absolute";
  fade.style.inset = "0";
  fade.style.background = "#000";
  fade.style.opacity = "0";
  fade.style.pointerEvents = "none";
  fade.style.transition = "opacity 260ms ease";
  fade.style.borderRadius = "0";
  wrapper.style.position = "relative";
  wrapper.appendChild(fade);

  const tourPanel = document.createElement("div");
  tourPanel.style.position = "absolute";
  tourPanel.style.left = "12px";
  tourPanel.style.bottom = "12px";
  tourPanel.style.padding = "10px 12px";
  tourPanel.style.background = "rgba(255,255,255,0.92)";
  tourPanel.style.border = "1px solid rgba(0,0,0,0.08)";
  tourPanel.style.borderRadius = "12px";
  tourPanel.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  tourPanel.style.fontSize = "13px";
  tourPanel.style.display = "none";
  tourPanel.style.maxWidth = "320px";
  tourPanel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)";
  wrapper.appendChild(tourPanel);

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

  // ---------------- MODEL (BUILDING) ----------------
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);

  let root = null;
  let buildingRoot = null;
  let pickMeshes = [];
  let mode = "building"; // "building" | "tour"

  // Map floorKey -> Object3D
  const floorGroups = new Map();

  // Keep base materials (so hover highlight can restore)
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
      // cache current mats
      cacheMaterialsForGroup(key, group);

      const hex = FLOOR_BASE_COLORS[key] ?? 0xcccccc;
      group.traverse(o => { if (o.isMesh) applyTintToMesh(o, hex); });

      // cache "base tinted" mats
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

  function loadModel(url) {
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
        root.traverse(obj => { if (obj.isMesh) pickMeshes.push(obj); });
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
  const hoverOriginalMaterials = new Map(); // mesh -> mat (base)

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

  function flyCameraTo(entry, ms = 1200) {
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

  // ---------------- PANORAMA TOUR (D5) ----------------
  const pano = {
    root: new THREE.Group(),
    sphere: null,
    texLoader: new THREE.TextureLoader(),
    currentTour: null,
    currentNode: null,
    cache: new Map(), // src -> texture
  };

  pano.root.visible = false;
  scene.add(pano.root);

  function setMode(next) {
    mode = next;
    if (buildingRoot) buildingRoot.visible = (mode === "building");
    pano.root.visible = (mode === "tour");

    // controls behavior
    if (mode === "tour") {
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

  function getTexture(src) {
    if (pano.cache.has(src)) return Promise.resolve(pano.cache.get(src));

    return new Promise((resolve, reject) => {
      pano.texLoader.load(
        src,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          pano.cache.set(src, tex);
          resolve(tex);
        },
        undefined,
        reject
      );
    });
  }

  function ensureSphere() {
    if (pano.sphere) return;

    const geom = new THREE.SphereGeometry(50, 64, 48);
    geom.scale(-1, 1, 1); // view from inside

    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    pano.sphere = new THREE.Mesh(geom, mat);
    pano.root.add(pano.sphere);
  }

  async function showTourNode(nodeId) {
    const tour = pano.currentTour;
    const node = tour.nodes[nodeId];
    if (!node) throw new Error(`Missing node: ${nodeId}`);

    // small fade between panos
    await setFade(true);

    if (loaderEl) loaderEl.style.display = "block";
    if (loaderInfo) loaderInfo.textContent = `Loading: ${node.title}…`;

    const tex = await getTexture(node.src);

    ensureSphere();
    pano.sphere.material.map = tex;
    pano.sphere.material.needsUpdate = true;

    pano.currentNode = nodeId;

    // update UI
    renderTourUI(tour, nodeId);

    if (loaderEl) loaderEl.style.display = "none";
    if (loaderInfo) loaderInfo.textContent = "";

    await setFade(false);
  }

  function renderTourUI(tour, nodeId) {
    const node = tour.nodes[nodeId];

    // build buttons for links
    const linksHtml = (node.links || [])
      .map((l, idx) => `<button data-to="${l.to}" style="
          display:block;width:100%;text-align:left;
          padding:8px 10px;margin-top:6px;
          border-radius:10px;border:1px solid rgba(0,0,0,0.10);
          background:white;cursor:pointer;
        ">${l.label ?? `Go ${idx+1}`}</button>`)
      .join("");

    tourPanel.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:700">${tour === TOUR.W1 ? "Wohnung W1" : "Tour"}</div>
          <div style="opacity:0.75">${node.title}</div>
        </div>
        <button id="exitTourBtn" style="
          padding:8px 10px;border-radius:10px;border:1px solid rgba(0,0,0,0.12);
          background:#fff;cursor:pointer;font-weight:600;
        ">Exit</button>
      </div>
      <div style="margin-top:8px;opacity:0.85">Navigation</div>
      ${linksHtml}
      <div style="margin-top:10px;opacity:0.6;font-size:12px">Drag to look around</div>
    `;

    tourPanel.style.display = "block";

    const exitBtn = tourPanel.querySelector("#exitTourBtn");
    if (exitBtn) exitBtn.onclick = () => exitTour();

    tourPanel.querySelectorAll("button[data-to]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const to = btn.getAttribute("data-to");
        if (!to) return;
        await showTourNode(to);
      });
    });
  }

  async function enterTour(tourKey) {
    const tour = TOUR[tourKey];
    if (!tour) throw new Error(`Unknown tour: ${tourKey}`);

    pano.currentTour = tour;
    pano.currentNode = null;

    // Put camera at a tiny distance from origin, looking at origin.
    // (OrbitControls needs a non-zero radius)
    camera.position.set(0, 0, 0.01);
    controls.target.set(0, 0, 0);
    controls.update();

    setMode("tour");
    await showTourNode(tour.start);
  }

  async function exitTour() {
    await setFade(true);

    tourPanel.style.display = "none";
    pano.currentTour = null;
    pano.currentNode = null;

    setMode("building");
    if (buildingRoot) fitCamera(buildingRoot);

    await setFade(false);
  }

  // ---------------- CLICK: fly-in then tour ----------------
  renderer.domElement.addEventListener("click", async (e) => {
    if (!root || mode !== "building") return;

    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(pickMeshes, true);
    if (!hits.length) return;

    const key = findKeyByWalkingParents(hits[0].object);
    if (!key) return;

    const entry = ENTRY[key] || ENTRY["EG"];
    const tourKey = tourKeyFromFloorKey(key);

    try {
      if (loaderEl) loaderEl.style.display = "block";
      if (loaderInfo) loaderInfo.textContent = `Entering ${key}…`;

      // Smooth fly first
      await flyCameraTo(entry, 1100);

      // Crossfade into the tour
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
    renderer.render(scene, camera);
  }
  animate();

  return { loadModel };
}
