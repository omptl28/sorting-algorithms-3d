// main.js — WebGL setup, the render loop and drawing.
//
// Required features and where they live:
//   1. Own vertex data ......... geometry.js (box, pyramid, floor, grid)
//   2. Model-view transforms ... drawBars() / drawMarkers(): view x translate x rotate x scale
//   3. Camera (lookAt + perspective / ortho) ... camera.js, O key toggles ortho
//   4. User interaction ........ controls.js setupUI(): buttons, sliders, keyboard, mouse drag + wheel
//   5. Animation ............... render() runs every frame with requestAnimationFrame
//   6. Lighting ................ Phong point light in the fragment shader (index.html)

"use strict";

// ---------------------------------------------------------------- settings

const COLORS = {
    background: [0.965, 0.969, 0.984, 1.0],
    unsorted:   vec4(0.30, 0.56, 0.90, 1.0),   // blue
    active:     vec4(1.00, 0.55, 0.12, 1.0),   // orange: being compared / swapped
    sorted:     vec4(0.11, 0.18, 0.44, 1.0),   // navy: in final place
    pivot:      vec4(0.62, 0.36, 0.86, 1.0),   // purple: quick sort pivot
    inactive:   vec4(0.66, 0.72, 0.80, 1.0),   // grey-blue: outside quick sort's range
    floor:      vec4(0.92, 0.93, 0.95, 1.0),
    grid:       vec4(0.76, 0.79, 0.85, 1.0),
    marker:     vec4(1.00, 0.55, 0.12, 1.0),
    path:       vec4(0.95, 0.45, 0.05, 1.0)
};

const BAR_WIDTH = 0.78;          // in units of slot spacing
const BAR_DEPTH = 0.78;
const MAX_BAR_HEIGHT = 6.0;      // value 100 -> 6 units tall
const LIGHT_WORLD_POS = vec4(-6.0, 14.0, 14.0, 1.0);   // front-left, same side as the camera

// The 7th-edition MV.js calls the scaling matrix scalem(); the 8th edition
// calls it scale(). Use whichever exists so either copy of MV.js works.
const scaleMatrix = (typeof scalem === "function") ? scalem : scale;

// matrix x point (row-major mat4 times vec4), written out so it does not
// depend on which MV.js version is loaded
function transformPoint(m, p) {
    return [0, 1, 2, 3].map(r => m[r][0] * p[0] + m[r][1] * p[1] + m[r][2] * p[2] + m[r][3] * p[3]);
}

// ---------------------------------------------------------------- globals

let gl, canvas, program;
let loc = {};                    // attribute and uniform locations
let meshes = {};                 // VAOs for each shape
let camera, animator;
let viewMatrix, projectionMatrix;
let lastTime = null;
let markerAngle = 0;             // marker pyramids spin around y
let manualClock = false;         // used only by the demo-video recorder

const state = {
    algorithm: "bubble",
    size: 12,
    speed: 4                     // 1 (slow) .. 10 (fast)
};

// ---------------------------------------------------------------- setup

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    const params = new URLSearchParams(location.search);
    gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: params.has("demo") });
    if (!gl) {
        alert("WebGL 2.0 isn't available in this browser.");
        return;
    }

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    if (program === -1) return;
    gl.useProgram(program);

    loc.aPosition      = gl.getAttribLocation(program, "aPosition");
    loc.aNormal        = gl.getAttribLocation(program, "aNormal");
    loc.uModelView     = gl.getUniformLocation(program, "uModelView");
    loc.uProjection    = gl.getUniformLocation(program, "uProjection");
    loc.uNormalMatrix  = gl.getUniformLocation(program, "uNormalMatrix");
    loc.uColor         = gl.getUniformLocation(program, "uColor");
    loc.uLightPosition = gl.getUniformLocation(program, "uLightPosition");
    loc.uLit           = gl.getUniformLocation(program, "uLit");
    loc.uShininess     = gl.getUniformLocation(program, "uShininess");

    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(...COLORS.background);

    // Static shapes are sent to the GPU once.
    const box = Geometry.box();
    meshes.box = createMesh(box.positions, box.normals, box.indices);
    const pyr = Geometry.pyramid();
    meshes.pyramid = createMesh(pyr.positions, pyr.normals);
    const floor = Geometry.floorQuad(1, 1);       // scaled to the scene size when drawn
    meshes.floor = createMesh(floor.positions, floor.normals);
    meshes.path = createMesh([], [], null, gl.DYNAMIC_DRAW); // swap paths, refilled each frame

    camera = new OrbitCamera();
    animator = new SortAnimator();

    setupUI();
    newArray();
    resizeCanvas();
    // refit whenever the canvas changes size (window resize or the layout around it)
    new ResizeObserver(resizeCanvas).observe(canvas);

    requestAnimationFrame(render);
};

