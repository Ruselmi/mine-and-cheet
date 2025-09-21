import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createNoise2D } from 'simplex-noise';

// --- BASIC SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// --- TEXTURES & MATERIALS ---
const loader = new THREE.TextureLoader();
function loadTexture(path) {
    const texture = loader.load(path);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
}
const grassTopTexture = loadTexture('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/earth_loam_grass_top.png');
const grassSideTexture = loadTexture('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/earth_loam_grassy_sides.png');
const dirtTexture = loadTexture('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/earth_loam.png');
const logSideTexture = loadTexture('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/log_goldenwood_sides.png');
const logTopTexture = loadTexture('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/log_goldenwood_inner.png');
const leafTexture = loadTexture('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/leaves_goldenwood.png');

const grassMaterials = [ new THREE.MeshStandardMaterial({ map: grassSideTexture }), new THREE.MeshStandardMaterial({ map: grassSideTexture }), new THREE.MeshStandardMaterial({ map: grassTopTexture }), new THREE.MeshStandardMaterial({ map: dirtTexture }), new THREE.MeshStandardMaterial({ map: grassSideTexture }), new THREE.MeshStandardMaterial({ map: grassSideTexture }) ];
const logMaterials = [ new THREE.MeshStandardMaterial({ map: logSideTexture }), new THREE.MeshStandardMaterial({ map: logSideTexture }), new THREE.MeshStandardMaterial({ map: logTopTexture }), new THREE.MeshStandardMaterial({ map: logTopTexture }), new THREE.MeshStandardMaterial({ map: logSideTexture }), new THREE.MeshStandardMaterial({ map: logSideTexture }) ];
const leafMaterials = new THREE.MeshStandardMaterial({ map: leafTexture, transparent: true, side: THREE.DoubleSide });

// --- WORLD GENERATION ---
const noise2D = createNoise2D();
const worldSize = 32;
const blockSize = 1;
const terrainScale = 25;
const terrainHeight = 10;
const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
let worldBlocks = [];

function getTerrainHeight(x, z) {
    const noiseValue = noise2D(x / terrainScale, z / terrainScale);
    return Math.round((noiseValue + 1) / 2 * terrainHeight);
}

function createTree(x, y, z) {
    const trunkHeight = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < trunkHeight; i++) {
        const trunkBlock = new THREE.Mesh(blockGeometry, logMaterials);
        trunkBlock.position.set(x, y + i, z);
        scene.add(trunkBlock);
        worldBlocks.push(trunkBlock);
    }
    const canopyY = y + trunkHeight;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = 0; dy <= 1; dy++) {
            for (let dz = -2; dz <= 2; dz++) {
                if (dx * dx + dy * dy + dz * dz < 5.5 - dy*2) {
                    if (dx === 0 && dz === 0 && dy < 1) continue;
                    const leafBlock = new THREE.Mesh(blockGeometry, leafMaterials);
                    leafBlock.position.set(x + dx, canopyY + dy, z + dz);
                    scene.add(leafBlock);
                    worldBlocks.push(leafBlock);
                }
            }
        }
    }
}

for (let x = -worldSize / 2; x < worldSize / 2; x++) {
    for (let z = -worldSize / 2; z < worldSize / 2; z++) {
        const height = getTerrainHeight(x, z);
        for (let y = 0; y <= height; y++) {
            const block = new THREE.Mesh(blockGeometry, y === height ? grassMaterials : [new THREE.MeshStandardMaterial({map: dirtTexture})]);
            block.position.set(x, y, z);
            scene.add(block);
            worldBlocks.push(block);
        }
        if (height > 0 && Math.random() > 0.98) {
            createTree(x, height + 1, z);
        }
    }
}

// --- BLOCK INTERACTION ---
const raycaster = new THREE.Raycaster();
const highlightMesh = new THREE.Mesh( new THREE.BoxGeometry(blockSize, blockSize, blockSize), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }) );
scene.add(highlightMesh);

// --- PLAYER ---
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
const playerSpeed = 8.0;
const playerHeight = 1.8;
let onGround = false;
const clock = new THREE.Clock();
const keys = {};

// --- CONTROLS (PC & Mobile) ---
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let controls;
let playerObject;
let joystickDirection = { x: 0, y: 0 };

