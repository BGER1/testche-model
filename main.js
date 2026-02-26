<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
  }
}
</script>
import { Viewer } from "./viewer.js";

const viewer = Viewer();
viewer.loadModel("./models/Testche.glb");