// Build a vertex array object (VAO) holding a position and normal buffer,
// plus an optional index buffer.
function createMesh(positions, normals, indices, usage) {
    usage = usage || gl.STATIC_DRAW;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const pBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions.length ? flatten(positions) : new Float32Array(0), usage);
    gl.vertexAttribPointer(loc.aPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc.aPosition);

    const nBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, normals.length ? flatten(normals) : new Float32Array(0), usage);
    gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc.aNormal);

    let count = positions.length;
    if (indices) {
        const iBuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        count = indices.length;
    }
    gl.bindVertexArray(null);
    return { vao, pBuf, nBuf, count, indexed: !!indices };
}

// Replace the vertices of a dynamic mesh (used for the grid and swap paths).
function updateMesh(mesh, positions, normals) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.pBuf);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positions), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nBuf);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.DYNAMIC_DRAW);
    mesh.count = positions.length;
}

// Match the canvas's drawing size to its size on screen (sharp on Retina screens),
// then refit the camera. Called at start and whenever the canvas changes size.
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;   // nothing changed
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, canvas.width, canvas.height);
    camera.fitToWidth(sceneHalfWidth(), aspect());
}

// Width / height of the canvas, used by the projection matrix.
function aspect() {
    return canvas.width / canvas.height;
}

// Half the width of the row of bars, used to fit the camera.
function sceneHalfWidth() {
    return (state.size * animator.spacing) / 2;
}

// half-width of the floor and grid: a little wider than the row of bars
function floorHalfWidth() {
    return Math.ceil(state.size / 2) + 2;
}

// ---------------------------------------------------------------- arrays

// n random whole numbers from 5 to 99 (the bar values).
function randomValues(n) {
    const values = [];
    for (let i = 0; i < n; i++) values.push(5 + Math.floor(Math.random() * 95)); // 5..99
    return values;
}

// New random array of the current size (Shuffle button / R key / size slider).
function newArray(values) {
    values = values || randomValues(state.size);
    state.size = values.length;
    document.getElementById("size-slider").value = state.size;
    document.getElementById("size-value").textContent = state.size;
    animator.reset(values, state.algorithm);

    // the floor grid depends on how many bars there are
    const g = Geometry.grid(floorHalfWidth(), 5, 1.0);
    if (!meshes.grid) meshes.grid = createMesh(g.positions, g.normals, null, gl.DYNAMIC_DRAW);
    else updateMesh(meshes.grid, g.positions, g.normals);

    camera.fitToWidth(sceneHalfWidth(), aspect());
    updatePanel(true);
}

// Same numbers, different algorithm (or restart the current one).
function restart(algorithm) {
    if (algorithm) state.algorithm = algorithm;
    animator.reset(animator.initialValues, state.algorithm);
    updatePanel(true);
}

// ---------------------------------------------------------------- render loop

// requestAnimationFrame callback: work out the time since the last frame,
// draw one frame, then ask the browser for the next one.
function render(now) {
    now = now / 1000;
    const dt = lastTime === null ? 0 : Math.min(0.1, now - lastTime);
    lastTime = now;
    if (!manualClock) frame(dt);
    requestAnimationFrame(render);
}

// One frame: update the animation by dt seconds, then draw everything.
function frame(dt) {
    animator.update(dt, unitSeconds());
    markerAngle = (markerAngle + 90 * dt) % 360;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    viewMatrix = camera.viewMatrix();
    projectionMatrix = camera.projectionMatrix(aspect(), MAX_BAR_HEIGHT);
    gl.uniformMatrix4fv(loc.uProjection, false, flatten(projectionMatrix));

    // the light is fixed in the world, so move it into eye space each frame
    const lightEye = transformPoint(viewMatrix, LIGHT_WORLD_POS);
    gl.uniform3fv(loc.uLightPosition, flatten(vec3(lightEye[0], lightEye[1], lightEye[2])));

    drawFloor();
    drawBars();
    drawMarkers();
    drawSwapPaths();

    updatePanel(false);
}

// Seconds per animation "unit" from the speed slider (1 = slow, 10 = fast).
function unitSeconds() {
    return 0.9 * Math.pow(0.7, state.speed - 1);
}

