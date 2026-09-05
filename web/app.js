import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const ARENA = 40;
const HALF_ARENA = ARENA / 2;
const CAPTURE_DISTANCE = 0.55;
const MATCH_SECONDS = 300;
const CATCHER_VISION_RANGE = 16;
const CATCHER_VISION_FOV = Math.PI * .5;
const clock = new THREE.Clock();
const state = {
  running: false,
  elapsed: 0,
  catcher: null,
  runner: null,
  nextRandomDecision: 0,
  catcherRandomHeading: 0,
  runnerRandomHeading: Math.PI,
  catcherRandomTarget: new THREE.Vector3(),
  runnerRandomTarget: new THREE.Vector3(),
  runnerHideTarget: new THREE.Vector3(),
  nextHideDecision: 0,
  runnerHiding: false,
  runnerVisible: false,
};
let spectateMode = 'arena';
const arenaFocus = new THREE.Vector3(0, 0, 0);
const spectateOffset = new THREE.Vector3(9, 13, 11);
const lastFollowPosition = new THREE.Vector3();
const sightRaycaster = new THREE.Raycaster();
const runnerHideSpots = [
  new THREE.Vector3(-12, 0, -11),
  new THREE.Vector3(12, 0, 12),
  new THREE.Vector3(-14, 0, 12),
  new THREE.Vector3(14, 0, -13),
  new THREE.Vector3(-3.5, 0, -9.5),
  new THREE.Vector3(7.5, 0, -4.8),
  new THREE.Vector3(-8.5, 0, 5.2),
  new THREE.Vector3(5.5, 0, 5.5),
  new THREE.Vector3(-1.5, 0, 2.5),
  new THREE.Vector3(12, 0, -3.5),
];

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#071012', ARENA * .7, ARENA * 2.6);
scene.background = new THREE.Color('#102a3a');
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(29, 34, 31);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.querySelector('#scene').appendChild(renderer.domElement);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ssaoPass = new SSAOPass(scene, camera, 1, 1);
ssaoPass.kernelRadius = 12;
ssaoPass.minDistance = .002;
ssaoPass.maxDistance = .18;
composer.addPass(ssaoPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), .16, .45, .82);
composer.addPass(bloomPass);
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
new RGBELoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r164/examples/textures/equirectangular/royal_esplanade_1k.hdr', (texture) => {
  const environment = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = environment;
  texture.dispose();
  pmremGenerator.dispose();
});
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI - .12;

