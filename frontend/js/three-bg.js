/* ============================================================================
   three-bg.js
   -----------
   Renders the animated "signal network" hero background using Three.js.
   Concept: floating particles = resumes & job postings; lines connecting
   nearby particles = the AI "matching" them together. This is the site's
   signature visual element (see design brief in the skill notes).

   Loaded as an ES module directly from a CDN, so there is NOTHING to
   npm-install for the frontend — just open index.html in a browser.
   ========================================================================== */
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

// --- 1. Basic scene setup -------------------------------------------------
const canvas = document.getElementById("three-canvas");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 32;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- 2. Generate a cloud of particles (nodes) -----------------------------
const NODE_COUNT = 140;
const nodePositions = [];
const velocities = [];

for (let i = 0; i < NODE_COUNT; i++) {
  // Spread nodes across a wide flat volume in front of the camera
  nodePositions.push(
    (Math.random() - 0.5) * 60, // x
    (Math.random() - 0.5) * 34, // y
    (Math.random() - 0.5) * 20  // z
  );
  // Small random drift speed per-node -> gives the scene a slow "alive" feel
  velocities.push(
    (Math.random() - 0.5) * 0.01,
    (Math.random() - 0.5) * 0.01,
    (Math.random() - 0.5) * 0.01
  );
}

const nodeGeometry = new THREE.BufferGeometry();
nodeGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(nodePositions, 3)
);

const nodeMaterial = new THREE.PointsMaterial({
  color: 0x3ddbd9,      // cyan accent, matches --accent-2 in CSS
  size: 0.45,
  transparent: true,
  opacity: 0.9,
});

const points = new THREE.Points(nodeGeometry, nodeMaterial);
scene.add(points);

// --- 3. Lines connecting nearby nodes ("matches") -------------------------
// Recomputed every frame based on live distance -> lines appear/disappear
// as nodes drift, visually mimicking new matches forming.
const lineMaterial = new THREE.LineBasicMaterial({
  color: 0x7c5cff,      // violet accent, matches --accent
  transparent: true,
  opacity: 0.25,
});
let lineSegments = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
scene.add(lineSegments);

const MAX_LINK_DISTANCE = 9; // nodes closer than this get connected by a line

function rebuildLinks(positionsArray) {
  const linePoints = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      const dx = positionsArray[i * 3] - positionsArray[j * 3];
      const dy = positionsArray[i * 3 + 1] - positionsArray[j * 3 + 1];
      const dz = positionsArray[i * 3 + 2] - positionsArray[j * 3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < MAX_LINK_DISTANCE) {
        linePoints.push(
          positionsArray[i * 3], positionsArray[i * 3 + 1], positionsArray[i * 3 + 2],
          positionsArray[j * 3], positionsArray[j * 3 + 1], positionsArray[j * 3 + 2]
        );
      }
    }
  }
  lineSegments.geometry.dispose();
  lineSegments.geometry = new THREE.BufferGeometry();
  lineSegments.geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(linePoints, 3)
  );
}

// --- 4. Animation loop -----------------------------------------------------
let frame = 0;
function animate() {
  requestAnimationFrame(animate);
  frame++;

  const positionsAttr = nodeGeometry.getAttribute("position");
  const arr = positionsAttr.array;

  // Drift every node slightly + bounce off invisible bounds
  for (let i = 0; i < NODE_COUNT; i++) {
    arr[i * 3] += velocities[i * 3];
    arr[i * 3 + 1] += velocities[i * 3 + 1];
    arr[i * 3 + 2] += velocities[i * 3 + 2];

    if (Math.abs(arr[i * 3]) > 30) velocities[i * 3] *= -1;
    if (Math.abs(arr[i * 3 + 1]) > 17) velocities[i * 3 + 1] *= -1;
    if (Math.abs(arr[i * 3 + 2]) > 10) velocities[i * 3 + 2] *= -1;
  }
  positionsAttr.needsUpdate = true;

  // Recomputing links every frame is O(n^2); fine at n=140 but throttle
  // anyway so it doesn't dominate frame time.
  if (frame % 4 === 0) rebuildLinks(arr);

  // Slow whole-scene rotation for a subtle parallax feel
  scene.rotation.y = Math.sin(frame * 0.0007) * 0.15;
  scene.rotation.x = Math.cos(frame * 0.0005) * 0.05;

  renderer.render(scene, camera);
}
animate();

// --- 5. Keep the canvas full-size on window resize --------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
