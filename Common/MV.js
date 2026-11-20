//////////////////////////////////////////////////////////////////////////////
//
//  MV.js — vector and matrix helpers
//
//  Uses the same function names and conventions as the textbook's MV.js
//  (Angel & Shreiner, "Interactive Computer Graphics"): matrices are stored
//  as arrays of ROWS and flatten() transposes them to the column-major
//  order that gl.uniformMatrix*fv expects.
//
//  If your course copy of MV.js is preferred, it can replace this file:
//  the app only calls functions that exist in both.
//
//////////////////////////////////////////////////////////////////////////////

"use strict";

// Degrees to radians (Math.sin/cos work in radians).
function radians(degrees) {
    return degrees * Math.PI / 180.0;
}

// ---------------------------------------------------------------- vectors

// Internal helper: build an n-component vector from numbers or another vector.
// Missing components are 0, except w of a vec4, which defaults to 1 (a point).
function _vec(n, args, typeName) {
    const out = [];
    // allow vec3(otherVec) or vec3(x, y, z)
    let src = (args.length === 1 && Array.isArray(args[0])) ? args[0] : Array.from(args);
    for (let i = 0; i < n; i++) {
        out.push(i < src.length ? src[i] : (n === 4 && i === 3 ? 1.0 : 0.0));
    }
    out.type = typeName;
    return out;
}

// vec2/vec3/vec4: create vectors, e.g. vec3(1, 2, 3) or vec4(someVec3).
function vec2() { return _vec(2, arguments, "vec2"); }
function vec3() { return _vec(3, arguments, "vec3"); }
function vec4() { return _vec(4, arguments, "vec4"); }

// Component-wise u + v (works for vectors and matrices).
function add(u, v) {
    if (u.matrix && v.matrix) {
        return u.map((row, i) => row.map((x, j) => x + v[i][j]));
    }
    const r = u.map((x, i) => x + v[i]);
    r.type = u.type;
    return r;
}

// Component-wise u - v (works for vectors and matrices).
function subtract(u, v) {
    if (u.matrix && v.matrix) {
        return u.map((row, i) => row.map((x, j) => x - v[i][j]));
    }
    const r = u.map((x, i) => x - v[i]);
    r.type = u.type;
    return r;
}

// Dot product: sum of u[i] * v[i]. Used for lighting angles and lookAt.
function dot(u, v) {
    let s = 0;
    for (let i = 0; i < u.length; i++) s += u[i] * v[i];
    return s;
}

// Cross product of two vec3s: a vector perpendicular to both (used for normals).
function cross(u, v) {
    return vec3(
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0]
    );
}

// Length (magnitude) of a vector.
function length(u) {
    return Math.sqrt(dot(u, u));
}

// Scale a vector to length 1. Set excludeLastComponent to leave w of a vec4 alone.
function normalize(u, excludeLastComponent) {
    const n = excludeLastComponent ? u.length - 1 : u.length;
    let len = 0;
    for (let i = 0; i < n; i++) len += u[i] * u[i];
    len = Math.sqrt(len);
    if (len === 0) return u;
    const r = u.slice();
    for (let i = 0; i < n; i++) r[i] = u[i] / len;
    r.type = u.type;
    return r;
}

// Flip the sign of every component.
function negate(u) {
    const r = u.map(x => -x);
    r.type = u.type;
    return r;
}

// Linear interpolation: (1 - s) * u + s * v.
function mix(u, v, s) {
    const r = u.map((x, i) => (1.0 - s) * x + s * v[i]);
    r.type = u.type;
    return r;
}

// ---------------------------------------------------------------- matrices

// Internal helper: build an n x n matrix (array of rows).
// No arguments = identity, one number d = d on the diagonal, otherwise the values row by row.
function _mat(n, args, typeName) {
    const m = [];
    if (args.length === 0 || (args.length === 1 && typeof args[0] === "number")) {
        const d = args.length === 1 ? args[0] : 1.0;
        for (let i = 0; i < n; i++) {
            m.push([]);
            for (let j = 0; j < n; j++) m[i].push(i === j ? d : 0.0);
        }
    } else {
        // n*n numbers in row-major order, or n row arrays
        const flat = (args.length === n) ? [].concat(...Array.from(args)) : Array.from(args);
        for (let i = 0; i < n; i++) m.push(flat.slice(i * n, i * n + n));
    }
    m.matrix = true;
    m.type = typeName;
    return m;
}