scene.add(new THREE.HemisphereLight('#d9ffe9', '#142421', 2.4));
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(92, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      zenith: { value: new THREE.Color('#102a3a') },
      horizon: { value: new THREE.Color('#8fb69e') },
      sunColor: { value: new THREE.Color('#ffd48a') },
    },
    vertexShader: `varying vec3 worldPosition; void main() { worldPosition = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunColor; varying vec3 worldPosition; void main() { vec3 direction = normalize(worldPosition - cameraPosition); float height = max(direction.y, 0.0); vec3 skyColor = mix(horizon, zenith, smoothstep(0.0, 0.82, height)); float sun = pow(max(dot(direction, normalize(vec3(-.42, .7, -.55))), 0.0), 64.0); gl_FragColor = vec4(skyColor + sunColor * sun * .7, 1.0); }`,
  }),
);
scene.add(sky);
const keyLight = new THREE.DirectionalLight('#fff0c7', 5.5);
keyLight.position.set(-16, 28, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -28;
keyLight.shadow.camera.right = 28;
keyLight.shadow.camera.top = 28;
keyLight.shadow.camera.bottom = -28;
keyLight.shadow.camera.far = 100;
scene.add(keyLight);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff0ad' }));
sunDisc.position.set(-18, 24, -27);
scene.add(sunDisc);

function createGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#375847';
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 2600; index += 1) {
    const tone = 48 + Math.floor(Math.random() * 32);
    context.fillStyle = `rgba(${tone - 15}, ${tone + 18}, ${tone - 4}, ${.15 + Math.random() * .22})`;
    const size = Math.random() * 2.5 + .4;
    context.fillRect(Math.random() * 256, Math.random() * 256, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  return texture;
}

const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA, ARENA), new THREE.MeshPhysicalMaterial({ color: '#8ba997', map: createGroundTexture(), roughness: .95, metalness: 0, clearcoat: .08 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(ARENA, 48, '#47746c', '#24413d');
grid.position.y = .012;
grid.material.transparent = true;
grid.material.opacity = .18;
scene.add(grid);

const boundaryMaterial = new THREE.MeshStandardMaterial({ color: '#365c54', emissive: '#10221e', roughness: .7 });
for (const [x, z, sx, sz] of [[0, -HALF_ARENA - .08, ARENA + .3, .16], [0, HALF_ARENA + .08, ARENA + .3, .16], [-HALF_ARENA - .08, 0, .16, ARENA + .3], [HALF_ARENA + .08, 0, .16, ARENA + .3]]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, .36, sz), boundaryMaterial);
  wall.position.set(x, .18, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

const coverGroup = new THREE.Group();
scene.add(coverGroup);
const vegetationGroup = new THREE.Group();
scene.add(vegetationGroup);
const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#654b38', roughness: .95 });
const leafMaterial = new THREE.MeshStandardMaterial({ color: '#39715a', emissive: '#123a2d', emissiveIntensity: .25, roughness: .9 });
const leafHighlightMaterial = new THREE.MeshStandardMaterial({ color: '#568b67', emissive: '#173d2b', emissiveIntensity: .16, roughness: .88 });
const grassMaterial = new THREE.MeshStandardMaterial({ color: '#4f8b58', roughness: .95, side: THREE.DoubleSide });
const flowerMaterials = [
  new THREE.MeshStandardMaterial({ color: '#f4cf68', emissive: '#6b4613', emissiveIntensity: .08, roughness: .7 }),
  new THREE.MeshStandardMaterial({ color: '#e9859d', emissive: '#5e1d32', emissiveIntensity: .08, roughness: .7 }),
  new THREE.MeshStandardMaterial({ color: '#f0e8d0', emissive: '#6a6046', emissiveIntensity: .08, roughness: .7 }),
];
const roofMaterial = new THREE.MeshStandardMaterial({ color: '#a9573f', roughness: .82 });
const houseMaterial = new THREE.MeshStandardMaterial({ color: '#b8a98a', roughness: .9 });
const mountainMaterial = new THREE.MeshStandardMaterial({ color: '#667e76', roughness: 1 });
const snowMaterial = new THREE.MeshStandardMaterial({ color: '#dce8df', roughness: .86 });

function addFieldVegetation() {
  const grassCount = 18000;
  const grassMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(.055, .42, 4), grassMaterial, grassCount);
  const flowerMeshes = flowerMaterials.map((material) => new THREE.InstancedMesh(new THREE.SphereGeometry(.085, 7, 5), material, 140));
  const transform = new THREE.Object3D();
  const randomValue = (index, salt) => {
    const value = (Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453) % 1;
    return value < 0 ? value + 1 : value;
  };
  for (let index = 0; index < grassCount; index += 1) {
    const x = randomValue(index, 1) * (ARENA - 2) - (HALF_ARENA - 1);
    const z = randomValue(index, 2) * (ARENA - 2) - (HALF_ARENA - 1);
    transform.position.set(x, .17, z);
    transform.rotation.set(0, randomValue(index, 3) * Math.PI, (randomValue(index, 4) - .5) * .35);
    const scale = .65 + Math.abs(randomValue(index, 5)) * .7;
    transform.scale.set(scale, scale, scale);
    transform.updateMatrix();
    grassMesh.setMatrixAt(index, transform.matrix);
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  vegetationGroup.add(grassMesh);
  flowerMeshes.forEach((mesh, flowerIndex) => {
    for (let index = 0; index < 140; index += 1) {
      const seed = flowerIndex * 100 + index;
      const x = randomValue(seed, 11) * (ARENA - 3) - (HALF_ARENA - 1.5);
      const z = randomValue(seed, 12) * (ARENA - 3) - (HALF_ARENA - 1.5);
      transform.position.set(x, .18, z);
      transform.rotation.set(0, randomValue(seed, 13) * Math.PI, 0);
      const scale = .7 + Math.abs(randomValue(seed, 14)) * .65;
      transform.scale.set(scale, scale, scale);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    vegetationGroup.add(mesh);
  });
}

function addTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16, .23, 1.25, 8), trunkMaterial);
  trunk.position.y = .63;
  trunk.castShadow = true;
  tree.add(trunk);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(.72, 12, 8), leafMaterial);
  lower.scale.set(1, 1.18, 1);
  lower.position.y = 1.52;
  lower.castShadow = true;
  tree.add(lower);
  const upper = new THREE.Mesh(new THREE.SphereGeometry(.58, 12, 8), leafHighlightMaterial);
  upper.position.set(.3, 2.12, -.08);
  upper.castShadow = true;
  tree.add(upper);
  const sideCanopy = new THREE.Mesh(new THREE.SphereGeometry(.48, 12, 8), leafMaterial);
  sideCanopy.position.set(-.36, 1.9, .15);
  sideCanopy.castShadow = true;
  tree.add(sideCanopy);
  coverGroup.add(tree);
}

