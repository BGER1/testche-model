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
  const detailsAvailability = document.getElementById("detailsAvailability");
  const detailsOrientation = document.getElementById("detailsOrientation");
  const detailsOutdoor = document.getElementById("detailsOutdoor");
  const detailsDescription = document.getElementById("detailsDescription");

  if (!wrapper) throw new Error("Missing #viewerCanvasWrapper");

  // ---------------- CONFIG ----------------
  const BASE = "/testche-model";
  const BUILDING_URL = `${BASE}/models/Testche.glb`;

  // Google Sheets:
  // 1) Sheet muss öffentlich / publishbar sein
  // 2) Hier DEINE Werte einsetzen
const SHEET_ID = "1wp3hwv9EFidEjsW-FdtniqcdWx_H-VQe_LcrQhelf3k";
const SHEET_GID = "0";

  // Erwartete Spaltennamen in Google Sheets:
  // key | name | floor | size | price | status | rooms | availability | orientation | outdoor | description
  const SHEET_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${SHEET_GID}&tqx=out:json`;

  let units = [
    {
      key: "EG",
      name: "Wohnung EG-01",
      floor: "EG",
      size: "68 m²",
      price: "€ 289.000",
      status: "free",
      rooms: "2 Zimmer",
      availability: "Sofort verfügbar",
      orientation: "Süd-West",
      outdoor: "Terrasse 14 m²",
      description: "Helle Erdgeschosswohnung mit offenem Wohnbereich."
    },
    {
      key: "1OG",
      name: "Wohnung 1.OG-01",
      floor: "1. OG",
      size: "74 m²",
      price: "€ 315.000",
      status: "reserved",
      rooms: "3 Zimmer",
      availability: "Reserviert",
      orientation: "Süd",
      outdoor: "Balkon 8 m²",
      description: "Kompakte Familienwohnung mit Balkon."
    },
    {
      key: "2OG",
      name: "Wohnung 2.OG-01",
      floor: "2. OG",
      size: "81 m²",
      price: "€ 349.000",
      status: "free",
      rooms: "3 Zimmer",
      availability: "Ab sofort",
      orientation: "Süd-Ost",
      outdoor: "Loggia 7 m²",
      description: "Moderne Wohnung mit offener Küche."
    },
    {
      key: "3OG",
      name: "Wohnung 3.OG-01",
      floor: "3. OG",
      size: "90 m²",
      price: "€ 389.000",
      status: "free",
      rooms: "4 Zimmer",
      availability: "Ab Mai 2026",
      orientation: "West",
      outdoor: "Balkon 11 m²",
      description: "Großzügige Einheit mit guter Aussicht."
    },
    {
      key: "4OG",
      name: "Penthouse 4.OG-01",
      floor: "4. OG",
      size: "112 m²",
      price: "Verkauft",
      status: "sold",
      rooms: "4 Zimmer",
      availability: "Nicht verfügbar",
      orientation: "Süd-West",
      outdoor: "Dachterrasse 28 m²",
      description: "Penthouse mit großzügiger Terrasse."
    }
  ];

  const STATUS_COLOR = {
    free: new THREE.Color(0x72d98b),
    reserved: new THREE.Color(0xf4cf58),
    sold: new THREE.Color(0xf08b8b)
  };

  const STATUS_LABEL = {
    free: "Frei",
    reserved: "Reserviert",
    sold: "Verkauft"
  };

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
  controls.minPolarAngle = 0.12;
  controls.screenSpacePanning = false;

  // ---------------- LIGHTING ----------------
  // Neutrales Sonnenlicht statt warm/beige
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

  // Unsichtbarer Schattenfänger
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

  // ---------------- DATA ----------------
async function fetchSheetData() {
  if (!SHEET_ID) {
    console.warn("Google Sheet ID not set. Using fallback data.");
    return units;
  }

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

    const cols = (data.table?.cols || []).map(c => c.label || c.id || "");
    const rows = data.table?.rows || [];

    const parsed = rows.map((row) => {
      const obj = {};

      cols.forEach((colName, i) => {
        const cell = row.c?.[i];
        obj[colName] = cell ? (cell.f ?? cell.v ?? "") : "";
      });

      return {
        key: String(obj.key || "").trim(),
        name: String(obj.name || "").trim(),
        floor: String(obj.floor || "").trim(),
        size: String(obj.size || "").trim(),
        price: String(obj.price || "").trim(),
        status: String(obj.status || "").trim().toLowerCase(),
        rooms: String(obj.rooms || "").trim(),
        availability: String(obj.availability || "").trim(),
        orientation: String(obj.orientation || "").trim(),
        outdoor: String(obj.outdoor || "").trim(),
        description: String(obj.description || "").trim()
      };
    }).filter(u => u.key);

    if (parsed.length) {
      units = parsed;
      console.log("Loaded units from Google Sheets:", units);
    } else {
      console.warn("Google Sheets loaded, but no valid rows were found. Using fallback data.");
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
  const floorGroups = new Map();

  let hoveredKey = null;
  let selectedKey = null;
  const originalMaterials = new WeakMap();

  function statusBadge(status) {
    return `<span class="badge ${status}">${STATUS_LABEL[status] || status}</span>`;
  }

  function getUnitByKey(key) {
    return units.find(u => u.key === key) || null;
  }

  function floorKeyFromName(nameRaw) {
    const n = (nameRaw || "").toUpperCase().replace(/\s+/g, "");

    if (n === "EG" || n.includes("ERDGESCHOSS")) return "EG";
    if (n === "1OG" || n.includes("1.OG") || n.includes("OG1") || n.includes("LEVEL1") || n.includes("FLOOR1")) return "1OG";
    if (n === "2OG" || n.includes("2.OG") || n.includes("OG2") || n.includes("LEVEL2") || n.includes("FLOOR2")) return "2OG";
    if (n === "3OG" || n.includes("3.OG") || n.includes("OG3") || n.includes("LEVEL3") || n.includes("FLOOR3")) return "3OG";
    if (n === "4OG" || n.includes("4.OG") || n.includes("OG4") || n.includes("LEVEL4") || n.includes("FLOOR4")) return "4OG";

    return null;
  }

  function collectFloorGroups() {
    floorGroups.clear();

    root.traverse((obj) => {
      const key = floorKeyFromName(obj.name);
      if (key && !floorGroups.has(key)) {
        floorGroups.set(key, obj);
      }
    });

    console.log("Floor groups found:", [...floorGroups.keys()]);
  }

  function normalizeMaterialForNeutralLook(material) {
    if (!material) return;

    // Kein künstlicher Beige-Stich
    if ("color" in material && material.color) {
      const hsl = {};
      material.color.getHSL(hsl);

      // sehr helle, schwach gesättigte Farben näher an weiß ziehen
      if (hsl.l > 0.6 && hsl.s < 0.2) {
        material.color.lerp(new THREE.Color(0xffffff), 0.25);
      }
    }

    // Für SketchUp-Exporte oft natürlicher
    if ("metalness" in material) material.metalness = 0.0;
    if ("roughness" in material) material.roughness = Math.min(1, Math.max(0.72, material.roughness ?? 0.85));

    material.needsUpdate = true;
  }

  function cacheOriginalMaterial(mesh) {
    if (!originalMaterials.has(mesh)) {
      originalMaterials.set(mesh, mesh.material);
    }
  }

  function setMeshTint(mesh, tintColor, strength = 0.18) {
    cacheOriginalMaterial(mesh);

    const applyToMaterial = (material) => {
      const mat = material.clone();

      if ("emissive" in mat && mat.emissive) {
        mat.emissive = mat.emissive.clone();
        mat.emissive.copy(tintColor);
        mat.emissiveIntensity = strength;
      } else if ("color" in mat && mat.color) {
        const mixed = mat.color.clone().lerp(tintColor, strength * 0.30);
        mat.color.copy(mixed);
      }

      mat.needsUpdate = true;
      return mat;
    };

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(applyToMaterial);
    } else {
      mesh.material = applyToMaterial(mesh.material);
    }
  }

  function restoreMeshMaterial(mesh) {
    const original = originalMaterials.get(mesh);
    if (original) mesh.material = original;
  }

  function tintGroup(key, tintColor, strength = 0.18) {
    const group = floorGroups.get(key);
    if (!group) return;

    group.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      setMeshTint(child, tintColor, strength);
    });
  }

  function restoreGroup(key) {
    const group = floorGroups.get(key);
    if (!group) return;

    group.traverse((child) => {
      if (!child.isMesh) return;
      restoreMeshMaterial(child);
    });
  }

  function refreshVisualState() {
    for (const key of floorGroups.keys()) {
      restoreGroup(key);
    }

    if (selectedKey) {
      const unit = getUnitByKey(selectedKey);
      const color = STATUS_COLOR[unit?.status] || new THREE.Color(0x9ecbff);
      tintGroup(selectedKey, color, 0.14);
    }

    if (hoveredKey) {
      const unit = getUnitByKey(hoveredKey);
      const color = STATUS_COLOR[unit?.status] || new THREE.Color(0x9ecbff);
      tintGroup(hoveredKey, color, 0.24);
    }
  }

  function renderTable(activeKey = null) {
    if (!infoRows) return;

    infoRows.innerHTML = units.map((u) => {
      const isActive = activeKey === u.key;
      return `
        <tr class="${isActive ? "is-active" : ""}" data-key="${u.key}">
          <td>${u.name}</td>
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

    detailsTitle.textContent = unit.name;
    detailsSubtitle.textContent = `Etage: ${unit.floor}`;
    detailsBadge.className = `badge ${unit.status}`;
    detailsBadge.textContent = STATUS_LABEL[unit.status] || unit.status;

    detailsSize.textContent = unit.size || "—";
    detailsPrice.textContent = unit.price || "—";
    detailsRooms.textContent = unit.rooms || "—";
    detailsAvailability.textContent = unit.availability || "—";
    detailsOrientation.textContent = unit.orientation || "—";
    detailsOutdoor.textContent = unit.outdoor || "—";
    detailsDescription.textContent = unit.description || "—";

    if (panelNote) {
      panelNote.textContent = `${unit.name} ausgewählt.`;
    }
  }

  function selectUnit(key) {
    selectedKey = key;
    renderTable(key);
    showDetails(getUnitByKey(key));
    refreshVisualState();
  }

  function fitCamera(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const dist = maxDim / (2 * Math.tan(fov / 2)) * 1.35;

    camera.position.set(
      center.x + dist * 0.95,
      center.y + dist * 0.52,
      center.z + dist * 0.95
    );

    controls.target.copy(center);
    controls.update();

    controls.minDistance = Math.max(4, maxDim * 0.35);
    controls.maxDistance = Math.max(20, maxDim * 4.5);

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
          collectFloorGroups();
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

  // ---------------- POINTER / RAYCAST ----------------
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
      const key = floorKeyFromName(cur.name);
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
        panelNote.textContent = `${getUnitByKey(selectedKey)?.name || ""} ausgewählt.`;
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

    if (hoveredKey !== key) {
      hoveredKey = key;
      refreshVisualState();

      const unit = getUnitByKey(key);
      if (panelNote) {
        panelNote.textContent = unit
          ? `${unit.name} · ${STATUS_LABEL[unit.status]}`
          : `Hover: ${key}`;
      }
    }
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", () => {
    hoveredKey = null;
    refreshVisualState();

    if (panelNote && selectedKey) {
      panelNote.textContent = `${getUnitByKey(selectedKey)?.name || ""} ausgewählt.`;
    } else if (panelNote) {
      panelNote.textContent = "Hover zeigt den Wohnungsstatus farblich.";
    }
  });

  // ---------------- REAL CLICK DETECTION ----------------
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

  // ---------------- INIT ----------------
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