// mat2/mat3/mat4: create matrices; mat4() is the 4x4 identity.
function mat2() { return _mat(2, arguments, "mat2"); }
function mat3() { return _mat(3, arguments, "mat3"); }
function mat4() { return _mat(4, arguments, "mat4"); }

// Internal helper: mark an array of rows as a matrix of the same type as src.
function _copyType(src, m) {
    m.matrix = true;
    m.type = src.type || ("mat" + src.length);
    return m;
}

// Multiply: matrix x matrix, matrix x vector, number x vector, or vector x vector
// (component-wise). Order matters for matrices: mult(A, B) applies B first, then A.
function mult(u, v) {
    if (u.matrix && v.matrix) {
        const n = u.length;
        const r = [];
        for (let i = 0; i < n; i++) {
            r.push([]);
            for (let j = 0; j < n; j++) {
                let s = 0;
                for (let k = 0; k < n; k++) s += u[i][k] * v[k][j];
                r[i].push(s);
            }
        }
        return _copyType(u, r);
    }
    if (u.matrix && !v.matrix) {
        // matrix * vector
        const r = u.map(row => dot(row, v));
        r.type = v.type;
        return r;
    }
    if (typeof u === "number") {
        const r = v.map(x => u * x);
        r.type = v.type;
        return r;
    }
    // component-wise vector product
    const r = u.map((x, i) => x * v[i]);
    r.type = u.type;
    return r;
}

// Swap rows and columns.
function transpose(m) {
    const n = m.length;
    const r = [];
    for (let i = 0; i < n; i++) {
        r.push([]);
        for (let j = 0; j < n; j++) r[i].push(m[j][i]);
    }
    return _copyType(m, r);
}

// Translation matrix: moves points by (x, y, z). Also accepts translate([x, y, z]).
function translate(x, y, z) {
    if (Array.isArray(x)) { z = x[2]; y = x[1]; x = x[0]; }
    const r = mat4();
    r[0][3] = x;
    r[1][3] = y;
    r[2][3] = z;
    return r;
}

// scale(x, y, z) builds a scaling matrix (8th-edition style);
// scalem is the 7th-edition name for the same thing.
function scale(x, y, z) {
    if (Array.isArray(x)) { z = x[2]; y = x[1]; x = x[0]; }
    const r = mat4();
    r[0][0] = x;
    r[1][1] = y;
    r[2][2] = z;
    return r;
}

// 7th-edition name for the scaling matrix (same as scale above).
function scalem(x, y, z) {
    return scale(x, y, z);
}