function addForest(x, z, rows, columns, spacing = 1.45, scale = 1) {
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const jitter = ((row * 7 + column * 11) % 5 - 2) * .16;
      addTree(x + (column - (columns - 1) / 2) * spacing + jitter, z + (row - (rows - 1) / 2) * spacing + jitter, scale * (0.84 + ((row + column) % 3) * .1));
    }
  }
}

function addHouse(x, z, rotation = 0, scale = 1) {
  const house = new THREE.Group();
  house.position.set(x, 0, z);
  house.rotation.y = rotation;
  house.scale.setScalar(scale);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.75, 2.1), houseMaterial);
  body.position.y = .88;
  body.castShadow = true;
  body.receiveShadow = true;
  house.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.35, 4), roofMaterial);
  roof.position.y = 2.42;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  house.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(.28, .72, .28), new THREE.MeshStandardMaterial({ color: '#7b6252', roughness: .95 }));
  chimney.position.set(.62, 2.66, -.35);
  chimney.castShadow = true;
  house.add(chimney);
  const door = new THREE.Mesh(new THREE.BoxGeometry(.42, .82, .04), new THREE.MeshStandardMaterial({ color: '#463a32' }));
  door.position.set(0, .43, 1.07);
  house.add(door);
  const windowMaterial = new THREE.MeshStandardMaterial({ color: '#d2f0df', emissive: '#8ac9af', emissiveIntensity: .3 });
  for (const windowX of [-.72, .72]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(.42, .4, .04), windowMaterial);
    window.position.set(windowX, 1.05, 1.07);
    house.add(window);
  }
  coverGroup.add(house);
}

function addMountain(x, z, width, height, color = '#667e76') {
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(width, height, 9), mountainMaterial.clone());
  mountain.material.color.set(color);
  mountain.position.set(x, height / 2 - .02, z);
  mountain.scale.x = .82;
  mountain.rotation.y = .4;
  mountain.castShadow = true;
  coverGroup.add(mountain);
  const snow = new THREE.Mesh(new THREE.ConeGeometry(width * .31, height * .3, 9), snowMaterial);
  snow.position.set(x, height * .86, z);
  snow.scale.x = .82;
  snow.rotation.y = .4;
  snow.castShadow = true;
  coverGroup.add(snow);
}

addFieldVegetation();
addForest(-12, -11, 6, 7, 1.55, 1.15);
addForest(12, 12, 6, 7, 1.55, 1.1);
addForest(-14, 12, 5, 6, 1.65, 1.05);
addForest(14, -13, 5, 6, 1.65, 1.05);
addForest(-2, 13, 4, 5, 1.55, .95);
addForest(4, -14, 3, 5, 1.6, .9);
addForest(-16, -2, 3, 4, 1.65, .9);
addHouse(-3.5, -9.5, -.25, 1.15);
addHouse(7.5, -4.8, .5, .95);
addHouse(-8.5, 5.2, -.6, 1.05);
addHouse(5.5, 5.5, .1, .9);
addHouse(-1.5, 2.5, -.7, .82);
addHouse(12, -3.5, .35, 1.05);
addMountain(-15, 16, 5.5, 8, '#627972');
addMountain(-4, 18, 7, 10, '#728981');
addMountain(9, 17, 5.8, 8.5, '#58726a');
addMountain(18, 12, 6, 9, '#6d837a');

