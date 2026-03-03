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
  // ✅ Keys müssen zu deinen Objekt-Namen im GLB passen (oder Teilstrings davon)
  const FLOOR_KEYS = ["EG", "1OG", "DG"]; // <- wenn dein Modell "AG" hat: ["EG","AG","DG"]

  const floors = [
    { key: "EG",  name: "Etage EG",  floor: "EG",  size: "—", price: "—", status: "free" },
    { key: "1OG", name: "Etage 1.OG", floor: "1.OG", size: "—", price: "—", status: "reserved" },
    { key: "DG",  name: "Etage DG",  floor: "DG",  size: "—", price: "—", status: "sold" },
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
        : `Hover über ${FLOOR_KEYS.join(" / ")}`;
    }
  }

  renderTable();

  // ---------------- THREE SETUP ----------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eeeeee");

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  wrapper.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Licht (emissive sieht man auch ohne, aber so ist’s stabil)
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

  // ---------------- MODEL LOADING ----------------
  const gltfLoader = new GLTFLoader();

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/");
  gltfLoader.setDRACOLoader(dracoLoader);

  let root = null;
  let pickMeshes = [];

  // Floor group lookup: key -> Object3D
  const floorGroups = new Map(); // "EG" -> obj

  function loadModel(url) {
    if (loaderEl) loaderEl.style.display = "block";
    if (loaderInfo) loaderInfo.textContent = "Lade 3D-Modell…";

    gltfLoader.load(
      url,
      (gltf) => {
        root = gltf.scene;
        window.root = root; // optional fürs Debugging
        scene.add(root);

        // Meshes sammeln fürs Raycasting
        pickMeshes = [];
        root.traverse(obj => {
          if (obj.isMesh) pickMeshes.push(obj);
        });

        // Floors finden (robust: über Namen enthält Key, nicht nur exakt ===)
        // Du kannst das Console-Log kurz aktiv lassen um echte Namen zu sehen.
        root.traverse(obj => {
          const n = (obj.name || "").toUpperCase();
          if (!n) return;

          for (const key of FLOOR_KEYS) {
            if (n === key || n.includes(key)) {
              // wir nehmen das "höchste" Objekt für diesen Key (Group/Empty ideal)
              if (!floorGroups.has(key)) floorGroups.set(key, obj);
            }
          }
        });

        console.log("Meshes:", pickMeshes.length);
        console.log("Floor groups found:", [...floorGroups.keys()]);

        fitCamera(root);

        if (loaderEl) loaderEl.style.display = "none";
        if (loaderInfo) loaderInfo.textContent = "";
      },
      (ev) => {
        if (loaderInfo && ev.total) {
          const p = Math.round((ev.loaded / ev.total) * 100);
          loaderInfo.textContent = `Laden… ${p}%`;
        }
      },
      (err) => {
        console.error(err);
        if (loaderInfo) loaderInfo.textContent = "Fehler beim Laden des Modells.";
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
  let hoveredRoot = null; // das Objekt (Group) das wir highlighten
  const originalMaterials = new Map(); // Mesh -> originalMaterial

  function setPointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findFloorKeyForObject(obj) {
    // wir laufen hoch bis root und schauen, ob irgendein Parent "EG/DG/..." im Namen trägt
    let cur = obj;
    while (cur && cur !== root) {
      const name = (cur.name || "").toUpperCase();
      for (const key of FLOOR_KEYS) {
        if (name === key || name.includes(key)) return key;
      }
      cur = cur.parent;
    }
    return null;
  }

  function highlightGroup(group, color, intensity) {
    group.traverse(child => {
      if (!child.isMesh) return;

      // Originalmaterial einmal speichern
      if (!originalMaterials.has(child)) {
        originalMaterials.set(child, child.material);
      }

      // Clone (bei Arrays auch)
      const applyToMaterial = (m) => {
        const mat = m.clone();

        // ✅ Emissive richtig setzen (nicht mat.emissive = Color)
        if ("emissive" in mat && mat.emissive) {
          mat.emissive.set(color);
          mat.emissiveIntensity = intensity;
        } else if ("color" in mat && mat.color) {
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

  function onPointerMove(e) {
    if (!root) return;

    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(pickMeshes, true);

      console.log("hits:", hits.length);
  if (hits.length) {
    console.log("hit name:", hits[0].object.name);
  }

    if (!hits.length) {
      resetHighlight();
      renderTable(null);
      return;
    }

    const hitObj = hits[0].object;

    // Key bestimmen (z.B. EG / 1OG / DG)
    const key = findFloorKeyForObject(hitObj);
    if (!key) {
      resetHighlight();
      renderTable(null);
      return;
    }

    if (hoveredKey === key) return;

    resetHighlight();

    hoveredKey = key;

    // Was highlighten? Wenn wir eine Group fürs Key gefunden haben → die
    // sonst: den Parent, der den Key enthält
    hoveredRoot = floorGroups.get(key) || hitObj;

    // Daten holen
    const data = floors.find(f => f.key === key);
    const col = data ? STATUS_COLOR[data.status] : new THREE.Color(0x00aaff);

    highlightGroup(hoveredRoot, col, 0.8);
    renderTable(key);
  }

  // ✅ pointermove ist besser als mousemove (Touch + Pen)
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
