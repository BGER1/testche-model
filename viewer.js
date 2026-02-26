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

  // ---------------- DATA ----------------

  const floors = [
    { key: "EG", name: "Etage EG", floor: "EG", size: "—", price: "—", status: "free" },
    { key: "1.OG", name: "Etage 1.OG", floor: "1.OG", size: "—", price: "—", status: "reserved" },
    { key: "DG", name: "Etage DG", floor: "DG", size: "—", price: "—", status: "sold" },
  ];

  const STATUS_COLOR = {
    free: new THREE.Color(0x00ff88),
    reserved: new THREE.Color(0xffcc00),
    sold: new THREE.Color(0xff4444),
  };

  function renderTable(highlightKey = null) {
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

    panelNote.textContent = highlightKey
      ? `Ausgewählt: ${highlightKey}`
      : "Hover über EG / 1.OG / DG";
  }

  renderTable();

  // ---------------- THREE SETUP ----------------

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eeeeee");

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
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
  let root = null;
  let pickMeshes = [];

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let hoveredGroup = null;

  function loadModel(url) {
    gltfLoader.load(url, (gltf) => {

      root = gltf.scene;
      scene.add(root);

      // collect meshes
      pickMeshes = [];
      root.traverse(obj => {
        if (obj.isMesh) pickMeshes.push(obj);
      });

      console.log("Meshes:", pickMeshes.length);

      fitCamera(root);

    });
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

  // ---------------- HOVER ----------------

  renderer.domElement.addEventListener("mousemove", (event) => {

    if (!root) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const hits = raycaster.intersectObjects(pickMeshes, true);

    if (!hits.length) {
      resetHighlight();
      renderTable();
      return;
    }

    let obj = hits[0].object;

    while (obj && obj !== root) {
      if (obj.name === "EG" || obj.name === "1.OG" || obj.name === "DG") break;
      obj = obj.parent;
    }

    if (!obj || obj === root) {
      resetHighlight();
      renderTable();
      return;
    }

    if (hoveredGroup === obj) return;

    resetHighlight();

    hoveredGroup = obj;

    const data = floors.find(f => f.key === obj.name);
    if (!data) return;

    obj.traverse(child => {
      if (!child.isMesh) return;
      child.userData.originalMaterial = child.userData.originalMaterial || child.material;
      const mat = child.material.clone();
      mat.emissive = STATUS_COLOR[data.status];
      mat.emissiveIntensity = 0.4;
      child.material = mat;
    });

    renderTable(obj.name);

  });

  function resetHighlight() {
    if (!hoveredGroup) return;
    hoveredGroup.traverse(child => {
      if (!child.isMesh) return;
      if (child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial;
      }
    });
    hoveredGroup = null;
  }

  // ---------------- LOOP ----------------

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return { loadModel };
}