function createBot(color, glowColor, label, start) {
  const group = new THREE.Group();
  group.position.set(start.x, 0, start.z);
  const isCat = label === 'CATCHER';
  const material = new THREE.MeshPhysicalMaterial({ color, emissive: glowColor, emissiveIntensity: .12, roughness: .62, metalness: .05, clearcoat: .18, clearcoatRoughness: .35 });
  const accentMaterial = new THREE.MeshPhysicalMaterial({ color: isCat ? '#d5a896' : '#efd3ad', roughness: .72, clearcoat: .08 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: isCat ? '#293443' : '#6d422b', roughness: .65 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#17221f' });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .72, 8, 16), material);
  body.position.y = .82;
  body.castShadow = true;
  group.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 10), accentMaterial);
  belly.scale.set(.9, 1.35, .35);
  belly.position.set(0, .82, -.27);
  group.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.36, 18, 14), material);
  head.position.set(0, 1.58, -.02);
  head.castShadow = true;
  group.add(head);
  if (isCat) {
    for (const earX of [-.23, .23]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.18, .38, 4), material);
      ear.position.set(earX, 1.92, -.01);
      ear.rotation.y = Math.PI / 4;
      ear.castShadow = true;
      group.add(ear);
    }
  } else {
    for (const earX of [-.27, .27]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(.2, 14, 10), accentMaterial);
      ear.scale.set(.72, 1, .3);
      ear.position.set(earX, 1.78, .01);
      ear.castShadow = true;
      group.add(ear);
    }
  }
  for (const eyeX of [-.12, .12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), eyeMaterial);
    eye.position.set(eyeX, 1.61, -.33);
    group.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), darkMaterial);
  nose.position.set(0, 1.49, -.35);
  group.add(nose);
  for (const legX of [-.18, .18]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .4, 6, 10), darkMaterial);
    leg.position.set(legX, .32, -.02);
    leg.castShadow = true;
    group.add(leg);
  }
  for (const armX of [-.37, .37]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .42, 6, 10), material);
    arm.position.set(armX, .88, -.02);
    arm.rotation.z = armX < 0 ? -.16 : .16;
    arm.castShadow = true;
    group.add(arm);
  }
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, .62, .29),
    new THREE.Vector3(isCat ? .5 : .38, .62, .52),
    new THREE.Vector3(isCat ? .65 : .52, .92, .72),
    new THREE.Vector3(isCat ? .42 : .3, 1.16, .82),
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 14, isCat ? .075 : .055, 8, false), accentMaterial);
  tail.castShadow = true;
  group.add(tail);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.6, .65, 48), new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: .48, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .025;
  group.add(ring);
  const trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: glowColor, transparent: true, opacity: .48 }));
  scene.add(trail);
  group.userData = { label, trail, trailPoints: [], speed: 0, heading: 0 };
  scene.add(group);
  return group;
}

state.catcher = createBot('#ed754e', '#ff7550', 'CATCHER', { x: -14.2, z: -13.4 });
state.runner = createBot('#48beb9', '#66e8db', 'RUNNER', { x: 14.1, z: 13.2 });

function applySceneTheme(theme) {
  const light = theme === 'light';
  floor.material.color.set(light ? '#c9d9d1' : '#102422');
  grassMaterial.color.set(light ? '#4d8b59' : '#39724b');
  sunDisc.material.color.set(light ? '#fff2b5' : '#ffdc87');
  boundaryMaterial.color.set(light ? '#6f9085' : '#365c54');
  boundaryMaterial.emissive.set(light ? '#b4c8be' : '#10221e');
  grid.material.color.set(light ? '#55736b' : '#47746c');
  scene.fog.color.set(light ? '#d8e4de' : '#071012');
  scene.background.set(light ? '#b9d2dc' : '#102a3a');
  sky.material.uniforms.zenith.value.set(light ? '#9cc4d2' : '#102a3a');
  sky.material.uniforms.horizon.value.set(light ? '#dbe9d8' : '#8fb69e');
  sky.material.uniforms.sunColor.value.set(light ? '#fff3bd' : '#ffd48a');
  scene.fog.near = light ? ARENA * .7 : ARENA * .7;
  scene.fog.far = light ? ARENA * 2.6 : ARENA * 2.6;
}

function setTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  document.querySelector('#theme-icon').textContent = light ? '☾' : '☼';
  document.querySelector('#theme-label').textContent = light ? 'DARK' : 'LIGHT';
  const button = document.querySelector('#theme-toggle');
  button.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  button.setAttribute('title', light ? 'Switch to dark mode' : 'Switch to light mode');
  applySceneTheme(light ? 'light' : 'dark');
  localStorage.setItem('pursuit-theme', light ? 'light' : 'dark');
}

