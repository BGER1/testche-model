import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js";

export function Viewer() {
  const wrapper = document.getElementById("viewerCanvasWrapper");
  const loaderEl = document.getElementById("loader");
  const loaderInfo = document.getElementById("loaderInfo");
  const infoRows = document.getElementById("infoRows");
  const panelNote = document.getElementById("panelNote");
  const availabilityToggle = document.getElementById("availabilityToggle");

  const detailsCard = document.getElementById("detailsCard");
  const detailsTitle = document.getElementById("detailsTitle");
  const detailsSubtitle = document.getElementById("detailsSubtitle");
  const detailsBadge = document.getElementById("detailsBadge");
  const detailsSize = document.getElementById("detailsSize");
  const detailsPrice = document.getElementById("detailsPrice");
  const detailsRooms = document.getElementById("detailsRooms");
  const detailsFloor = document.getElementById("detailsFloor");
  const detailsOrientation = document.getElementById("detailsOrientation");
  const detailsOutdoor = document.getElementById("detailsOutdoor");
  const detailsPlan = document.getElementById("detailsPlan");
  const detailsPlanEmpty = document.getElementById("detailsPlanEmpty");

  if (!wrapper) throw new Error("Missing #viewerCanvasWrapper");

  const BUILDING_URL =
    "https://dhhvajuaoebokmqswxad.supabase.co/storage/v1/object/public/models/Testche.glb";

  const SHEET_ID = "1wp3hwv9EFidEjsW-FdtniqcdWx_H-VQe_LcrQhelf3k";
  const SHEET_GID = "0";
  const SHEET_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;

  let units = [
    { key: "TOP1", number: "Top1", floor: "EG", size: "68 m²", price: "€ 289.000", status: "free", rooms: "2", orientation: "Süd-West", outdoor: "Terrasse 14 m²", plan: "" },
    { key: "TOP2", number: "Top2", floor: "1. OG", size: "74 m²", price: "€ 315.000", status: "reserved", rooms: "3", orientation: "Süd", outdoor: "Balkon 8 m²", plan: "" },
    { key: "TOP3", number: "Top3", floor: "2. OG", size: "81 m²", price: "€ 349.000", status: "free", rooms: "3", orientation: "Süd-Ost", outdoor: "Loggia 7 m²", plan: "" },
    { key: "TOP4", number: "Top4", floor: "3. OG", size: "90 m²", price: "€ 389.000", status: "free", rooms: "4", orientation: "West", outdoor: "Balkon 11 m²", plan: "" },
    { key: "TOP5", number: "Top5", floor: "4. OG", size: "112 m²", price: "Verkauft", status: "sold", rooms: "4", orientation: "Süd-West", outdoor: "Dachterrasse 28 m²", plan: "" }
  ];

  let showOnlyAvailable = false;

  const STATUS_COLOR = {
    free: new THREE.Color(0x1f9d55),
    reserved: new THREE.Color(0xc78b07),
    sold: new THREE.Color(0xb91c1c)
  };

  const STATUS_LABEL = {
    free: "Frei",
    reserved: "Reserviert",
    sold: "Verkauft"
  };

  const AUTO_ROTATE_DELAY_MS = 10000;
  const AUTO_ROTATE_START_DELAY_MS = 1200;

  function normalizeUnitKey(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (!raw) return "";

    const match = raw.match(/^TOP(\d+)$/);
    if (match) return `TOP${match[1]}`;

    if (/^\d+$/.test(raw)) return `TOP${raw}`;

    return "";
  }

  function unitKeyFromName(nameRaw) {
    const raw = String(nameRaw || "").trim().toUpperCase();
    const match = raw.match(/^TOP(\d+)$/);
    return match ? `TOP${match[1]}` : "";
  }

  function normalizeStatus(value) {
    const s = String(value || "").trim().toLowerCase();
    if (s === "free" || s === "frei") return "free";
    if (s === "reserved" || s === "reserviert") return "reserved";
    if (s === "sold" || s === "verkauft") return "sold";
    return s;
  }

  function statusBadge(status) {
    return `<span class="badge ${status}">${STATUS_LABEL[status] || status}</span>`;
  }

  function getUnitByKey(key) {
    const normalized = normalizeUnitKey(key);
    return units.find((u) => normalizeUnitKey(u.key) === normalized) || null;
  }

  function getVisibleUnits() {
    return showOnlyAvailable ? units.filter((u) => u.status === "free") : units;
  }

  function isUnitVisibleByFilter(key) {
    const unit = getUnitByKey(key);
    if (!unit) return false;
    if (!showOnlyAvailable) return true;
    return unit.status === "free";
  }

  function resolvePlanUrl(planValue) {
    return String(planValue || "").trim();
  }

  // ---------------- THREE SETUP ----------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrapper.appendChild(renderer.domElement);

  // subtle environment for better shading on building surfaces
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envRT = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04);
  scene.environment = envRT.texture;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.8;
  controls.minDistance = 4;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minPolarAngle = 0.22;
  controls.screenSpacePanning = false;
  controls.autoRotate = false;
  controls.autoRotateSpeed = -0.45; // clockwise

  // stronger lighting / more visible shading
  const ambient = new THREE.AmbientLight(0xffffff, 0.36);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xf6f8ff, 0xe8ecef, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 3.2);
  sun.position.set(32, 40, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xf4f6fb, 0.55);
  fill.position.set(-18, 16, -14);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(6, 10, -24);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.ShadowMaterial({ opacity: 0.22 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = 0;
  scene.add(ground);

  function resize() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  // ---------------- AUTO ROTATE / IDLE ----------------
  let idleTimer = null;
  let autoRotateEnabled = false;

  function setAutoRotate(enabled) {
    autoRotateEnabled = enabled;
    controls.autoRotate = enabled;
  }

  function scheduleAutoRotateRestart(delay = AUTO_ROTATE_DELAY_MS) {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      setAutoRotate(true);
    }, delay);
  }

  function onUserInteraction() {
    setAutoRotate(false);
    scheduleAutoRotateRestart(AUTO_ROTATE_DELAY_MS);
  }

  // ---------------- GOOGLE SHEETS ----------------
  async function fetchSheetData() {
    if (!SHEET_ID) return units;

    try {
      const res = await fetch(SHEET_URL, { cache: "no-store" });
      const text = await res.text();

      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");

      if (start === -1 || end === -1 || end <= start) {
        throw new Error("Google Sheets response could not be parsed.");
      }

      const jsonText = text.slice(start, end + 1);
      const data = JSON.parse(jsonText);

      const cols = (data.table?.cols || []).map((c) =>
        String(c.label || c.id || "").trim().toLowerCase()
      );
      const rows = data.table?.rows || [];

      const parsed = rows
        .map((row) => {
          const obj = {};

          cols.forEach((colName, i) => {
            const cell = row.c?.[i];
            obj[colName] = cell ? (cell.f ?? cell.v ?? "") : "";
          });

          const rawNumber = String(obj.number || "").trim();
          const normalizedKey = normalizeUnitKey(rawNumber);

          return {
            key: normalizedKey,
            number: rawNumber || normalizedKey,
            floor: String(obj.floor || "").trim(),
            size: String(obj.size || "").trim(),
            price: String(obj.price || "").trim(),
            status: normalizeStatus(obj.status),
            rooms: String(obj.rooms || "").trim(),
            orientation: String(obj.orientation || "").trim(),
            outdoor: String(obj.outdoor || "").trim(),
            plan: String(obj.plan || "").trim()
          };
        })
        .filter((u) => u.key && /^TOP[1-5]$/.test(u.key));

      if (parsed.length) {
        units = parsed;
        console.log("Loaded units from Google Sheets:", units);
      }

      return units;
    } catch (err) {
      console.error("Failed to load sheet data:", err);
      return units;
    }
  }

  // ---------------- MODEL ----------------
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);

  let root = null;
  let pickMeshes = [];
  const unitGroups = new Map();

  let hoveredKey = null;
  let selectedKey = null;

  const overlayClones = new Map();

  function collectUnitGroups() {
    unitGroups.clear();

    const allowedKeys = new Set(units.map((u) => normalizeUnitKey(u.key)));

    root.traverse((obj) => {
      const key = unitKeyFromName(obj.name);
      if (!key) return;
      if (!allowedKeys.has(key)) return;
      if (!unitGroups.has(key)) {
        unitGroups.set(key, obj);
      }
    });

    console.log("Unit groups found:", [...unitGroups.keys()]);
  }

  function normalizeMaterialForNeutralLook(material) {
    if (!material) return;

    if ("color" in material && material.color) {
      const hsl = {};
      material.color.getHSL(hsl);
      if (hsl.l > 0.6 && hsl.s < 0.2) {
        material.color.lerp(new THREE.Color(0xffffff), 0.18);
      }
    }

    if ("metalness" in material) material.metalness = 0.0;
    if ("roughness" in material) {
      material.roughness = Math.min(1, Math.max(0.60, material.roughness ?? 0.8));
    }

    material.needsUpdate = true;
  }

  function setGroupVisibleByFilter() {
    for (const [key, group] of unitGroups.entries()) {
      group.visible = isUnitVisibleByFilter(key);
    }

    pickMeshes = [];
    if (!root) return;
    root.traverse((o) => {
      if (o.isMesh && o.visible) pickMeshes.push(o);
    });
  }

  function clearOverlayGroup(key) {
    const normalized = normalizeUnitKey(key);
    const items = overlayClones.get(normalized);
    if (!items) return;

    items.forEach((mesh) => {
      if (mesh.parent) mesh.parent.remove(mesh);
      if (mesh.material) mesh.material.dispose();
    });

    overlayClones.delete(normalized);
  }

  function clearAllOverlays() {
    for (const key of Array.from(overlayClones.keys())) {
      clearOverlayGroup(key);
    }
  }

  function addOverlayGroup(key, tintColor, opacity = 0.45) {
    const normalized = normalizeUnitKey(key);
    const group = unitGroups.get(normalized);
    if (!group || !group.visible) return;

    clearOverlayGroup(normalized);

    const originals = [];
    group.traverse((child) => {
      if (child.isMesh && child.geometry && !child.userData.__isOverlay && child.visible) {
        originals.push(child);
      }
    });

    const clones = [];

    originals.forEach((child) => {
      const overlayMaterial = new THREE.MeshBasicMaterial({
        color: tintColor,
        transparent: true,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      });

      const overlay = new THREE.Mesh(child.geometry, overlayMaterial);
      overlay.userData.__isOverlay = true;
      overlay.renderOrder = 999;
      overlay.position.set(0, 0, 0);
      overlay.rotation.set(0, 0, 0);
      overlay.scale.set(1, 1, 1);

      child.add(overlay);
      clones.push(overlay);
    });

    overlayClones.set(normalized, clones);
  }

  function refreshVisualState() {
    clearAllOverlays();

    if (selectedKey && isUnitVisibleByFilter(selectedKey)) {
      const unit = getUnitByKey(selectedKey);
      const color = STATUS_COLOR[unit?.status] || new THREE.Color(0x3399ff);
      addOverlayGroup(selectedKey, color, 0.28);
    }

    if (hoveredKey && isUnitVisibleByFilter(hoveredKey)) {
      const unit = getUnitByKey(hoveredKey);
      const color = STATUS_COLOR[unit?.status] || new THREE.Color(0x3399ff);
      addOverlayGroup(hoveredKey, color, 0.50);
    }

    updateTableRowStates();
  }

  function updateTableRowStates() {
    const rows = infoRows?.querySelectorAll("tr[data-key]");
    if (!rows) return;

    rows.forEach((row) => {
      const key = normalizeUnitKey(row.getAttribute("data-key"));
      row.classList.toggle("is-active", key === normalizeUnitKey(selectedKey));
      row.classList.toggle("is-hover", key === normalizeUnitKey(hoveredKey));
    });
  }

  function renderTable() {
    if (!infoRows) return;

    const visibleUnits = getVisibleUnits();

    infoRows.innerHTML = visibleUnits.map((u) => {
      return `
        <tr data-key="${u.key}">
          <td>${u.number}</td>
          <td>${u.floor}</td>
          <td>${u.size}</td>
          <td>${u.price}</td>
          <td>${statusBadge(u.status)}</td>
        </tr>
      `;
    }).join("");

    const rows = infoRows.querySelectorAll("tr[data-key]");
    rows.forEach((row) => {
      row.addEventListener("mouseenter", () => {
        const key = row.getAttribute("data-key");
        hoveredKey = normalizeUnitKey(key);
        refreshVisualState();
      });

      row.addEventListener("mouseleave", () => {
        hoveredKey = null;
        refreshVisualState();
      });

      row.addEventListener("click", () => {
        const key = row.getAttribute("data-key");
        selectUnit(key);
        onUserInteraction();
      });
    });

    updateTableRowStates();
  }

  function showDetails(unit) {
    if (!unit || (showOnlyAvailable && unit.status !== "free")) {
      detailsCard?.classList.add("is-hidden");
      return;
    }

    detailsCard?.classList.remove("is-hidden");

    detailsTitle.textContent = unit.number || "—";
    detailsSubtitle.textContent = unit.floor ? `Etage: ${unit.floor}` : "Etage: —";
    detailsBadge.className = `badge ${unit.status}`;
    detailsBadge.textContent = STATUS_LABEL[unit.status] || unit.status;

    detailsSize.textContent = unit.size || "—";
    detailsPrice.textContent = unit.price || "—";
    detailsRooms.textContent = unit.rooms || "—";
    detailsFloor.textContent = unit.floor || "—";
    detailsOrientation.textContent = unit.orientation || "—";
    detailsOutdoor.textContent = unit.outdoor || "—";

    const planUrl = resolvePlanUrl(unit.plan);
    if (planUrl) {
      detailsPlan.src = planUrl;
      detailsPlan.classList.remove("is-hidden");
      detailsPlanEmpty.style.display = "none";
    } else {
      detailsPlan.removeAttribute("src");
      detailsPlan.classList.add("is-hidden");
      detailsPlanEmpty.style.display = "block";
    }

    if (panelNote) {
      panelNote.textContent = `${unit.number} ausgewählt.`;
    }
  }

  function flyCameraToGroup(key, ms = 900) {
    const group = unitGroups.get(normalizeUnitKey(key));
    if (!group) return Promise.resolve();

    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z);

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

    const endTarget = new THREE.Vector3(
      center.x,
      center.y + size.y * 0.18,
      center.z
    );

    const offset = camera.position.clone().sub(controls.target);
    const dir = offset.lengthSq() > 0 ? offset.clone().normalize() : new THREE.Vector3(1, 0.35, 1).normalize();
    const endPos = endTarget.clone().add(dir.multiplyScalar(Math.max(radius * 2.0, 8)));

    return new Promise((resolve) => {
      const t0 = performance.now();

      function ease(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }

      function step(now) {
        const t = Math.min(1, (now - t0) / ms);
        const k = ease(t);

        camera.position.lerpVectors(startPos, endPos, k);
        controls.target.lerpVectors(startTarget, endTarget, k);
        controls.update();

        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }

      requestAnimationFrame(step);
    });
  }

  async function selectUnit(key) {
    selectedKey = normalizeUnitKey(key);

    if (!isUnitVisibleByFilter(selectedKey)) {
      selectedKey = null;
      showDetails(null);
      refreshVisualState();
      return;
    }

    renderTable();
    showDetails(getUnitByKey(selectedKey));
    refreshVisualState();
    await flyCameraToGroup(selectedKey, 900);
  }

  function fitCamera(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    camera.position.set(
      center.x + maxDim * 0.52,
      center.y + maxDim * 0.20,
      center.z + maxDim * 0.66
    );

    controls.target.set(center.x - maxDim * 0.03, center.y + size.y * 0.16, center.z);
    controls.update();

    controls.minDistance = Math.max(4, maxDim * 0.30);
    controls.maxDistance = Math.max(20, maxDim * 4.2);

    const shadowRange = Math.max(size.x, size.z) * 1.35;
    sun.shadow.camera.left = -shadowRange;
    sun.shadow.camera.right = shadowRange;
    sun.shadow.camera.top = shadowRange;
    sun.shadow.camera.bottom = -shadowRange;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = Math.max(120, size.y * 10);

    ground.position.y = box.min.y - 0.03;
  }

  function loadModel(url) {
    return new Promise((resolve, reject) => {
      if (loaderEl) loaderEl.style.display = "block";
      if (loaderInfo) loaderInfo.textContent = "Loading…";

      gltfLoader.load(
        url,
        (gltf) => {
          root = gltf.scene;
          window.root = root;
          pickMeshes = [];

          root.traverse((o) => {
            if (o.isMesh) {
              pickMeshes.push(o);
              o.castShadow = true;
              o.receiveShadow = true;

              if (Array.isArray(o.material)) {
                o.material.forEach(normalizeMaterialForNeutralLook);
              } else {
                normalizeMaterialForNeutralLook(o.material);
              }
            }
          });

          scene.add(root);
          collectUnitGroups();
          setGroupVisibleByFilter();
          fitCamera(root);

          if (loaderEl) loaderEl.style.display = "none";
          if (loaderInfo) loaderInfo.textContent = "";

          resolve(root);
        },
        (ev) => {
          if (loaderInfo) {
            if (ev.total && ev.total > 0) {
              const p = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
              loaderInfo.textContent = `Loading… ${p}%`;
            } else {
              loaderInfo.textContent = "Loading…";
            }
          }
        },
        (err) => {
          console.error(err);
          if (loaderEl) loaderEl.style.display = "none";
          if (loaderInfo) loaderInfo.textContent = "Fehler beim Laden.";
          reject(err);
        }
      );
    });
  }

  // ---------------- POINTER ----------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function setPointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findKeyByWalkingParents(obj) {
    let cur = obj;
    while (cur && cur !== root) {
      const key = unitKeyFromName(cur.name);
      if (key) return key;
      cur = cur.parent;
    }
    return null;
  }

  function onPointerMove(e) {
    if (!root) return;

    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(pickMeshes, true);

    if (!hits.length) {
      hoveredKey = null;
      refreshVisualState();

      if (panelNote && selectedKey) {
        panelNote.textContent = `${getUnitByKey(selectedKey)?.number || ""} ausgewählt.`;
      } else if (panelNote) {
        panelNote.textContent = "Hover zeigt den Wohnungsstatus farblich.";
      }
      return;
    }

    const key = findKeyByWalkingParents(hits[0].object);
    if (!key) {
      hoveredKey = null;
      refreshVisualState();
      return;
    }

    if (!isUnitVisibleByFilter(key)) {
      hoveredKey = null;
      refreshVisualState();
      return;
    }

    const normalizedKey = normalizeUnitKey(key);

    if (hoveredKey !== normalizedKey) {
      hoveredKey = normalizedKey;
      refreshVisualState();

      const unit = getUnitByKey(hoveredKey);
      if (panelNote) {
        panelNote.textContent = unit
          ? `${unit.number} · ${STATUS_LABEL[unit.status]}`
          : `Hover: ${hoveredKey}`;
      }
    }
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", () => {
    hoveredKey = null;
    refreshVisualState();

    if (panelNote && selectedKey) {
      panelNote.textContent = `${getUnitByKey(selectedKey)?.number || ""} ausgewählt.`;
    } else if (panelNote) {
      panelNote.textContent = "Hover zeigt den Wohnungsstatus farblich.";
    }
  });

  // interaction hooks for auto-rotate idle logic
  controls.addEventListener("start", onUserInteraction);
  renderer.domElement.addEventListener("wheel", onUserInteraction, { passive: true });
  renderer.domElement.addEventListener("pointerdown", onUserInteraction);

  // ---------------- CLICK ----------------
  const clickState = {
    downX: 0,
    downY: 0,
    downTime: 0,
    isDown: false
  };

  const CLICK_MOVE_PX = 6;
  const CLICK_MAX_MS = 450;

  renderer.domElement.addEventListener("pointerdown", (e) => {
    clickState.isDown = true;
    clickState.downX = e.clientX;
    clickState.downY = e.clientY;
    clickState.downTime = performance.now();
  });

  renderer.domElement.addEventListener("pointerup", async (e) => {
    if (!clickState.isDown) return;
    clickState.isDown = false;

    const dx = e.clientX - clickState.downX;
    const dy = e.clientY - clickState.downY;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - clickState.downTime;

    if (dist > CLICK_MOVE_PX || dt > CLICK_MAX_MS) return;
    if (!root) return;

    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(pickMeshes, true);
    if (!hits.length) return;

    const key = findKeyByWalkingParents(hits[0].object);
    if (!key || !isUnitVisibleByFilter(key)) return;

    onUserInteraction();
    await selectUnit(key);
  });

  // ---------------- FILTER BUTTON ----------------
  function updateAvailabilityButton() {
    if (!availabilityToggle) return;
    availabilityToggle.classList.toggle("is-active", showOnlyAvailable);
    availabilityToggle.textContent = showOnlyAvailable
      ? "Alle Wohnungen anzeigen"
      : "Nur verfügbare Wohnungen anzeigen";
  }

  availabilityToggle?.addEventListener("click", () => {
    showOnlyAvailable = !showOnlyAvailable;
    hoveredKey = null;

    if (selectedKey && !isUnitVisibleByFilter(selectedKey)) {
      selectedKey = null;
      showDetails(null);
    }

    setGroupVisibleByFilter();
    renderTable();
    refreshVisualState();
    updateAvailabilityButton();
    onUserInteraction();
  });

  // ---------------- INIT ----------------
  async function init() {
    renderTable();
    showDetails(null);
    updateAvailabilityButton();

    await fetchSheetData();
    renderTable();
    updateAvailabilityButton();

    await loadModel(BUILDING_URL);

    if (loaderInfo) loaderInfo.textContent = "Loading… 100%";
    setTimeout(() => {
      if (loaderEl) loaderEl.style.display = "none";
      if (loaderInfo) loaderInfo.textContent = "";
    }, 120);

    // soft start, then autorotate
    setTimeout(() => {
      setAutoRotate(true);
      scheduleAutoRotateRestart(AUTO_ROTATE_DELAY_MS);
    }, AUTO_ROTATE_START_DELAY_MS);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  return { init };
}
