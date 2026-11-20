// geometry.js — all 3D shapes are generated here from our own vertex data.
// Nothing is loaded from a model file.
//
// Each generator returns plain JS arrays:
//   positions : list of vec4 (x, y, z, 1)
//   normals   : list of vec3, one per vertex (used by Phong lighting)
//   indices   : (optional) triangle indices for gl.drawElements

"use strict";

const Geometry = (function () {

    // A unit box that sits on the floor: x and z from -0.5 to 0.5, y from 0 to 1.
    // Putting the base at y = 0 means scale(1, h, 1) grows the bar upward only.
    // 6 faces x 4 corners = 24 vertices, so every face can have its own normal.
    // 6 faces x 2 triangles x 3 corners = 36 indices.
    function box() {
        const faces = [
            // normal,      four corners (counter-clockwise when seen from outside)
            { n: [ 0,  0,  1], c: [[-0.5, 0,  0.5], [ 0.5, 0,  0.5], [ 0.5, 1,  0.5], [-0.5, 1,  0.5]] }, // front
            { n: [ 0,  0, -1], c: [[ 0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [ 0.5, 1, -0.5]] }, // back
            { n: [ 1,  0,  0], c: [[ 0.5, 0,  0.5], [ 0.5, 0, -0.5], [ 0.5, 1, -0.5], [ 0.5, 1,  0.5]] }, // right
            { n: [-1,  0,  0], c: [[-0.5, 0, -0.5], [-0.5, 0,  0.5], [-0.5, 1,  0.5], [-0.5, 1, -0.5]] }, // left
            { n: [ 0,  1,  0], c: [[-0.5, 1,  0.5], [ 0.5, 1,  0.5], [ 0.5, 1, -0.5], [-0.5, 1, -0.5]] }, // top
            { n: [ 0, -1,  0], c: [[-0.5, 0, -0.5], [ 0.5, 0, -0.5], [ 0.5, 0,  0.5], [-0.5, 0,  0.5]] }  // bottom
        ];

        const positions = [];
        const normals = [];
        const indices = [];

        faces.forEach((face, f) => {
            face.c.forEach(p => {
                positions.push(vec4(p[0], p[1], p[2], 1.0));
                normals.push(vec3(face.n));
            });
            const base = f * 4;
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        });

        return { positions, normals, indices };
    }

    // A square pyramid pointing DOWN (apex at the origin, base at y = 1).
    // It floats above a bar to mark "this bar is being compared".
    // Flat shading: each triangle gets its own face normal, so no indices.
    function pyramid() {
        const apex = [0, 0, 0];
        const b = [[-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5], [-0.5, 1, -0.5]];

        const positions = [];
        const normals = [];

        // Add one triangle; its normal is the cross product of two edges (flat shading).
        function tri(p0, p1, p2) {
            const e1 = subtract(vec3(p1), vec3(p0));
            const e2 = subtract(vec3(p2), vec3(p0));
            const n = normalize(cross(e1, e2));
            [p0, p1, p2].forEach(p => {
                positions.push(vec4(p[0], p[1], p[2], 1.0));
                normals.push(n);
            });
        }

        // four sides (wound so normals point outward)
        for (let i = 0; i < 4; i++) {
            tri(apex, b[(i + 1) % 4], b[i]);
        }
        // square base on top (normal +y)
        tri(b[0], b[1], b[2]);
        tri(b[0], b[2], b[3]);

        return { positions, normals };
    }

    // One flat quad for the floor (y = 0), lit like everything else.
    function floorQuad(halfWidth, halfDepth) {
        const w = halfWidth, d = halfDepth;
        const positions = [
            vec4(-w, 0,  d, 1), vec4(w, 0,  d, 1), vec4(w, 0, -d, 1),
            vec4(-w, 0,  d, 1), vec4(w, 0, -d, 1), vec4(-w, 0, -d, 1)
        ];
        const normals = positions.map(() => vec3(0, 1, 0));
        return { positions, normals };
    }

    // Grid lines on the floor, drawn with gl.LINES.
    function grid(halfWidth, halfDepth, spacing) {
        const positions = [];
        const y = 0.002; // a hair above the floor to avoid z-fighting
        for (let x = -halfWidth; x <= halfWidth + 1e-6; x += spacing) {
            positions.push(vec4(x, y, -halfDepth, 1), vec4(x, y, halfDepth, 1));
        }
        for (let z = -halfDepth; z <= halfDepth + 1e-6; z += spacing) {
            positions.push(vec4(-halfWidth, y, z, 1), vec4(halfWidth, y, z, 1));
        }
        const normals = positions.map(() => vec3(0, 1, 0));
        return { positions, normals };
    }

    return { box, pyramid, floorQuad, grid };
})();
