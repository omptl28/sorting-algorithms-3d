// controls.js — user interaction (required feature 4).
//
// Buttons, sliders, keyboard shortcuts and the mouse:
//   drag = orbit the camera, wheel = zoom, Space = play/pause, → = step,
//   R = shuffle, 1–4 = algorithm, O = front (ortho) view, C = reset camera,
//   +/− = speed. setupUI() is called once from init() in main.js.

"use strict";

// ---------------------------------------------------------------- interaction

// Connect every button, slider, key and mouse action to the app. Called once from init().
function setupUI() {
    // algorithm buttons
    document.querySelectorAll("[data-algo]").forEach(btn => {
        btn.addEventListener("click", () => { restart(btn.dataset.algo); btn.blur(); });
    });

    document.getElementById("btn-play").addEventListener("click", e => { togglePlay(); e.target.blur(); });
    document.getElementById("btn-step").addEventListener("click", e => { animator.stepOnce(); e.target.blur(); });
    document.getElementById("btn-shuffle").addEventListener("click", e => { newArray(); e.target.blur(); });
    document.getElementById("btn-restart").addEventListener("click", e => { restart(); e.target.blur(); });
    document.getElementById("btn-view").addEventListener("click", e => { toggleOrtho(); e.target.blur(); });
    document.getElementById("btn-camera").addEventListener("click", e => { camera.reset(aspect()); e.target.blur(); });

    const size = document.getElementById("size-slider");
    size.value = state.size;
    document.getElementById("size-value").textContent = state.size;
    size.addEventListener("input", () => {
        state.size = parseInt(size.value, 10);
        document.getElementById("size-value").textContent = state.size;
        newArray();
    });
    size.addEventListener("change", () => size.blur());

    const speed = document.getElementById("speed-slider");
    speed.value = state.speed;
    document.getElementById("speed-value").textContent = state.speed;
    speed.addEventListener("input", () => {
        state.speed = parseInt(speed.value, 10);
        document.getElementById("speed-value").textContent = state.speed;
    });
    speed.addEventListener("change", () => speed.blur());

    // keyboard shortcuts
    window.addEventListener("keydown", e => {
        // leave browser shortcuts (Cmd/Ctrl+R, Cmd/Ctrl +/-) alone
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const algos = { "1": "bubble", "2": "insertion", "3": "selection", "4": "quick" };
        // holding a key down should not toggle play/pause over and over
        if (e.repeat && e.key !== "ArrowRight" && e.key !== "+" && e.key !== "=" && e.key !== "-") {
            if (e.code === "Space") e.preventDefault();
            return;
        }
        let handled = true;
        if (e.code === "Space") togglePlay();
        else if (e.key === "ArrowRight") animator.stepOnce();
        else if (e.key === "r" || e.key === "R") newArray();
        else if (e.key === "o" || e.key === "O") toggleOrtho();
        else if (e.key === "c" || e.key === "C") camera.reset(aspect());
        else if (algos[e.key]) restart(algos[e.key]);
        else if (e.key === "+" || e.key === "=") setSpeed(state.speed + 1);
        else if (e.key === "-" || e.key === "_") setSpeed(state.speed - 1);
        else handled = false;
        if (handled) e.preventDefault();
    });

    // mouse drag orbits the camera, wheel zooms
    let dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener("pointerdown", e => {
        if (e.button !== 0) return;       // left button / touch only
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
        if (!dragging) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (camera.useOrtho) return;      // front view is fixed
        camera.orbit(-dx * 0.35, dy * 0.25);
    });
    const endDrag = e => {
        dragging = false;
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", e => {
        e.preventDefault();
        camera.zoom(Math.exp(e.deltaY * 0.001));
    }, { passive: false });
}

// Set the animation speed (1-10) and keep the slider and its label in sync (+/- keys).
function setSpeed(v) {
    state.speed = Math.max(1, Math.min(10, v));
    document.getElementById("speed-slider").value = state.speed;
    document.getElementById("speed-value").textContent = state.speed;
}

// Switch between the 3D perspective view and the flat front (ortho) view (O key).
function toggleOrtho() {
    camera.useOrtho = !camera.useOrtho;
    // dragging does nothing in the front view, so don't show the grab hand there
    canvas.classList.toggle("ortho", camera.useOrtho);
}

// Play / Pause. After a sort has finished, Play (shown as "Replay") starts the
// same array again from the beginning.
function togglePlay() {
    if (animator.done) {
        restart();
        animator.play();
    } else {
        animator.toggle();
    }
}
