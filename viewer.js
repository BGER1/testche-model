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

  function normalizeUnitKey(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (!raw) return "";
    const compact = raw.replace(/\s+/g, "");
    if (/^\d+$/.test(compact)) return `TOP${compact}`;
    const match = compact.match(/(?:TOP|TOG)?(\d+)/);
    if (match) return `TOP${match[1]}`;
    return compact;
  }

  function normalizeStatus(value) {
    const s = String(value || "").trim().toLowerCase();
    if (s === "free" || s === "frei") return "free";
    if (s === "reserved" || s === "reserviert") return "reserved";
    if (s === "sold" || s === "verkauft") return "sold";
    return s;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrapper.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.8;
  controls.minDistance = 4;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minPolarAngle = 0.22;
  controls.screenSpacePanning = false;

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(24, 32, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = 0.015;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-12, 14, -10);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.ShadowMaterial({ opacity: 0.18 })
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

      const cols = (data.table?.cols || []).map(c => (c.label || c.id || "").trim().toLowerCase());
      const rows = data.table?.rows || [];

      const parsed = rows.map((row) => {
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
      }).filter(u => u.key);

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

  function resolvePlanUrl(planValue) {
    return planValue || "";
  }

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

  function statusBadge(status) {
    return `<span class="badge ${status}">${STATUS_LABEL[status] || status}</span>`;
  }

  function getUnitByKey(key) {
    const normalized = normalizeUnitKey(key);
    return units.find(u => normalizeUnitKey(u.key) === normalized) || null;
  }

  function unitKeyFromName(nameRaw) {
    return normalizeUnitKey(nameRaw);
  }

  function collectUnitGroups() {
    unitGroups.clear();

    root.traverse((obj) => {
      const key = unitKeyFromName(obj.name);
      if (key && /^TOP\d+$/.test(key) && !unitGroups.has(key)) {
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
        material.color.lerp(new THREE.Color(0xffffff), 0.25);
      }
    }

    if ("metalness" in material) material.metalness = 0.0;
    if ("roughness" in material) {
      material.roughness = Math.min(1, Math.max(0.72, material.roughness ?? 0.85));
    }

    material.needsUpdate = true;
  }

  function clearOverlayGroup(key) {
    const items = overlayClones.get(normalizeUnitKey(key));
    if (!items) return;
    items.forEach((mesh) => mesh.removeFromParent());
    overlayClones.delete(normalizeUnitKey(key));
  }

  function clearAllOverlays() {
    for (const key of overlayClones.keys()) {
      clearOverlayGroup(key);
    }
  }

  function addOverlayGroup(key, tintColor, opacity = 0.45) {
    const normalized = normalizeUnitKey(key);
    const group = unitGroups.get(normalized);
    if (!group) return;

    clearOverlayGroup(normalized);

    const clones = [];

    group.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;

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
      overlay.position.copy(child.position);
      overlay.rotation.copy(child.rotation);
      overlay.scale.copy(child.scale);
      overlay.renderOrder = 999;
      overlay.matrixAutoUpdate = true;

      child.add(overlay);
      clones.push(overlay);
    });

    overlayClones.set(normalized, clones);
  }

  function refreshVisualState() {
    clearAllOverlays();

    if (selectedKey) {
      const unit = getUnitByKey(selectedKey);
      const color = STATUS_COLOR[unit?.status] || new THREE.Color(0x3399ff);
      addOverlayGroup(selectedKey, color, 0.28);
    }

    if (hoveredKey) {
      const unit = getUnitByKey(hoveredKey);
      const color = STATUS_COLOR[unit?.status] || new THREE.Color(0x3399ff);
      addOverlayGroup(hoveredKey, color, 0.48);
    }
  }

  function renderTable(activeKey = null) {
    if (!infoRows) return;

    const normalizedActive = normalizeUnitKey(activeKey);

    infoRows.innerHTML = units.map((u) => {
      const isActive = normalizedActive === normalizeUnitKey(u.key);
      return `
        <tr class="${isActive ? "is-active" : ""}" data-key="${u.key}">
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
      row.addEventListener("click", () => {
        const key = row.getAttribute("data-key");
        selectUnit(key);
      });
    });
  }

  function showDetails(unit) {
    if (!unit) {
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

  function selectUnit(key) {
    selectedKey = normalizeUnitKey(key);
    renderTable(selectedKey);
    showDetails(getUnitByKey(selectedKey));
    refreshVisualState();
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

    const shadowRange = Math.max(size.x, size.z) * 1.25;
    sun.shadow.camera.left = -shadowRange;
    sun.shadow.camera.right = shadowRange;
    sun.shadow.camera.top = shadowRange;
    sun.shadow.camera.bottom = -shadowRange;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = Math.max(100, size.y * 8);

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
      if (key && /^TOP\d+$/.test(key)) return key;
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

      console.log("hoveredKey:", hoveredKey, "unit:", unit);
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

  renderer.domElement.addEventListener("pointerup", (e) => {
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
    if (!key) return;

    selectUnit(key);
  });

  async function init() {
    renderTable(null);
    showDetails(null);

    await fetchSheetData();
    renderTable(null);

    await loadModel(BUILDING_URL);

    if (loaderInfo) loaderInfo.textContent = "Loading… 100%";
    setTimeout(() => {
      if (loaderEl) loaderEl.style.display = "none";
      if (loaderInfo) loaderInfo.textContent = "";
    }, 120);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  return { init };
}
