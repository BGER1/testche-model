import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

export function Viewer() {
  const wrapper = document.getElementById("viewerCanvasWrapper");
  const loaderEl = document.getElementById("loader");
  const loaderInfo = document.getElementById("loaderInfo");
  const infoRows = document.getElementById("infoRows");
  const panelNote = document.getElementById("panelNote");

  if (!wrapper) throw new Error("Missing #viewerCanvasWrapper");

  // ---- DATA (deine Etagen)
  // status: "free" | "reserved" | "sold"
  const floors = [
    { key: "EG", name: "Etage EG", floor: "EG", size: "—", price: "—", status: "free" },
    { key: "1.OG", name: "Etage 1.OG", floor: "1.OG", size: "—", price: "—", status: "reserved" },
    { key: "DG", name: "Etage DG", floor: "DG", size: "—", price: "—", status: "sold" },
  ];

  // Farben (leicht „Neon“ aber nicht zu stark)
  const STATUS_COLOR = {
    free: new THREE.Color(0x00ff88),
    reserved: new THREE.Color(0xffcc00),
    sold: new THREE.Color(0xff4444),
  };

  function showLoader(text) {
    if (!loaderEl || !loaderInfo) return;
    loaderEl.style.display = "block";
    loaderInfo.textContent = text || "Loading…";
  }
  function hideLoader() {
    if (!loaderEl) return;
    loaderEl.style.display = "none";
  }

  // ---- Right panel rendering
  function badge(status) {
    if (status === "free") return `<span class="badge free">frei</span>`;
    if (status === "reserved") return `<span class="badge reserved">reserviert</span>`;
    return `<span class="badge sold">verkauft</span>`;
  }

  function renderTable(highlightKey = null) {
    if (!infoRows) return;

    infoRows.innerHTML = floors.map(f => {
      const isActive = highlightKey && f.key === highlightKey;
      const style = isActive ? `style="background: rgba(0,0,0,0.03);"` : "";
      return `
        <tr ${style}>
          <td><strong>${f.name}</strong></td>
          <td>${f.floor}</td>
          <td>${f.size}</td>
          <td>${f.price}</td>
          <td>${badge(f.status)}</td>
        </tr>
      `;
    }).join("");

    if (panelNote) {
      panelNote.textContent = highlightKey
        ? `Ausgewählt (Hover): ${highlightKey}`
        : `Hover über EG / 1.OG / DG, um Details zu sehen.`;
    }
  }

  renderTable(null);

  // ---- THREE BASICS
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eeeeee");

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1e7);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  wrapper.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;

  // Licht gut für Architektur
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  function resize() {
    const w = wrapper.clientWidth || 1;
    const h = wrapper.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- MODEL LOAD
  const gltfLoader = new GLTFLoader();
  let root = null;

  function fitCamera(object, offset = 1.3) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    camera.near = Math.max(maxDim / 1000, 0.01);
    camera.far = maxDim * 1000;
    camera.updateProjectionMatrix();

    const fov = (camera.fov * Math.PI) / 180;
    let dist = (maxDim / 2) / Math.tan(fov / 2);
    dist *= offset;

    camera.position.copy(center).add(new THREE.Vector3(dist, dist * 0.35, dist));
    controls.target.copy(center);
    controls.update();
  }

  // ---- Hover Highlight System
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // original material speichern (pro Mesh)
  const originalMaterial = new WeakMap();
  let hoveredKey = null;
  let hoveredGroup = null;

  function findFloorKeyFromObject(obj) {
    // Klettere nach oben, bis wir EG / 1.OG / DG finden
    let cur = obj;
    while (cur) {
      if (cur.name === "EG" || cur.name === "1.OG" || cur.name === "DG") return cur.name;
      if (cur === root) break;
      cur = cur.parent;
    }
    return null;
  }

  function applyHighlight(group, status) {
    const tint = STATUS_COLOR[status] || STATUS_COLOR.free;

    group.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      if (!originalMaterial.has(child)) {
        originalMaterial.set(child, child.material);
      }

      const baseMat = originalMaterial.get(child);

      // Clone, damit wir nichts dauerhaft zerstören
      const mat = baseMat.clone();

      // Wenn emissive existiert (Standard/Phong/Lambert), nutze emissive als „Glow“
      if ("emissive" in mat) {
        mat.emissive = tint.clone();
        mat.emissiveIntensity = 0.35;
      } else if ("color" in mat) {
        // Fallback: Farbe leicht in Richtung tint ziehen
        mat.color = mat.color.clone().lerp(tint, 0.25);
      }

      mat.needsUpdate = true;
      child.material = mat;
    });
  }

  function clearHighlight(group) {
    if (!group) return;
    group.traverse((child) => {
      if (!child.isMesh) return;
      const orig = originalMaterial.get(child);
      if (orig) child.material = orig;
    });
  }

  function onMouseMove(evt) {
    if (!root) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(root.children, true);

    if (!hits.length) {
      if (hoveredGroup) clearHighlight(hoveredGroup);
      hoveredGroup = null;
      hoveredKey = null;
      renderTable(null);
      return;
    }

    const hitObj = hits[0].object;
    const key = findFloorKeyFromObject(hitObj);

    if (!key) {
      if (hoveredGroup) clearHighlight(hoveredGroup);
      hoveredGroup = null;
      hoveredKey = null;
      renderTable(null);
      return;
    }

    if (key === hoveredKey) return; // nix ändern

    // neues Hover -> altes resetten
    if (hoveredGroup) clearHighlight(hoveredGroup);

    hoveredKey = key;

    // finde Group-Object mit dem Namen key
    hoveredGroup = root.getObjectByName(key);

    const data = floors.find(f => f.key === key);
    if (hoveredGroup && data) {
      applyHighlight(hoveredGroup, data.status);
      renderTable(key);
    } else {
      renderTable(null);
    }
  }

  renderer.domElement.addEventListener("mousemove", onMouseMove);

  function loadModel(url) {
    showLoader("Loading model…");

    gltfLoader.load(
      url,
      (gltf) => {
        root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!root) {
          showLoader("No scene in GLB (check console).");
          return;
        }

        // Materials robust + double-sided (SketchUp/D5 friendly)
        root.traverse((n) => {
          if (n.isMesh && n.material) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((m) => {
              m.side = THREE.DoubleSide;
              m.needsUpdate = true;
            });
          }
        });

        // Center at origin
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);

        scene.add(root);
        fitCamera(root, 1.3);

        hideLoader();
      },
      (xhr) => {
        if (xhr.total) {
          const p = Math.round((xhr.loaded / xhr.total) * 100);
          showLoader(`${p}% loaded`);
        }
      },
      (err) => {
        console.error(err);
        showLoader("Error loading model (see console).");
      }
    );
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  hideLoader();

  return { loadModel };
}
