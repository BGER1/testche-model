function Viewer() {
  const wrapper = document.getElementById("viewerCanvasWrapper");
  const loaderEl = document.getElementById("loader");
  const loaderInfo = document.getElementById("loaderInfo");

  function setLoader(text) {
    if (!loaderEl || !loaderInfo) return;
    loaderEl.style.display = "block";
    loaderInfo.textContent = text || "Loading...";
  }
  function clearLoader() {
    if (!loaderEl) return;
    loaderEl.style.display = "none";
  }

  // --- three basics
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eeeeee");

  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 1e7);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  wrapper.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;

  // Lights (strong + soft, good for buildings)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x777777, 1.2);
  scene.add(hemi);

  const dir1 = new THREE.DirectionalLight(0xffffff, 1.0);
  dir1.position.set(10, 20, 10);
  scene.add(dir1);

  const dir2 = new THREE.DirectionalLight(0xffffff, 0.6);
  dir2.position.set(-10, 10, -10);
  scene.add(dir2);

  // Resize
  function resize() {
    const w = wrapper.clientWidth || 1;
    const h = wrapper.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // Model state
  const gltfLoader = new THREE.GLTFLoader();
  let root = null;

  function fitCameraToObject(object, offset = 1.25) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    console.log("GLB size:", size, "maxDim:", maxDim, "center:", center);

    // Set near/far safely
    camera.near = Math.max(maxDim / 1000, 0.01);
    camera.far = maxDim * 1000;
    camera.updateProjectionMatrix();

    const fov = (camera.fov * Math.PI) / 180;
    let distance = (maxDim / 2) / Math.tan(fov / 2);
    distance *= offset;

    // place camera diagonal and a bit above
    camera.position.copy(center).add(new THREE.Vector3(distance, distance * 0.35, distance));
    controls.target.copy(center);
    controls.update();
    controls.saveState?.();
  }

  function loadModel(url) {
    setLoader("Loading model...");

    if (root) {
      scene.remove(root);
      root = null;
    }

    gltfLoader.load(
      url,
      (gltf) => {
        root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!root) {
          setLoader("Loaded, but no scene found (see console).");
          console.error("No gltf.scene");
          return;
        }

        // Make materials robust for architecture
        root.traverse((n) => {
          if (n.isMesh) {
            n.castShadow = false;
            n.receiveShadow = false;

            if (n.material) {
              const mats = Array.isArray(n.material) ? n.material : [n.material];
              mats.forEach((m) => {
                m.side = THREE.DoubleSide;
                m.needsUpdate = true;
              });
            }
          }
        });

        // Center the object around (0,0,0) for stability
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        root.position.sub(center);

        scene.add(root);

        // Fit camera after centering
        fitCameraToObject(root, 1.3);

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
        console.error(err);
        setLoader("Error loading model (see console).");
      }
    );
  }

  // Animate
  function animate() {
    requestAnimationFrame(animate);

    // Optional: gentle auto-rotate (disable if you don’t want it)
    // controls.autoRotate = true;
    // controls.autoRotateSpeed = 0.6;

    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  clearLoader();

  return { loadModel };
}
