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

  const emptyState = document.getElementById("emptyState");
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

  // Diese Daten kannst du später einfach austauschen
  // Wichtig: "key" muss zum Floor-Namen im Modell passen (EG, 1OG, 2OG, ...)
  const units = [
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
      description: "Helle Erdgeschosswohnung mit offenem Wohnbereich, großzügiger Terrasse und ruhiger Ausrichtung zum Innenhof."
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
      description: "Kompakte Familienwohnung mit guter Raumaufteilung, Balkon und viel Tageslicht."
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
      description: "Moderne Wohnung mit offener Küche, freundlicher Belichtung und hochwertiger Grundstruktur."
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
      description: "Großzügige Einheit mit repräsentativem Wohnraum, guter Aussicht und angenehmer Abendsonne."
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
      description: "Penthouse mit großzügiger Terrasse und freiem Blick. Diese Einheit ist bereits verkauft."
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
  wrapper.style.position = "relative";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wrapper.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.8;
  controls.minDistance = 4;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // nicht unter das Modell schauen
  controls.minPolarAngle = 0.15;
  controls.screenSpacePanning = false;

  // ---------------- LIGHTING ----------------
  // weich, hell, leicht "sunlight"-mäßig
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xe9edf5, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.position.set(18, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-10, 12, -8);
  scene.add(fill);

  // Schattenfänger-Boden
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.14 });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------------- RESIZE ----------------
  function resize() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  // ---------------- MODEL ----------------
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);

  let root = null;
  let pickMeshes = [];
  const floorGroups = new Map();

  // Hover/selection
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
        const mixed = mat.color.clone().lerp(tintColor, strength * 0.35);
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
    if (original) {
      mesh.material = original;
    }
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
    // alles zurück
    for (const key of floorGroups.keys()) {
      restoreGroup(key);
    }

    // Auswahl bleibt leicht bestehen
    if (selectedKey) {
      const unit = getUnitByKey(selectedKey);
      const color = STATUS_COLOR[unit?.status] || new THREE.Color(0x9ecbff);
      tintGroup(selectedKey, color, 0.14);
    }

    // Hover liegt über Auswahl
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
      emptyState?.classList.remove("is-hidden");
      detailsCard?.classList.add("is-hidden");
      return;
    }

    emptyState?.classList.add("is-hidden");
    detailsCard?.classList.remove("is-hidden");

    detailsTitle.textContent = unit.name;
    detailsSubtitle.textContent = `Etage: ${unit.floor}`;
    detailsBadge.className = `badge ${unit.status}`;
    detailsBadge.textContent = STATUS_LABEL[unit.status] || unit.status;

    detailsSize.textContent = unit.size;
    detailsPrice.textContent = unit.price;
    detailsRooms.textContent = unit.rooms;
    detailsAvailability.textContent = unit.availability;
    detailsOrientation.textContent = unit.orientation;
    detailsOutdoor.textContent = unit.outdoor;
    detailsDescription.textContent = unit.description;

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
      center.y + dist * 0.55,
      center.z + dist * 0.95
    );

    controls.target.copy(center);
    controls.update();

    controls.minDistance = Math.max(4, maxDim * 0.35);
    controls.maxDistance = Math.max(20, maxDim * 4.5);

    // Schattenkamera an Modell anpassen
    const shadowRange = Math.max(size.x, size.z) * 1.2;
    sun.shadow.camera.left = -shadowRange;
    sun.shadow.camera.right = shadowRange;
    sun.shadow.camera.top = shadowRange;
    sun.shadow.camera.bottom = -shadowRange;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = Math.max(100, size.y * 8);

    // Ground knapp unter Modell setzen
    ground.position.y = box.min.y - 0.02;
  }

  function loadModel(url = BUILDING_URL) {
    if (loaderEl) loaderEl.style.display = "block";
    if (loaderInfo) loaderInfo.textContent = "Loading…";

    gltfLoader.load(
      url,
      (gltf) => {
        root = gltf.scene;
        window.root = root;

        root.traverse((o) => {
          if (o.isMesh) {
            pickMeshes.push(o);
            o.castShadow = true;
            o.receiveShadow = true;

            if (o.material) {
              if (Array.isArray(o.material)) {
                o.material.forEach((m) => {
                  if (!m) return;
                  m.needsUpdate = true;
                });
              } else {
                o.material.needsUpdate = true;
              }
            }
          }
        });

        scene.add(root);
        collectFloorGroups();
        fitCamera(root);

        if (loaderEl) loaderEl.style.display = "none";
        if (loaderInfo) loaderInfo.textContent = "";

        renderTable(null);
        showDetails(null);
      },
      (ev) => {
        if (loaderInfo && ev.total) {
          const p = Math.round((ev.loaded / ev.total) * 100);
          loaderInfo.textContent = `Loading… ${p}%`;
        }
      },
      (err) => {
        console.error(err);
        if (loaderEl) loaderEl.style.display = "none";
        if (loaderInfo) loaderInfo.textContent = "Fehler beim Laden.";
      }
    );
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
        panelNote.textContent = "Hover über eine Etage, um den Status farblich anzuzeigen.";
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
      panelNote.textContent = "Hover über eine Etage, um den Status farblich anzuzeigen.";
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

    // Drag = kein Click
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

  // ---------------- ANIMATION ----------------
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Initial UI
  renderTable(null);
  showDetails(null);

  return { loadModel };
}
