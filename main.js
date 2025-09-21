import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

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

// --- WORLD ---
const loader = new THREE.TextureLoader();
const grassTopTexture = loader.load('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/earth_loam_grass_top.png');
const grassSideTexture = loader.load('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/earth_loam_grassy_sides.png');
const dirtTexture = loader.load('https://raw.githubusercontent.com/malcolmriley/unused-textures/master/blocks/earth_loam.png');

[grassTopTexture, grassSideTexture, dirtTexture].forEach(t => {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
});

const blockMaterials = [
    new THREE.MeshStandardMaterial({ map: grassSideTexture }), // right
    new THREE.MeshStandardMaterial({ map: grassSideTexture }), // left
    new THREE.MeshStandardMaterial({ map: grassTopTexture }),  // top
    new THREE.MeshStandardMaterial({ map: dirtTexture }),      // bottom
    new THREE.MeshStandardMaterial({ map: grassSideTexture }), // front
    new THREE.MeshStandardMaterial({ map: grassSideTexture }), // back
];

const worldSize = 20;
const blockSize = 1;
const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
let worldBlocks = []; // Use let since we will modify it
for (let x = -worldSize / 2; x < worldSize / 2; x++) {
    for (let z = -worldSize / 2; z < worldSize / 2; z++) {
        const block = new THREE.Mesh(blockGeometry, blockMaterials);
        block.position.set(x * blockSize, -1, z * blockSize);
        scene.add(block);
        worldBlocks.push(block);
    }
}

// --- BLOCK INTERACTION ---
const raycaster = new THREE.Raycaster();
const highlightMesh = new THREE.Mesh(
    new THREE.BoxGeometry(blockSize, blockSize, blockSize),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
);
scene.add(highlightMesh);

// --- PLAYER CONTROLS ---
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
const playerSpeed = 8.0;
const playerHeight = 1.8;
let onGround = true;
const clock = new THREE.Clock();
const keys = {};
let joystickDirection = { x: 0, y: 0 };

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let controls; // Declare controls here to be accessible in the animate loop

if (isMobile) {
    // Mobile setup remains the same...
    document.getElementById('instructions').style.display = 'none';
    const joystickContainer = document.getElementById('joystick-container');
    const joystick = nipplejs.create({ zone: joystickContainer, mode: 'static', position: { left: '50%', top: '50%' }, color: 'white', size: 150 });
    joystick.on('move', (evt, data) => {
        const angle = data.angle.radian;
        joystickDirection.x = Math.cos(angle);
        joystickDirection.y = Math.sin(angle);
    });
    joystick.on('end', () => { joystickDirection = { x: 0, y: 0 }; });
    // ... touch look controls setup
} else {
    controls = new PointerLockControls(camera, renderer.domElement);
    const instructions = document.getElementById('instructions');
    instructions.addEventListener('click', () => controls.lock());
    controls.addEventListener('lock', () => instructions.style.display = 'none');
    controls.addEventListener('unlock', () => instructions.style.display = 'flex');
    scene.add(controls.getObject());
    document.addEventListener('keydown', (event) => { keys[event.code] = true; });
    document.addEventListener('keyup', (event) => { keys[event.code] = false; });
}

camera.position.y = playerHeight;

// --- MOUSE/TOUCH INTERACTION LISTENERS ---
window.addEventListener('mousedown', (event) => {
    if (!isMobile && !controls.isLocked) return;

    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(worldBlocks);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        if (event.button === 0) { // Left click - break block
            if (intersection.distance < 6) {
                const objectToRemove = intersection.object;
                scene.remove(objectToRemove);
                worldBlocks = worldBlocks.filter(block => block !== objectToRemove);
                // In a real game, you'd dispose geometry/material if they are unique
            }
        } else if (event.button === 2) { // Right click - place block
            const newBlockPos = intersection.object.position.clone().add(intersection.face.normal);
            const newBlock = new THREE.Mesh(blockGeometry, blockMaterials);
            newBlock.position.copy(newBlockPos);
            scene.add(newBlock);
            worldBlocks.push(newBlock);
        }
    }
});

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Raycasting for block highlight
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(worldBlocks);
    if (intersects.length > 0 && intersects[0].distance < 6) {
        highlightMesh.position.copy(intersects[0].object.position);
        highlightMesh.visible = true;
    } else {
        highlightMesh.visible = false;
    }

    // Player movement calculation... (same as before)
    playerVelocity.x -= playerVelocity.x * 10.0 * delta;
    playerVelocity.z -= playerVelocity.z * 10.0 * delta;
    playerVelocity.y -= 9.8 * 2.0 * delta;

    if (isMobile) {
        playerDirection.z = -joystickDirection.y;
        playerDirection.x = -joystickDirection.x;
    } else {
        playerDirection.z = Number(keys['KeyW']) - Number(keys['KeyS']);
        playerDirection.x = Number(keys['KeyD']) - Number(keys['KeyA']);
    }
    playerDirection.normalize();

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward);
    right.crossVectors(camera.up, forward);

    if (playerDirection.z !== 0) {
        camera.position.addScaledVector(forward, playerDirection.z * playerSpeed * delta);
    }
    if (playerDirection.x !== 0) {
        camera.position.addScaledVector(right, playerDirection.x * playerSpeed * delta);
    }

    camera.position.y += playerVelocity.y * delta;

    if (camera.position.y < playerHeight) {
        playerVelocity.y = 0;
        camera.position.y = playerHeight;
        onGround = true;
    }

    if (!isMobile && onGround && keys['Space']) {
        playerVelocity.y += 6.0;
        onGround = false;
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