// Rotation matrix: turn by `angle` degrees around `axis` (Rodrigues' formula).
function rotate(angle, axis) {
    const v = normalize(vec3(axis));
    const x = v[0], y = v[1], z = v[2];
    const c = Math.cos(radians(angle));
    const omc = 1.0 - c;
    const s = Math.sin(radians(angle));
    return mat4(
        x * x * omc + c,     x * y * omc - z * s, x * z * omc + y * s, 0.0,
        x * y * omc + z * s, y * y * omc + c,     y * z * omc - x * s, 0.0,
        x * z * omc - y * s, y * z * omc + x * s, z * z * omc + c,     0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

// Rotations around the x, y and z axes, in degrees.
function rotateX(theta) { return rotate(theta, [1, 0, 0]); }
function rotateY(theta) { return rotate(theta, [0, 1, 0]); }
function rotateZ(theta) { return rotate(theta, [0, 0, 1]); }

// ---------------------------------------------------------------- viewing

// View matrix for a camera at `eye` looking at `at`, with `up` pointing up.
// Builds the camera's right (n), up (u) and backward (-v) axes, then moves the eye to the origin.
function lookAt(eye, at, up) {
    const v = normalize(subtract(at, eye));   // view direction
    const n = normalize(cross(v, up));         // right
    const u = normalize(cross(n, v));          // true up
    const negV = negate(v);
    return mat4(
        n[0], n[1], n[2], -dot(n, eye),
        u[0], u[1], u[2], -dot(u, eye),
        negV[0], negV[1], negV[2], -dot(negV, eye),
        0.0, 0.0, 0.0, 1.0
    );
}

// Orthographic projection: maps the box [left,right] x [bottom,top] x [-near,-far]
// to clip space. No perspective shrink, so it looks like a flat drawing.
function ortho(left, right, bottom, top, near, far) {
    const w = right - left;
    const h = top - bottom;
    const d = far - near;
    const r = mat4();
    r[0][0] = 2.0 / w;
    r[1][1] = 2.0 / h;
    r[2][2] = -2.0 / d;
    r[0][3] = -(left + right) / w;
    r[1][3] = -(top + bottom) / h;
    r[2][3] = -(near + far) / d;
    return r;
}

// Perspective projection: fovy = vertical field of view in degrees,
// aspect = width / height. Far objects look smaller.
function perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(radians(fovy) / 2);
    const d = far - near;
    const r = mat4();
    r[0][0] = f / aspect;
    r[1][1] = f;
    r[2][2] = -(near + far) / d;
    r[2][3] = -2 * near * far / d;
    r[3][2] = -1;
    r[3][3] = 0.0;
    return r;
}

// ---------------------------------------------------------------- inverse / normal matrix

// Determinant of a 3x3 matrix.
function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
         - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
         + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

// Inverse of a 3x3 matrix (adjugate divided by the determinant).
function inverse3(m) {
    const d = det3(m);
    const r = mat3();
    r[0][0] =  (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / d;
    r[0][1] = -(m[0][1] * m[2][2] - m[0][2] * m[2][1]) / d;
    r[0][2] =  (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / d;
    r[1][0] = -(m[1][0] * m[2][2] - m[1][2] * m[2][0]) / d;
    r[1][1] =  (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / d;
    r[1][2] = -(m[0][0] * m[1][2] - m[0][2] * m[1][0]) / d;
    r[2][0] =  (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / d;
    r[2][1] = -(m[0][0] * m[2][1] - m[0][1] * m[2][0]) / d;
    r[2][2] =  (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / d;
    return r;
}

// General 4x4 inverse (Gauss-Jordan elimination)
function inverse4(m) {
    const a = m.map(row => row.slice());
    const r = mat4();
    for (let col = 0; col < 4; col++) {
        let pivot = col;
        for (let row = col + 1; row < 4; row++) {
            if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
        }
        [a[col], a[pivot]] = [a[pivot], a[col]];
        [r[col], r[pivot]] = [r[pivot], r[col]];
        const p = a[col][col];
        for (let j = 0; j < 4; j++) { a[col][j] /= p; r[col][j] /= p; }
        for (let row = 0; row < 4; row++) {
            if (row === col) continue;
            const f = a[row][col];
            for (let j = 0; j < 4; j++) {
                a[row][j] -= f * a[col][j];
                r[row][j] -= f * r[col][j];
            }
        }
    }
    r.matrix = true;
    r.type = "mat4";
    return r;
}

// Inverse of a 3x3 or 4x4 matrix.
function inverse(m) {
    return m.length === 3 ? inverse3(m) : inverse4(m);
}

// Inverse-transpose of the model-view matrix, used to transform normals.
// With flag === true the upper-left 3x3 is returned as a mat3.
function normalMatrix(m, flag) {
    const a = transpose(inverse(m));
    if (flag !== true) return a;
    const b = mat3();
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) b[i][j] = a[i][j];
    return b;
}

// ---------------------------------------------------------------- flatten

// Converts a vector, a list of vectors or a matrix into a Float32Array.
// Matrices are transposed so they arrive in column-major order.
function flatten(v) {
    if (v.matrix === true) v = transpose(v);

    if (typeof v[0] === "number") return new Float32Array(v);

    const n = v.length;
    const elemLen = v[0].length;
    const out = new Float32Array(n * elemLen);
    let idx = 0;
    for (let i = 0; i < n; i++)
        for (let j = 0; j < elemLen; j++) out[idx++] = v[i][j];
    return out;
}

const sizeof = {
    vec2: new Float32Array(2).byteLength,
    vec3: new Float32Array(3).byteLength,
    vec4: new Float32Array(4).byteLength,
    mat2: new Float32Array(4).byteLength,
    mat3: new Float32Array(9).byteLength,
    mat4: new Float32Array(16).byteLength
};
