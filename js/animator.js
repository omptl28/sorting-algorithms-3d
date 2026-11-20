// animator.js — plays the recorded steps one at a time.
//
// It owns the state the renderer needs: which bar is in which slot, which bars
// are sorted, the current step and how far through it we are (t from 0 to 1).
// The renderer only asks "where is each bar and what colour is it?".

"use strict";

// Cubic Bézier: p(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
function bezier3(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
    return vec3(
        b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0],
        b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1],
        b0 * p0[2] + b1 * p1[2] + b2 * p2[2] + b3 * p3[2]
    );
}

// ease in and out so a swap starts and ends gently
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

// Plays a recorded list of sort steps over time and tracks where every bar is.
class SortAnimator {
    // Set the bar spacing and step lengths, then start with an empty array.
    constructor() {
        this.spacing = 1.0;      // distance between neighbouring bars
        // how long each step type lasts, in "speed units" (the speed slider
        // sets how many seconds one unit is)
        this.durations = { compare: 1.0, swap: 1.6, sorted: 0.35, pivot: 0.6, range: 0.3, done: 0.0 };
        this.reset([], "bubble");
    }

    // Start over with a new input array and algorithm.
    reset(values, algorithm) {
        this.algorithm = algorithm;
        this.initialValues = values.slice();
        // one bar object per value; slots[k] is the bar currently at index k
        this.slots = values.map((v, k) => ({ id: k, value: v, sorted: false, pivot: false }));
        const rec = values.length ? Sorts.record(algorithm, values) : { steps: [{ type: "done" }] };
        this.steps = rec.steps;
        this.index = 0;          // next step to start
        this.current = null;     // step being animated right now
        this.t = 0;              // progress through the current step
        this.playing = false;
        this.stepTarget = -1;    // while paused: keep animating until index reaches this
        this.comparisons = 0;
        this.swaps = 0;
        this.line = -1;          // highlighted pseudocode line
        this.range = null;       // quick sort's active [lo, hi]
        this.done = false;
        this.message = "Press Play (Space) or Step (→) to start.";
    }

    get n() { return this.slots.length; }

    // Start or resume playing (does nothing once the sort is done).
    play() {
        if (this.done) return;
        this.playing = true;
        this.stepTarget = -1;
    }

    // Pausing freezes the animation right away, even in the middle of a step.
    pause() {
        this.playing = false;
        this.stepTarget = -1;
    }

    toggle() { this.playing ? this.pause() : this.play(); }

    // Play exactly one step, then stop. If a step is frozen half-way, this
    // finishes it. Pressing again while a step is still moving queues one more.
    stepOnce() {
        if (this.done) return;
        this.playing = false;
        this.stepTarget = (this.stepTarget > this.index)
            ? Math.min(this.stepTarget + 1, this.index + 2)
            : this.index + 1;
    }

    // True while the animation should move forward this frame.
    isAdvancing() {
        return this.playing || this.index < this.stepTarget;
    }

    // How many seconds this step takes at the current speed.
    stepDuration(step, unitSeconds) {
        return (this.durations[step.type] || 0) * unitSeconds;
    }

    // Advance the animation by dt seconds. Several short steps may finish in
    // one frame when the speed is high.
    update(dt, unitSeconds) {
        let remaining = dt;
        let guard = 0;
        while (guard++ < 1000) {
            if (!this.isAdvancing()) break;
            if (!this.current) {
                if (this.index >= this.steps.length) break;
                this.beginStep(this.steps[this.index]);
            }
            const dur = this.stepDuration(this.current, unitSeconds);
            const need = (1 - this.t) * dur;
            if (dur <= 0 || remaining >= need) {
                remaining -= Math.max(0, need);
                this.finishStep(this.current);
                this.current = null;
                this.t = 0;
                this.index++;
            } else {
                this.t += remaining / dur;
                remaining = 0;
                break;
            }
        }
    }

    // Called when a step starts: update the counters, the pseudocode line and the status message.
    beginStep(step) {
        this.current = step;
        this.t = 0;
        if (step.line !== undefined) this.line = step.line;
        const a = this.slots;
        switch (step.type) {
            case "compare": {
                this.comparisons++;
                const next = this.steps[this.index + 1];
                const willSwap = next && next.type === "swap" &&
                    ((next.i === step.i && next.j === step.j) || (next.i === step.j && next.j === step.i));
                this.message = `Compare a[${step.i}] = ${a[step.i].value} with a[${step.j}] = ${a[step.j].value}` +
                    (willSwap ? "  →  out of order, swap" : "");
                break;
            }
            case "swap":
                this.swaps++;
                this.message = `Swap a[${step.i}] = ${a[step.i].value} and a[${step.j}] = ${a[step.j].value}`;
                break;
            case "sorted":
                this.message = `a[${step.i}] = ${a[step.i].value} is in its final place`;
                break;
            case "pivot":
                a[step.i].pivot = true;
                this.message = `Pivot is a[${step.i}] = ${a[step.i].value}`;
                break;
            case "range":
                this.range = [step.lo, step.hi];
                this.message = `Quick sort on a[${step.lo}..${step.hi}]`;
                break;
            case "done":
                this.message = `Sorted! ${this.comparisons} comparisons, ${this.swaps} swaps.`;
                break;
        }
    }

    // Called when a step ends: apply its effect (swap the bars, mark a bar sorted, finish).
    finishStep(step) {
        const a = this.slots;
        switch (step.type) {
            case "swap":
                [a[step.i], a[step.j]] = [a[step.j], a[step.i]];
                break;
            case "sorted":
                a[step.i].sorted = true;
                a[step.i].pivot = false;
                break;
            case "done":
                this.done = true;
                this.playing = false;
                this.range = null;
                this.line = -1;
                a.forEach(b => { b.sorted = true; b.pivot = false; });
                break;
        }
    }

    // x position of slot k, centred on the origin
    slotX(k) {
        return (k - (this.n - 1) / 2) * this.spacing;
    }

    // The two Bézier paths for the current swap, or null.
    // The bar from slot i arcs in FRONT (+z); the bar from slot j arcs BEHIND (-z),
    // so the two bars never pass through each other.
    swapPaths() {
        const s = this.current;
        if (!s || s.type !== "swap") return null;
        const xi = this.slotX(s.i), xj = this.slotX(s.j);
        const depth = Math.min(3.0, 1.1 + 0.15 * Math.abs(s.i - s.j));
        const front = [vec3(xi, 0, 0), vec3(xi, 0, depth), vec3(xj, 0, depth), vec3(xj, 0, 0)];
        const back  = [vec3(xj, 0, 0), vec3(xj, 0, -depth), vec3(xi, 0, -depth), vec3(xi, 0, 0)];
        return { front, back };
    }

    // Where a bar is drawn this frame (bottom-centre of the bar).
    barPosition(slot) {
        const s = this.current;
        if (s && s.type === "swap" && (slot === s.i || slot === s.j)) {
            const paths = this.swapPaths();
            const p = slot === s.i ? paths.front : paths.back;
            return bezier3(p[0], p[1], p[2], p[3], smoothstep(this.t));
        }
        return vec3(this.slotX(slot), 0, 0);
    }

    // Slots that are "active" this step (compared or being swapped).
    activeSlots() {
        const s = this.current;
        if (s && (s.type === "compare" || s.type === "swap")) return [s.i, s.j];
        return [];
    }
}