// Send the model-view and normal matrices, colour and lighting flag.
function setObjectUniforms(modelView, color, lit, shininess) {
    gl.uniformMatrix4fv(loc.uModelView, false, flatten(modelView));
    gl.uniformMatrix3fv(loc.uNormalMatrix, false, flatten(normalMatrix(modelView, true)));
    gl.uniform4fv(loc.uColor, flatten(color));
    gl.uniform1i(loc.uLit, lit ? 1 : 0);
    gl.uniform1f(loc.uShininess, shininess || 40.0);
}

// Draw one shape from its VAO: indexed (drawElements) or not (drawArrays).
function drawMesh(mesh, mode) {
    gl.bindVertexArray(mesh.vao);
    if (mesh.indexed) gl.drawElements(mode, mesh.count, gl.UNSIGNED_SHORT, 0);
    else gl.drawArrays(mode, 0, mesh.count);
    gl.bindVertexArray(null);
}

// Floor quad (lit) scaled to the scene, then the grid lines (flat colour) on top.
function drawFloor() {
    // floor sits just below y = 0 so the grid lines stay visible
    const mv = mult(viewMatrix, mult(translate(0, -0.01, 0), scaleMatrix(floorHalfWidth(), 1, 5)));
    setObjectUniforms(mv, COLORS.floor, true, 8.0);
    drawMesh(meshes.floor, gl.TRIANGLES);

    setObjectUniforms(viewMatrix, COLORS.grid, false);
    drawMesh(meshes.grid, gl.LINES);
}

// Bar height in world units: value 100 -> MAX_BAR_HEIGHT.
function barHeight(value) {
    return (value / 100) * MAX_BAR_HEIGHT;
}

// Colour for the bar at this index: pivot > being compared > sorted > outside range > normal.
function barColor(slot) {
    const bar = animator.slots[slot];
    if (bar.pivot) return COLORS.pivot;      // pivot keeps its colour while compared
    if (animator.activeSlots().includes(slot)) return COLORS.active;
    if (bar.sorted) return COLORS.sorted;
    const r = animator.range;
    if (r && (slot < r[0] || slot > r[1])) return COLORS.inactive;
    return COLORS.unsorted;
}

// Every bar reuses the same unit box:
//   model-view = view x translate(position) x scale(width, height, depth)
function drawBars() {
    for (let k = 0; k < animator.n; k++) {
        const bar = animator.slots[k];
        const p = animator.barPosition(k);
        const model = mult(translate(p[0], p[1], p[2]),
                           scaleMatrix(BAR_WIDTH * animator.spacing, barHeight(bar.value), BAR_DEPTH));
        setObjectUniforms(mult(viewMatrix, model), barColor(k), true, 40.0);
        drawMesh(meshes.box, gl.TRIANGLES);
    }
}

// Spinning pyramids above the two bars being compared or swapped:
//   model-view = view x translate(above bar) x rotate(angle, y) x scale
function drawMarkers() {
    animator.activeSlots().forEach(k => {
        const bar = animator.slots[k];
        const p = animator.barPosition(k);
        const bob = 0.12 * Math.sin(radians(markerAngle * 4));
        const model = mult(translate(p[0], barHeight(bar.value) + 0.35 + bob, p[2]),
                      mult(rotate(markerAngle, vec3(0, 1, 0)),
                           scaleMatrix(0.45, 0.55, 0.45)));
        setObjectUniforms(mult(viewMatrix, model), COLORS.marker, true, 60.0);
        drawMesh(meshes.pyramid, gl.TRIANGLES);
    });
}

// Dashed lines showing the two Bézier paths while a swap is playing.
function drawSwapPaths() {
    const paths = animator.swapPaths();
    if (!paths) return;
    const positions = [];
    const segments = 40;
    [paths.front, paths.back].forEach(cp => {
        for (let s = 0; s < segments; s += 2) {          // every other segment -> dashes
            const a = bezier3(cp[0], cp[1], cp[2], cp[3], s / segments);
            const b = bezier3(cp[0], cp[1], cp[2], cp[3], (s + 1) / segments);
            positions.push(vec4(a[0], 0.02, a[2], 1), vec4(b[0], 0.02, b[2], 1));
        }
    });
    updateMesh(meshes.path, positions, positions.map(() => vec3(0, 1, 0)));
    setObjectUniforms(viewMatrix, COLORS.path, false);
    drawMesh(meshes.path, gl.LINES);
}

// ---------------------------------------------------------------- testing hook
// Lets automated tests (and the demo-video recorder) drive the app with a
// fixed time step instead of the real clock.
window.app = {
    get animator() { return animator; },
    get camera() { return camera; },
    state,
    setManualClock(on) { manualClock = on; },
    tick(dt) { frame(dt); },
    newArray, restart, setSpeed, toggleOrtho, togglePlay
};
