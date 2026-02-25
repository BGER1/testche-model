const ViewerBG = "#eeeeee";

const ViewerUI = {
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

function show(ele) { if (ele) ele.style.display = "block"; }
function hide(ele) { if (ele) ele.style.display = "none"; }

function setItemSelected(ele, bool) {
  if (!ele) return;
  if (bool) ele.classList.add("item-selected");
  else ele.classList.remove("item-selected");
}

function toggle(ele) {
  if (!ele) return false;
  const isVisible = ele.getBoundingClientRect().height > 0;
  ele.style.display = isVisible ? "none" : "block";
  return !isVisible;
}

function Viewer() {
  const wrapper = ViewerUI.canvasWrapper;
  if (!wrapper) {
    console.error("viewerCanvasWrapper not found");
    return { loadModel() {} };
  }

  // --- THREE basics
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ViewerBG);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10000);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  wrapper.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;

  // Default camera position (wird nach Model-Load “gefitten”)
  camera.position.set(2, 1.2, 2);
  controls.target.set(0, 0, 0);
  controls.update();

  // Licht (robust für Architektur)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.9);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // optional: leichter “Floor”-Anker (kannst du später entfernen)
  // const grid = new THREE.GridHelper(10, 10);
  // grid.material.opacity = 0.15;
  // grid.material.transparent = true;
  // scene.add(grid);

  // --- model state
  const gltfLoader = new THREE.GLTFLoader();
  let loadedRoot = null;
  let lastLoadedUrl = null;

  function onResize() {
    const w = wrapper.clientWidth || 1;
    const h = wrapper.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", onResize);
  onResize();

  function setLoader(text) {
    if (!ViewerUI.loader || !ViewerUI.loaderInfo) return;
    show(ViewerUI.loader);
    ViewerUI.loaderInfo.textContent = text || "Loading...";
  }

  function clearLoader() {
    if (!ViewerUI.loader) return;
    hide(ViewerUI.loader);
  }

  function disposeObject3D(obj) {
    obj.traverse((n) => {
      if (n.isMesh) {
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
      }
    });
  }

  function fitCameraToObject(object, offset = 1.25) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Falls Box leer/kaputt ist:
    const maxDim = Math.max(size.x, size.y, size.z);
    const safeDim = (maxDim && isFinite(maxDim)) ? maxDim : 1;

    // distance so that object fits in view
    const fov = (camera.fov * Math.PI) / 180;
    let distance = (safeDim / 2) / Math.tan(fov / 2);
    distance *= offset;

    // set near/far
    camera.near = Math.max(safeDim / 1000, 0.01);
    camera.far = safeDim * 1000;
    camera.updateProjectionMatrix();

    // position camera on a diagonal
    camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.35, distance));
    controls.target.copy(center);
    controls.update();
    controls.saveState?.();

    // optional: light follows size
    dir.position.copy(center).add(new THREE.Vector3(distance, distance * 2, distance));
  }

  function buildSimpleBrowserTree(root) {
    if (!ViewerUI.modelBrowserContent) return;
    ViewerUI.modelBrowserContent.innerHTML = "";

    const title = document.createElement("div");
    title.style.padding = "12px";
    title.style.borderBottom = "1px solid #ddd";
    title.style.fontWeight = "600";
    title.textContent = root.name || "Scene";
    ViewerUI.modelBrowserContent.appendChild(title);

    // Nur 1 Level für Start (später können wir Etagen/Nodes als Liste machen)
    root.traverse((n) => {
      if (!n.isMesh && (!n.children || n.children.length === 0)) return;

      const row = document.createElement("div");
      row.className = "graph-item-wrapper";
      row.innerHTML = `
        <div class="graph-item">
          <div class="graph-left">
            <div class="graph-folder"><i class="fa fa-cube"></i></div>
            <div class="graph-name">${(n.name || "(no name)")}</div>
          </div>
          <div class="graph-right">
            <div class="graph-visible"><i class="fa fa-eye"></i></div>
          </div>
        </div>
      `;

      // show/hide toggle
      const eye = row.querySelector(".graph-visible");
      let visible = true;
      eye.addEventListener("click", (e) => {
        e.stopPropagation();
        visible = !visible;
        n.visible = visible;
        eye.innerHTML = visible ? '<i class="fa fa-eye"></i>' : '<i class="fa fa-eye-slash"></i>';
        eye.style.color = visible ? "inherit" : "rgba(0,0,0,0.35)";
      });

      // focus on click
      const name = row.querySelector(".graph-name");
      name.addEventListener("click", () => {
        // zoom to that subtree
        fitCameraToObject(n, 1.35);
      });

      ViewerUI.modelBrowserContent.appendChild(row);
    });
  }

  function loadModel(urlOrDataUrl) {
    lastLoadedUrl = urlOrDataUrl;

    // reset old
    if (loadedRoot) {
      scene.remove(loadedRoot);
      disposeObject3D(loadedRoot);
      loadedRoot = null;
    }

    setLoader("Loading model...");

    gltfLoader.load(
      urlOrDataUrl,
      (gltf) => {
        loadedRoot = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!loadedRoot) {
          console.error("GLTF loaded, but no scene found.");
          setLoader("Loaded, but no scene found (check console).");
          return;
        }

        // ensure double side for architecture (optional)
        loadedRoot.traverse((n) => {
          if (n.isMesh && n.material) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((m) => {
              m.side = THREE.DoubleSide;
              m.needsUpdate = true;
            });
          }
        });

        scene.add(loadedRoot);
        fitCameraToObject(loadedRoot, 1.25);
        buildSimpleBrowserTree(loadedRoot);

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
        console.error("Error loading model:", err);
        setLoader("Error loading model (see console).");
      }
    );
  }

  // --- UI events
  if (ViewerUI.fileInput) {
    ViewerUI.fileInput.addEventListener("input", (evt) => {
      const file = evt.target.files?.[0];
      if (!file) return;

      setLoader("Reading file...");
      const reader = new FileReader();

      reader.onload = (e) => loadModel(e.target.result); // dataURL
      reader.onerror = (e) => {
        console.error("File read error", e);
        setLoader("Error reading file (see console).");
      };

      reader.readAsDataURL(file);
    });
  }

  // modes (OrbitControls only, we remap mouse buttons)
  function setOrbitMode() {
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
  }

  function setPanMode() {
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.enableZoom = false;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN
    };
  }

  function setZoomMode() {
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.DOLLY,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.DOLLY
    };
  }

  let selectedModeElement = ViewerUI.toggleOrbit;
  setOrbitMode();

  if (ViewerUI.toggleOrbit) ViewerUI.toggleOrbit.onclick = () => {
    setOrbitMode();
    setItemSelected(selectedModeElement, false);
    selectedModeElement = ViewerUI.toggleOrbit;
    setItemSelected(selectedModeElement, true);
  };

  if (ViewerUI.togglePan) ViewerUI.togglePan.onclick = () => {
    setPanMode();
    setItemSelected(selectedModeElement, false);
    selectedModeElement = ViewerUI.togglePan;
    setItemSelected(selectedModeElement, true);
  };

  if (ViewerUI.toggleZoom) ViewerUI.toggleZoom.onclick = () => {
    setZoomMode();
    setItemSelected(selectedModeElement, false);
    selectedModeElement = ViewerUI.toggleZoom;
    setItemSelected(selectedModeElement, true);
  };

  function resetView() {
    if (loadedRoot) {
      fitCameraToObject(loadedRoot, 1.25);
    } else if (lastLoadedUrl) {
      loadModel(lastLoadedUrl);
    }
    controls.reset?.();
    controls.update();
  }

  if (ViewerUI.resetBtn) ViewerUI.resetBtn.onclick = resetView;
  if (ViewerUI.backToHome) ViewerUI.backToHome.onclick = resetView;

  if (ViewerUI.downloadScreen) {
    ViewerUI.downloadScreen.onclick = () => {
      // einmal rendern damit Canvas aktuell ist
      renderer.render(scene, camera);
      const image = renderer.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = image;
      a.download = "screenshot.png";
      a.click();
    };
  }

  if (ViewerUI.toggleModelBrowser && ViewerUI.modelBrowser) {
    ViewerUI.toggleModelBrowser.onclick = () => toggle(ViewerUI.modelBrowser);
  }

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
