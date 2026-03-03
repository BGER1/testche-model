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
  // Floors you have now
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

  // Static base colors per floor (what you asked for)
  const FLOOR_BASE_COLORS = {
    EG: 0xe74c3c,
    "1OG": 0x3498db,
    "2OG": 0x2ecc71,
    "3OG": 0xf1c40f,
    "4OG": 0x9b59b6,
  };

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
      panelNote.textContent = highlightKey ? `Hover: ${highlightKey}` : "Hover über Etagen";
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

  // ---------------- MODEL ----------------
  const gltfLoader = new GLTFLoader();

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);

  let root = null;
  let pickMeshes = [];

  // Map "EG"/"1OG"/... -> Object3D (Group/Node)
  const floorGroups = new Map();

  // Store base materials for floors so we can restore after hover highlight
  // key -> Map(mesh -> originalMaterial)
  const floorBaseMaterials = new Map();

  // --------- Floor name detection ----------
  function floorKeyFromName(nameRaw) {
    const n = (nameRaw || "").toUpperCase().replace(/\s+/g, "");

    // Most reliable: exact matches
    if (n === "EG" || n === "ERDGESCHOSS") return "EG";
    if (n === "1OG" || n === "1.OG" || n === "OG1") return "1OG";
    if (n === "2OG" || n === "2.OG" || n === "OG2") return "2OG";
    if (n === "3OG" || n === "3.OG" || n === "OG3") return "3OG";
    if (n === "4OG" || n === "4.OG" || n === "OG4") return "4OG";

    // Fallback: contains
    if (n.includes("ERDGESCHOSS") || n.includes("GROUND") || n.includes("FLOOR0") || n.includes("LEVEL0")) return "EG";
    if (n.includes("1OG") || n.includes("FLOOR1") || n.includes("LEVEL1") || n.includes("ETAGE1")) return "1OG";
    if (n.includes("2OG") || n.includes("FLOOR2") || n.includes("LEVEL2") || n.includes("ETAGE2")) return "2OG";
    if (n.includes("3OG") || n.includes("FLOOR3") || n.includes("LEVEL3") || n.includes("ETAGE3")) return "3OG";
    if (n.includes("4OG") || n.includes("FLOOR4") || n.includes("LEVEL4") || n.includes("ETAGE4")) return "4OG";

    return null;
  }

  // ---------- Material helpers ----------
  function cloneAndSetBaseColor(material, hex) {
    if (!material) return material;

    const m = material.clone();
    // Use color if present (MeshStandardMaterial etc.)
    if (m.color) m.color.setHex(hex);

    // Keep textures if they exist; we only tint via base color.
    // If you want FULL solid color (ignore textures), tell me and I’ll switch it.
    m.needsUpdate = true;
    return m;
  }

  function applyColorToMesh(mesh, hex) {
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mesh.material = mat.map((m) => cloneAndSetBaseColor(m, hex));
    } else {
      mesh.material = cloneAndSetBaseColor(mat, hex);
    }
  }

  function cacheMaterialsForGroup(key, group) {
    const map = new Map();
    group.traverse((o) => {
      if (!o.isMesh) return;
      map.set(o, o.material);
    });
    floorBaseMaterials.set(key, map);
  }

  function restoreBaseForKey(key) {
    const map = floorBaseMaterials.get(key);
    if (!map) return;
    for (const [mesh, mat] of map.entries()) {
      // mesh might be disposed/removed; guard
      if (mesh && mesh.isMesh) mesh.material = mat;
    }
  }

  function colorizeFloorsOnce() {
    // Build floor groups
    floorGroups.clear();
    root.traverse((obj) => {
      const key = floorKeyFromName(obj.name);
      if (key && !floorGroups.has(key)) floorGroups.set(key, obj);
    });

    console.log("Floor groups found:", [...floorGroups.keys()]);

    // Apply base colors + cache originals
    for (const [key, group] of floorGroups.entries()) {
      cacheMaterialsForGroup(key, group);

      const hex = FLOOR_BASE_COLORS[key] ?? 0xcccccc;
      group.traverse((o) => {
        if (!o.isMesh) return;
        applyColorToMesh(o, hex);
      });

      // After base color is applied, update cache to be "base" state (so hover can restore)
      cacheMaterialsForGroup(key, group);
    }
  }

  function loadModel(url) {
    if (loaderEl) loaderEl.style.display = "block";
    if (loaderInfo) loaderInfo.textContent = "Loading…";

    gltfLoader.load(
      url,
      (gltf) => {
        root = gltf.scene;
        window.root = root; // ✅ debug access like we discussed
        scene.add(root);

        // Meshes fürs Raycasting
        pickMeshes = [];
        root.traverse((obj) => {
          if (obj.isMesh) pickMeshes.push(obj);
        });
        console.log("Meshes:", pickMeshes.length);

        // ✅ Apply different colors for EG/1OG/2OG/3OG/4OG
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

  // ---------------- HOVER / HIGHLIGHT ----------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let hoveredKey = null;
  let hoveredRoot = null;

  // Temporary highlight store (only for the currently hovered group)
  const hoverOriginalMaterials = new Map(); // Mesh -> material (base state)

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

    // restore the materials we changed during hover
    hoveredRoot.traverse((child) => {
      if (!child.isMesh) return;
      if (hoverOriginalMaterials.has(child)) {
        child.material = hoverOriginalMaterials.get(child);
        hoverOriginalMaterials.delete(child);
      }
    });

    // also ensure the floor returns to its base palette
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

        // Emissive highlight (keeps base floor color visible underneath)
        if (mat.emissive) {
          mat.emissive.set(color);
          mat.emissiveIntensity = 1.5;
        } else if (mat.color) {
          mat.color.set(color);
        }

        mat.needsUpdate = true;
        return mat;
      };

      if (Array.isArray(child.material)) {
        child.material = child.material.map(applyToMaterial);
      } else {
        child.material = applyToMaterial(child.material);
      }
    });
  }

  function onPointerMove(event) {
    if (!root) return;

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

    if (panelNote) {
      panelNote.textContent = `Hover: ${key}`;
    }
  }

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", () => {
    resetHighlight();
    renderTable(null);
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
