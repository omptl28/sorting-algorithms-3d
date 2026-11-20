// camera.js — orbit camera built on lookAt(), with perspective() or ortho().
//
// The camera circles a target point (the middle of the row of bars).
// We store distance, azimuth (angle around the y axis) and elevation
// (angle above the floor) and turn them into an eye position every frame.

"use strict";

// A camera that circles the bars; turns angles + distance into a lookAt() view.
class OrbitCamera {
    // Starting angles, distance and projection settings.
    constructor() {
        this.target = vec3(0, 2.2, 0);
        this.defaultAzimuth = -22;   // degrees; 0 = straight in front
        this.defaultElevation = 18;  // degrees above the floor
        this.azimuth = this.defaultAzimuth;
        this.elevation = this.defaultElevation;
        this.distance = 18;
        this.minDistance = 5;
        this.maxDistance = 60;
        this.useOrtho = false;       // toggled with the O key
        this.fovy = 45;
        this.near = 0.1;
        this.far = 100;
        this.sceneHalfWidth = 8;     // updated when the array size changes
        this.fitDistance = 18;       // distance that fits every bar (set by fitToWidth)
    }

    // Move the camera back far enough that every bar fits on screen.
    fitToWidth(halfWidth, aspect) {
        this.sceneHalfWidth = halfWidth;
        const halfFovX = Math.atan(Math.tan(radians(this.fovy / 2)) * aspect);
        const needed = 1.15 * (halfWidth + 2.5) / Math.tan(halfFovX);
        this.distance = Math.min(this.maxDistance, Math.max(12, needed));
        this.fitDistance = this.distance;   // remembered so ortho can zoom by the same ratio
    }

    // Back to the starting angles, with the distance refitted to the bars (C key).
    reset(aspect) {
        this.azimuth = this.defaultAzimuth;
        this.elevation = this.defaultElevation;
        this.fitToWidth(this.sceneHalfWidth, aspect);
    }

    // Rotate around the bars by mouse drag; elevation is clamped so we never flip over.
    orbit(dAzimuth, dElevation) {
        this.azimuth += dAzimuth;
        this.elevation = Math.max(-5, Math.min(85, this.elevation + dElevation));
    }

    // Move closer (factor < 1) or farther (factor > 1), within limits (mouse wheel).
    zoom(factor) {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance * factor));
    }

    // Camera position from spherical coordinates (distance, azimuth, elevation) around the target.
    eye() {
        const az = radians(this.azimuth);
        const el = radians(this.elevation);
        return vec3(
            this.target[0] + this.distance * Math.cos(el) * Math.sin(az),
            this.target[1] + this.distance * Math.sin(el),
            this.target[2] + this.distance * Math.cos(el) * Math.cos(az)
        );
    }

    // View matrix. In ortho mode the camera looks straight at the front of
    // the bars, so the scene reads like a normal 2D bar chart.
    viewMatrix() {
        if (this.useOrtho) {
            const t = this.target;
            return lookAt(vec3(t[0], t[1], t[2] + 40), t, vec3(0, 1, 0));
        }
        return lookAt(this.eye(), this.target, vec3(0, 1, 0));
    }

    // Projection matrix: perspective() normally, ortho() in the front view (O key).
    projectionMatrix(aspect, maxBarHeight) {
        if (this.useOrtho) {
            // fit the whole row (width) and the tallest bar (height)
            const halfW = this.sceneHalfWidth + 1.0;
            // the mouse wheel zooms the ortho view by the same ratio as the 3D view
            const zoom = this.distance / this.fitDistance;
            const halfH = zoom * Math.max(halfW / aspect, (maxBarHeight + 1.5) / 2 + 0.5);
            const cy = (maxBarHeight / 2) - this.target[1];  // keep bars centred vertically
            return ortho(-halfH * aspect, halfH * aspect, cy - halfH, cy + halfH, 0.1, 100);
        }
        return perspective(this.fovy, aspect, this.near, this.far);
    }
}
