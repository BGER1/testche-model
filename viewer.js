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
  // Du hast nur EG + DG:
  const floors = [
    { key: "EG", name: "Etage EG", floor: "EG", size: "—", price: "—", status: "free" },
    { key: "DG", name: "Etage DG", floor: "DG", size: "—", price: "—", status: "sold" },
  ];

  const STATUS_COLOR = {
    free: new THREE.Color(0x00ff88),
    reserved: new THREE.Color(0xffcc00),
    sold: new THREE.Color(0xff4444),
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
      panelNote.textContent = highlightKey
        ? `Hover: ${highlightKey}`
        : "Hover über EG / DG";
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

  // Map "EG"/"DG" -> Object3D (Group/Node)
  const floorGroups = new Map();

  // ✅ WICHTIG: robuste Floor-Erkennung (weil dein EG im GLB offenbar nicht "EG" heißt)
  function floorKeyFromName(nameRaw) {
    const n = (nameRaw || "").toUpperCase();

    // DG (du hattest DG schon gefunden)
    if (n.includes("DG") || n.includes("DACHGESCHOSS")) return "DG";

    // EG Varianten: passt für viele SketchUp/Exporter Benennungen
    if (
      n.includes("EG") ||
      n.includes("ERDGESCHOSS") ||
      n.includes("GROUND") ||
      n.includes("FLOOR0") ||
      n.includes("FLOOR_0") ||
      n.includes("LEVEL0") ||
      n.includes("LEVEL_0") ||
      n.includes("ETAGE0") ||
      n.includes("ETAGE_0") ||
      n.includes("STOCK0") ||
      n.includes("STOCK_0")
    ) return "EG";

    return null;
  }

  function loadModel(url) {
    if (loaderEl) loaderEl.style.display = "block";
    if (loaderInfo) loaderInfo.textContent = "Loading…";

    gltfLoader.load(
      url,
      (gltf) => {
        root = gltf.scene;
        window.root = root; // optional debug
        scene.add(root);

        // Meshes fürs Raycasting
        pickMeshes = [];
        root.traverse(obj => { if (obj.isMesh) pickMeshes.push(obj); });
        console.log("Meshes:", pickMeshes.length);

        // Floors finden (Nodes/Groups)
        floorGroups.clear();
        root.traverse(obj => {
          const key = floorKeyFromName(obj.name);
          if (key && !floorGroups.has(key)) floorGroups.set(key, obj);
        });
        console.log("Floor groups found:", [...floorGroups.keys()]);

        // Optional: wenn du am Anfang nur EG+DG zeigen willst:
        // (wenn dein Modell noch andere Teile hätte, würden sie versteckt)
        // -> bei dir egal, aber schadet nicht.
        root.traverse(obj => {
          if (!obj.isMesh) return;
          // sichtbar lassen (du hast eh nur EG+DG), hier könnten wir sonst filtern
          obj.visible = true;
        });

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
  const originalMaterials = new Map(); // Mesh -> original material

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
      if (originalMaterials.has(child)) {
        child.material = originalMaterials.get(child);
        originalMaterials.delete(child);
      }
    });

    hoveredRoot = null;
    hoveredKey = null;
  }

  function applyHighlight(group, color) {
    group.traverse(child => {
      if (!child.isMesh || !child.material) return;

      if (!originalMaterials.has(child)) originalMaterials.set(child, child.material);

      const applyToMaterial = (m) => {
        const mat = m.clone();

        // ✅ emissive richtig setzen (dein Hauptproblem vorher)
        if (mat.emissive) {
          mat.emissive.set(color);
          mat.emissiveIntensity = 1.5; // absichtlich deutlich sichtbar
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

    // Debug-Hilfe: zeigt dir live, ob überhaupt was getroffen wird
    if (panelNote) {
      panelNote.textContent = hits.length
        ? `Hit: ${hits[0].object.name || "(no name)"}`
        : "Hit: (none)";
    }

    if (!hits.length) {
      resetHighlight();
      renderTable(null);
      return;
    }

    const hitObj = hits[0].object;

    // Floor Key herausfinden
    const key = findKeyByWalkingParents(hitObj);
    if (!key) {
      // wenn wir keine Floor-Zuordnung finden, highlighten wir nichts
      resetHighlight();
      renderTable(null);
      return;
    }

    if (hoveredKey === key) return;

    resetHighlight();
    hoveredKey = key;

    // was highlighten?
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

  // ---------------- LOOP ----------------
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { loadModel };
}