if (isMobile) {
    playerObject = camera;
    document.getElementById('instructions').style.display = 'none';
    const joystickContainer = document.getElementById('joystick-container');
    const joystick = nipplejs.create({ zone: joystickContainer, mode: 'static', position: { left: '50%', top: '50%' }, color: 'white', size: 150 });
    joystick.on('move', (evt, data) => {
        const angle = data.angle.radian;
        joystickDirection.x = Math.cos(angle);
        joystickDirection.y = Math.sin(angle);
    });
    joystick.on('end', () => { joystickDirection = { x: 0, y: 0 }; });

    let lastTouchX = 0, lastTouchY = 0;
    document.addEventListener('touchstart', (e) => {
        if (e.touches[0].clientX > window.innerWidth / 2) {
            lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
        }
    });
    document.addEventListener('touchmove', (e) => {
        if (e.touches[0].clientX > window.innerWidth / 2) {
            const touchX = e.touches[0].clientX; const touchY = e.touches[0].clientY;
            playerObject.rotation.y -= (touchX - lastTouchX) * 0.005;
            playerObject.rotation.x -= (touchY - lastTouchY) * 0.005;
            playerObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, playerObject.rotation.x));
            lastTouchX = touchX; lastTouchY = touchY;
        }
    });
} else {
    controls = new PointerLockControls(camera, renderer.domElement);
    playerObject = controls.getObject();
    scene.add(playerObject);
    const instructions = document.getElementById('instructions');
    instructions.addEventListener('click', () => controls.lock());
    document.addEventListener('keydown', (event) => { keys[event.code] = true; });
    document.addEventListener('keyup', (event) => { keys[event.code] = false; });
}

playerObject.position.set(0, getTerrainHeight(0, 0) + playerHeight, 0);

window.addEventListener('mousedown', (event) => {
    if (!isMobile && (controls && !controls.isLocked)) return;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(worldBlocks);
    if (intersects.length > 0 && intersects[0].distance < 6) {
        const intersection = intersects[0];
        const newBlock = new THREE.Mesh(blockGeometry, grassMaterials);
        if (event.button === 0) {
            scene.remove(intersection.object);
            worldBlocks = worldBlocks.filter(b => b !== intersection.object);
        } else if (event.button === 2) {
            newBlock.position.copy(intersection.object.position).add(intersection.face.normal);
            scene.add(newBlock);
            worldBlocks.push(newBlock);
        }
    }
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(worldBlocks);
    highlightMesh.visible = intersects.length > 0 && intersects[0].distance < 6;
    if (highlightMesh.visible) {
        highlightMesh.position.copy(intersects[0].object.position);
    }

    playerVelocity.x -= playerVelocity.x * 10.0 * delta;
    playerVelocity.z -= playerVelocity.z * 10.0 * delta;
    playerVelocity.y -= 9.8 * 2.0 * delta;

    if (isMobile) {
        playerDirection.z = -joystickDirection.y;
        playerDirection.x = -joystickDirection.x;
    } else if (controls.isLocked) {
        playerDirection.z = Number(keys['KeyW']) - Number(keys['KeyS']);
        playerDirection.x = Number(keys['KeyD']) - Number(keys['KeyA']);
    } else {
        playerDirection.set(0,0,0);
    }
    playerDirection.normalize();

    const moveSpeed = playerSpeed * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(camera.up, forward);

    if (isMobile) {
        playerObject.position.addScaledVector(forward, playerDirection.z * moveSpeed);
        playerObject.position.addScaledVector(right, playerDirection.x * moveSpeed);
    } else if (controls.isLocked) {
        controls.moveForward(playerDirection.z * moveSpeed);
        controls.moveRight(playerDirection.x * moveSpeed);
    }

    playerObject.position.y += playerVelocity.y * delta;

    const groundHeight = getTerrainHeight(Math.round(playerObject.position.x), Math.round(playerObject.position.z));
    const playerGroundY = groundHeight + playerHeight;
    if (playerObject.position.y < playerGroundY) {
        playerVelocity.y = 0;
        playerObject.position.y = playerGroundY;
        onGround = true;
    }

    if (!isMobile && onGround && keys['Space'] && controls.isLocked) {
        playerVelocity.y += 7.0;
        onGround = false;
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
