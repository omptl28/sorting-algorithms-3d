// panel.js — the side panel and labels around the 3D view.
//
// Shows the chosen algorithm's pseudocode with the running line highlighted,
// the comparison / swap / step counters, the status message, the Play button
// label and the view-mode badge. main.js calls updatePanel() once per frame;
// setText() only touches the page when a value actually changes.

"use strict";

// ---------------------------------------------------------------- side panel

let lastLine = null, lastAlgorithm = null;
const shownText = {};   // last text written to each element, so we only touch the DOM on change

// Write text into an element only when it changed (avoids redrawing the page every frame).
function setText(id, text) {
    text = String(text);
    if (shownText[id] === text) return;
    shownText[id] = text;
    document.getElementById(id).textContent = text;
}

// Label for the Play button: Pause while playing, Replay when finished, else Play.
function playLabel() {
    if (animator.playing) return "Pause";
    return animator.done ? "Replay" : "Play";
}

// Refresh counters, status, labels and the pseudocode highlight. force = rebuild everything
// (after a new array or algorithm); otherwise only what changed is updated.
function updatePanel(force) {
    const total = animator.steps.length;
    setText("stat-comparisons", animator.comparisons);
    setText("stat-swaps", animator.swaps);
    setText("stat-step", `${Math.min(animator.index + (animator.current ? 1 : 0), total)} / ${total}`);
    setText("status", animator.message);
    setText("btn-play", playLabel());
    setText("view-mode", camera.useOrtho ? "Front view (ortho)" : "3D view (perspective)");

    if (force || lastAlgorithm !== state.algorithm) {
        lastAlgorithm = state.algorithm;
        document.getElementById("algo-name").textContent = Sorts.names[state.algorithm];
        const list = document.getElementById("pseudocode");
        list.innerHTML = "";
        Sorts.pseudocode[state.algorithm].forEach(text => {
            const li = document.createElement("li");
            li.textContent = text;
            list.appendChild(li);
        });
        document.querySelectorAll("[data-algo]").forEach(b =>
            b.classList.toggle("selected", b.dataset.algo === state.algorithm));
        lastLine = null;
    }
    if (force || lastLine !== animator.line) {
        lastLine = animator.line;
        document.querySelectorAll("#pseudocode li").forEach((li, i) =>
            li.classList.toggle("active", i === animator.line));
    }
}
