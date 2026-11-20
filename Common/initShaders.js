// initShaders.js — compiles and links a shader program from two <script> tags.
// Same call signature as the textbook helper: initShaders(gl, vertexId, fragmentId)

"use strict";

// Compile both shaders, link them into one program and return it (or -1 on error).
// Errors from the GLSL compiler are shown in an alert and in the console.
function initShaders(gl, vertexShaderId, fragmentShaderId) {
    // Compile the GLSL source in <script id="id"> as a vertex or fragment shader.
    function compile(id, type) {
        const elem = document.getElementById(id);
        if (!elem) {
            alert("Unable to find shader script: " + id);
            return null;
        }
        const shader = gl.createShader(type);
        gl.shaderSource(shader, elem.text.trim());
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const msg = "Shader '" + id + "' failed to compile:\n" + gl.getShaderInfoLog(shader);
            console.error(msg);
            alert(msg);
            return null;
        }
        return shader;
    }

    const vertShader = compile(vertexShaderId, gl.VERTEX_SHADER);
    const fragShader = compile(fragmentShaderId, gl.FRAGMENT_SHADER);
    if (!vertShader || !fragShader) return -1;

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const msg = "Shader program failed to link:\n" + gl.getProgramInfoLog(program);
        console.error(msg);
        alert(msg);
        return -1;
    }
    return program;
}