function setSpectateMode(mode) {
  spectateMode = mode;
  document.querySelectorAll('.spectate-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.spectate === mode);
  });
  document.querySelector('#spectate-label').textContent = mode === 'arena' ? 'FULL ARENA' : `${mode.toUpperCase()} FOLLOW`;
  if (mode === 'arena') {
    camera.position.set(29, 34, 31);
    controls.target.copy(arenaFocus);
    return;
  }
  const target = mode === 'catcher' ? state.catcher : state.runner;
  const focus = new THREE.Vector3(target.position.x, .35, target.position.z);
  camera.position.copy(focus).add(spectateOffset);
  controls.target.copy(focus);
  lastFollowPosition.copy(target.position);
}

function randomArenaPoint() {
  const margin = 2.2;
  return new THREE.Vector3(
    THREE.MathUtils.randFloat(-HALF_ARENA + margin, HALF_ARENA - margin),
    0,
    THREE.MathUtils.randFloat(-HALF_ARENA + margin, HALF_ARENA - margin),
  );
}

function randomHideSpot() {
  const spot = runnerHideSpots[Math.floor(Math.random() * runnerHideSpots.length)];
  return spot.clone().add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.2), 0, THREE.MathUtils.randFloatSpread(1.2)));
}

function updateSpectatorCamera() {
  const target = spectateMode === 'catcher' ? state.catcher : spectateMode === 'runner' ? state.runner : null;
  if (!target) return;
  const movement = new THREE.Vector3().subVectors(target.position, lastFollowPosition);
  camera.position.add(movement);
  controls.target.add(movement);
  lastFollowPosition.copy(target.position);
}

