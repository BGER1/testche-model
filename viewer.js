// viewer.js (ES module, CDN-based, no local vendor needed)
//
// Files expected:
// - index.html includes: <script type="module" src="./main.js"></script>
// - main.js does: import { Viewer } from "./viewer.js"; const v=Viewer(); v.loadModel("./models/Testche.glb");
//
// This viewer provides:
// - render canvas in #viewerCanvasWrapper
// - orbit/pan/zoom modes via footer buttons (toggleOrbit/togglePan/toggleZoom)
// - reset via resetBtn + backToHome
// - file picker (#fileInput) to load another GLB/GLTF
// - screenshot button (#downloadScreen)
// - optional simple model browser list (#modelBrowserContent) + toggle (#toggleModelBrowser)

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

export function Viewer() {
  // --- UI refs (must exist in your index.html)
  const UI = {
    canvasWrapper: document.getElementById("viewerCanvasWrapper"),
    fileInput: document.getElementById("fileInput"),
    loader: document.getElementById("loader"),
    loaderInfo: document.getElementById("loaderInfo"),

    toggleZoom: document.getElementById("toggleZoom"),
    togglePan: document.getElementById("togglePan"),
    toggleOrbit: document.getElementById("toggleOrbit"),
    resetBtn: document.getElementById("resetBtn"),
    backToHome: document.getElementById("backToHome"),
    downloadScreen: document.getElementById("downloadScreen"),

    toggleModelBrowser: document.getElementById("toggleModelBrowser"),
    modelBrowser: document.getElementById("modelBrowser"),
    modelBrowserContent: document.getElementById("modelBrowserContent"),
  };

  if (!UI.canvasWrapper) {
    throw new Error("Missing #viewerCanvasWrapper in HTML");
  }

  // --- helpers
  const show = (el) => el && (el.style.display = "block");
  const hide = (el) => el && (el.style.display = "none");

  function setLoader(text) {
    if (!UI.loader || !UI.loaderInfo) return;
    show(UI.loader);
    UI.loaderInfo.textContent = text || "Loading...";
  }
  function clearLoader() {
    hide(UI.loader);
  }

  function setItemSelected(ele, on) {
    if (!ele) return;
    ele.classList.toggle("item-selected", !!on);
  }

  function toggleElement(el) {
    if (!el) return false;
    const visible = el.getBoundingClientRect().height > 0;
    el.style.display = visible ? "none" : "block";
    return !visible;
  }

  // --- three setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eeeeee");

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1e7);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  UI.canvasWrapper.appendChild(renderer.domElement);

  // lights (good defaults for buildings)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.15));

  const dir1 = new THREE.DirectionalLight(0xffffff, 1.0);
  dir1.position.set(10, 20, 10);
  scene.add(dir1);

  const dir2 = new THREE.DirectionalLight(0xffffff, 0.6);
  dir2.position.set(-10, 10, -10);
  scene.add(dir2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;

  // initial camera
  camera.position.set(2, 1.2, 2);
  controls.target.set(0, 0, 0);
  controls.update();
  controls.saveState?.();

  // resize
  function onResize() {
    const w = UI.canvasWrapper.clientWidth || 1;
    const h = UI.canvasWrapper.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);
  onResize();

  // --- model load / dispose
  const gltfLoader = new GLTFLoader();
  let root = null;
  let lastUrl = null;

  function disposeObject3D(obj) {
    obj.traverse((n) => {
      if (!n.isMesh) return;
      if (n.geometry) n.geometry.dispose?.();
      if (n.material) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => {
          // dispose textures
          for (const k in m) {
            const v = m[k];
            if (v && v.isTexture) v.dispose?.();
          }
          m.dispose?.();
        });
      }
    });
  }

  function fitCameraToObject(object, offset = 1.3) {
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
    controls.saveState?.();

    // move light with the scene size (helps if model is huge)
    dir1.position.copy(center).add(new THREE.Vector3(dist, dist * 2, dist));
  }

  function buildModelBrowserList(rootNode) {
    if (!UI.modelBrowserContent) return;
    UI.modelBrowserContent.innerHTML = "";

    const header = document.createElement("div");
    header.style.padding = "12px";
    header.style.borderBottom = "1px solid #ddd";
    header.style.fontWeight = "600";
    header.textContent = rootNode.name || "Scene";
    UI.modelBrowserContent.appendChild(header);

    // Keep it simple: list meshes + top-level groups (later we can do floors)
    const items = [];
    rootNode.traverse((n) => {
      if (n === rootNode) return;
      if (n.isMesh || (n.children && n.children.length > 0 && n.name)) items.push(n);
    });

    // avoid giant lists if your model has thousands of meshes
    const maxItems = 400;
    const sliced = items.slice(0, maxItems);

    sliced.forEach((n) => {
      const row = document.createElement("div");
      row.className = "graph-item-wrapper";
      const name = (n.name && n.name.trim()) ? n.name : (n.isMesh ? "(mesh)" : "(group)");

      row.innerHTML = `
        <div class="graph-item">
          <div class="graph-left">
            <div class="graph-folder"><i class="fa fa-cube"></i></div>
            <div class="graph-name">${name}</div>
          </div>
          <div class="graph-right">
            <div class="graph-visible"><i class="fa fa-eye"></i></div>
          </div>
        </div>
      `;

      const eye = row.querySelector(".graph-visible");
      const label = row.querySelector(".graph-name");

      eye.addEventListener("click", (e) => {
        e.stopPropagation();
        n.visible = !n.visible;
        eye.innerHTML = n.visible ? '<i class="fa fa-eye"></i>' : '<i class="fa fa-eye-slash"></i>';
        eye.style.color = n.visible ? "inherit" : "rgba(0,0,0,0.35)";
      });

      label.addEventListener("click", () => {
        // focus camera on that subtree
        fitCameraToObject(n, 1.35);
      });

      UI.modelBrowserContent.appendChild(row);
    });

    if (items.length > maxItems) {
      const note = document.createElement("div");
      note.style.padding = "10px 12px";
      note.style.opacity = "0.7";
      note.textContent = `Showing first ${maxItems} nodes (model is large).`;
      UI.modelBrowserContent.appendChild(note);
    }
  }

  function loadModel(urlOrDataUrl) {
    lastUrl = urlOrDataUrl;
    setLoader("Loading model...");

    if (root) {
      scene.remove(root);
      disposeObject3D(root);
      root = null;
    }

    gltfLoader.load(
      urlOrDataUrl,
      (gltf) => {
        root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!root) {
          setLoader("Loaded but no scene found (see console).");
          return;
        }

        // Make materials robust (double-sided helps with SketchUp exports)
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
        fitCameraToObject(root, 1.3);
        buildModelBrowserList(root);

        clearLoader();
      },
      (xhr) => {
        if (xhr.total) {
          const p = Math.round((xhr.loaded / xhr.total) * 100);
          setLoader(`${p}% loaded`);
        } else {
          setLoader("Loading...");
        }
      },
      (err) => {
        console.error("GLTF load error:", err);
        setLoader("Error loading model (see console).");
      }
    );
  }

  // --- controls modes
  function setOrbitMode() {
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
  }

  function setPanMode() {
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.enableZoom = false;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };
  }

  function setZoomMode() {
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.DOLLY,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.DOLLY,
    };
  }

  let selectedModeEl = UI.toggleOrbit;
  setOrbitMode();
  setItemSelected(selectedModeEl, true);

  UI.toggleOrbit && (UI.toggleOrbit.onclick = () => {
    setOrbitMode();
    setItemSelected(selectedModeEl, false);
    selectedModeEl = UI.toggleOrbit;
    setItemSelected(selectedModeEl, true);
  });

  UI.togglePan && (UI.togglePan.onclick = () => {
    setPanMode();
    setItemSelected(selectedModeEl, false);
    selectedModeEl = UI.togglePan;
    setItemSelected(selectedModeEl, true);
  });

  UI.toggleZoom && (UI.toggleZoom.onclick = () => {
    setZoomMode();
    setItemSelected(selectedModeEl, false);
    selectedModeEl = UI.toggleZoom;
    setItemSelected(selectedModeEl, true);
  });

  // reset
  function resetView() {
    if (root) {
      fitCameraToObject(root, 1.3);
    } else if (lastUrl) {
      loadModel(lastUrl);
    } else {
      controls.reset?.();
      controls.update();
    }
  }

  UI.resetBtn && (UI.resetBtn.onclick = resetView);
  UI.backToHome && (UI.backToHome.onclick = resetView);

  // screenshot
  UI.downloadScreen && (UI.downloadScreen.onclick = () => {
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "screenshot.png";
    a.click();
  });

  // file input
  UI.fileInput && UI.fileInput.addEventListener("input", (evt) => {
    const file = evt.target.files?.[0];
    if (!file) return;

    setLoader("Reading file...");
    const reader = new FileReader();
    reader.onload = (e) => loadModel(e.target.result); // data URL works fine
    reader.onerror = (e) => {
      console.error("File read error:", e);
      setLoader("Error reading file (see console).");
    };
    reader.readAsDataURL(file);
  });

  // model browser toggle
  UI.toggleModelBrowser && UI.modelBrowser && (UI.toggleModelBrowser.onclick = () => {
    toggleElement(UI.modelBrowser);
  });

  // --- render loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  clearLoader();

  return { loadModel };
}