function updateTrail(bot) {
  const points = bot.userData.trailPoints;
  points.push(new THREE.Vector3(bot.position.x, .04, bot.position.z));
  if (points.length > 100) points.shift();
  bot.userData.trail.geometry.setFromPoints(points);
}
function clampArena(position) {
  position.x = THREE.MathUtils.clamp(position.x, -HALF_ARENA + .65, HALF_ARENA - .65);
  position.z = THREE.MathUtils.clamp(position.z, -HALF_ARENA + .65, HALF_ARENA - .65);
}
function formatTime(seconds) {
  const remaining = Math.max(0, MATCH_SECONDS - seconds);
  return `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(Math.floor(remaining % 60)).padStart(2, '0')}`;
}
function angleDegrees(radians) { return String(Math.round((THREE.MathUtils.euclideanModulo(radians + Math.PI, Math.PI * 2) - Math.PI) * 180 / Math.PI)).padStart(3, '0'); }
function updateUI(distance) {
  const catcherSpeed = state.catcher.userData.speed;
  const runnerSpeed = state.runner.userData.speed;
  document.querySelector('#catcher-score').textContent = catcherSpeed.toFixed(1).padStart(4, '0');
  document.querySelector('#runner-score').textContent = runnerSpeed.toFixed(1).padStart(4, '0');
  document.querySelector('#catcher-meter').style.width = `${Math.min(100, catcherSpeed / 5.2 * 100)}%`;
  document.querySelector('#runner-meter').style.width = `${Math.min(100, runnerSpeed / 5.2 * 100)}%`;
  document.querySelector('#separation').textContent = distance.toFixed(2);
  document.querySelector('#vision-state').textContent = state.runnerVisible ? 'IN SIGHT' : 'HIDDEN';
  document.querySelector('#catcher-heading').textContent = angleDegrees(state.catcher.userData.heading);
  document.querySelector('#runner-heading').textContent = angleDegrees(state.runner.userData.heading);
  document.querySelector('#timer').textContent = formatTime(state.elapsed);
  document.querySelector('#time-progress').style.width = `${Math.max(0, (1 - state.elapsed / MATCH_SECONDS) * 100)}%`;
}
function setStatus(text, paused = false) {
  document.querySelector('#session-status').textContent = text;
  document.querySelector('.session-state').classList.toggle('paused', paused);
}
function resetMatch() {
  state.running = false;
  state.elapsed = 0;
  state.nextRandomDecision = 0;
  state.catcherRandomHeading = Math.random() * Math.PI * 2 - Math.PI;
  state.runnerRandomHeading = Math.random() * Math.PI * 2 - Math.PI;
  state.catcherRandomTarget.copy(randomArenaPoint());
  state.runnerRandomTarget.copy(randomArenaPoint());
  state.runnerHideTarget.copy(randomHideSpot());
  state.nextHideDecision = 3.5 + Math.random() * 2.5;
  state.runnerHiding = false;
  state.runnerVisible = false;
  state.catcher.position.set(-14.2, 0, -13.4);
  state.runner.position.set(14.1, 0, 13.2);
  state.catcher.userData.heading = 0;
  state.runner.userData.heading = Math.PI;
  state.catcher.userData.trailPoints = [];
  state.runner.userData.trailPoints = [];
  state.catcher.userData.trail.geometry.setFromPoints([]);
  state.runner.userData.trail.geometry.setFromPoints([]);
  document.querySelector('#run-button').innerHTML = '<span>▶</span> START MATCH';
  setStatus('READY TO RUN');
  updateUI(state.catcher.position.distanceTo(state.runner.position));
}
function tick(delta) {
  if (!state.running) return;
  state.elapsed = Math.min(MATCH_SECONDS, state.elapsed + delta);
  const catcher = state.catcher;
  const runner = state.runner;
  state.runnerVisible = canCatcherSeeRunner();
  if (state.elapsed >= state.nextRandomDecision) {
    state.catcherRandomHeading = Math.random() * Math.PI * 2 - Math.PI;
    state.runnerRandomHeading = Math.random() * Math.PI * 2 - Math.PI;
    state.nextRandomDecision = state.elapsed + 1.4 + Math.random() * 1.3;
    state.catcherRandomTarget.copy(randomArenaPoint());
    state.runnerRandomTarget.copy(randomArenaPoint());
  }
  if (state.elapsed >= state.nextHideDecision) {
    state.runnerHiding = !state.runnerHiding;
    state.runnerHideTarget.copy(randomHideSpot());
    state.nextHideDecision = state.elapsed + (state.runnerHiding ? 3.5 + Math.random() * 2.5 : 2.5 + Math.random() * 2.2);
  }
  const toRunner = new THREE.Vector3().subVectors(runner.position, catcher.position);
  const separation = toRunner.length();
  const randomCatcherVector = new THREE.Vector3(Math.sin(state.catcherRandomHeading), 0, Math.cos(state.catcherRandomHeading));
  const chaseVector = toRunner.normalize();
  const catcherWaypoint = new THREE.Vector3().subVectors(state.catcherRandomTarget, catcher.position).normalize();
  const chaseWeight = state.runnerVisible ? 3.2 : .42;
  const randomWeight = state.runnerVisible ? .12 : .55;
  const catcherIntent = randomCatcherVector.multiplyScalar(randomWeight).add(chaseVector.multiplyScalar(chaseWeight)).add(catcherWaypoint.multiplyScalar(state.runnerVisible ? .2 : 1.15));
  const targetAngle = Math.atan2(catcherIntent.x, catcherIntent.z);
  let catcherTurn = THREE.MathUtils.euclideanModulo(targetAngle - catcher.userData.heading + Math.PI, Math.PI * 2) - Math.PI;
  const maxTurn = state.runnerVisible ? .2 : .12;
  catcher.userData.heading += THREE.MathUtils.clamp(catcherTurn, -maxTurn, maxTurn);
  catcher.userData.speed = state.runnerVisible
    ? THREE.MathUtils.clamp(4.8 + Math.max(0, Math.cos(catcherTurn)) * 1.25, 4.5, 6.0)
    : THREE.MathUtils.clamp(3.5 + Math.max(0, Math.cos(catcherTurn)) * 1.15, 3.1, 4.65);
  catcher.position.x += Math.sin(catcher.userData.heading) * catcher.userData.speed * delta;
  catcher.position.z += Math.cos(catcher.userData.heading) * catcher.userData.speed * delta;

  const threat = new THREE.Vector3().subVectors(runner.position, catcher.position).normalize();
  const boundaryX = -runner.position.x / (HALF_ARENA * HALF_ARENA);
  const boundaryZ = -runner.position.z / (HALF_ARENA * HALF_ARENA);
  const randomRunnerVector = new THREE.Vector3(Math.sin(state.runnerRandomHeading), 0, Math.cos(state.runnerRandomHeading));
  const runnerWaypoint = new THREE.Vector3().subVectors(state.runnerRandomTarget, runner.position).normalize();
  const hideWaypoint = new THREE.Vector3().subVectors(state.runnerHideTarget, runner.position).normalize();
  const escape = threat.multiplyScalar(separation < 3.3 ? 1.0 : .38);
  const desired = escape
    .add(randomRunnerVector.multiplyScalar(.72))
    .add(runnerWaypoint.multiplyScalar(1.3))
    .add(hideWaypoint.multiplyScalar(state.runnerHiding ? 2.5 : 0))
    .add(new THREE.Vector3(boundaryX, 0, boundaryZ).multiplyScalar(.55));
  const runnerTarget = Math.atan2(desired.x, desired.z);
  let runnerTurn = THREE.MathUtils.euclideanModulo(runnerTarget - runner.userData.heading + Math.PI, Math.PI * 2) - Math.PI;
  runner.userData.heading += THREE.MathUtils.clamp(runnerTurn, -.07, .07);
  runner.userData.speed = THREE.MathUtils.clamp(4.2 + (separation < 3.3 ? .75 : .35), 3.8, 5.2);
  runner.position.x += Math.sin(runner.userData.heading) * runner.userData.speed * delta;
  runner.position.z += Math.cos(runner.userData.heading) * runner.userData.speed * delta;
  clampArena(catcher.position);
  clampArena(runner.position);
  catcher.rotation.y = catcher.userData.heading + Math.PI;
  runner.rotation.y = runner.userData.heading + Math.PI;
  updateTrail(catcher);
  updateTrail(runner);
  updateUI(catcher.position.distanceTo(runner.position));
  if (separation <= CAPTURE_DISTANCE) {
    state.running = false;
    setStatus('RUNNER CAPTURED', true);
    document.querySelector('#run-button').innerHTML = '<span>↻</span> RUN AGAIN';
  } else if (state.elapsed >= MATCH_SECONDS) {
    state.running = false;
    setStatus('RUNNER SURVIVED', false);
    document.querySelector('#run-button').innerHTML = '<span>↻</span> RUN AGAIN';
  }
}

function canCatcherSeeRunner() {
  const origin = new THREE.Vector3(state.catcher.position.x, 1.2, state.catcher.position.z);
  const target = new THREE.Vector3(state.runner.position.x, 1.2, state.runner.position.z);
  const ray = target.sub(origin);
  const distanceToRunner = ray.length();
  if (distanceToRunner > CATCHER_VISION_RANGE) return false;
  const bearing = Math.atan2(ray.x, ray.z);
  const headingError = THREE.MathUtils.euclideanModulo(bearing - state.catcher.userData.heading + Math.PI, Math.PI * 2) - Math.PI;
  if (Math.abs(headingError) > CATCHER_VISION_FOV / 2) return false;
  sightRaycaster.set(origin, ray.normalize());
  const obstructions = sightRaycaster.intersectObjects(coverGroup.children, true);
  return !obstructions.some((hit) => hit.distance > .35 && hit.distance < distanceToRunner - .35);
}

function resize() {
  const container = document.querySelector('#scene');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight, false);
  composer.setSize(container.clientWidth, container.clientHeight);
}
window.addEventListener('resize', resize);
document.querySelector('#run-button').addEventListener('click', () => {
  if (state.elapsed >= MATCH_SECONDS || document.querySelector('#session-status').textContent.includes('CAPTURED') || document.querySelector('#session-status').textContent.includes('SURVIVED')) resetMatch();
  state.running = !state.running;
  document.querySelector('#run-button').innerHTML = state.running ? '<span>Ⅱ</span> PAUSE MATCH' : '<span>▶</span> RESUME MATCH';
  setStatus(state.running ? 'MATCH IN PROGRESS' : 'MATCH PAUSED', !state.running);
});
document.querySelector('#reset-button').addEventListener('click', resetMatch);
document.querySelector('#theme-toggle').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});
document.querySelectorAll('.spectate-button').forEach((button) => {
  button.addEventListener('click', () => setSpectateMode(button.dataset.spectate));
});

setTheme(localStorage.getItem('pursuit-theme') === 'light' ? 'light' : 'dark');
setSpectateMode('arena');
resetMatch();
resize();
function animate() {
  requestAnimationFrame(animate);
  tick(Math.min(clock.getDelta(), .05));
  updateSpectatorCamera();
  controls.update();
  composer.render();
}
animate();
