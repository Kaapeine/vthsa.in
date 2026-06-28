import type { CustomLayerInterface, Map as MlMap } from 'maplibre-gl';
import type { RenderSource } from './types';

const PIN_VS = `
attribute vec2 a_pos;
attribute vec2 a_local;
attribute vec3 a_color;
uniform vec2 u_res;
uniform float u_dpr;
varying vec2 v_local;
varying vec3 v_color;
void main() {
  v_local = a_local;
  v_color = a_color;
  vec2 d = a_pos * u_dpr;
  vec2 clip = vec2(d.x / u_res.x * 2.0 - 1.0, 1.0 - d.y / u_res.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const PIN_FS = `
precision mediump float;
varying vec2 v_local;
varying vec3 v_color;
void main() {
  float dist = length(v_local);
  float alpha = 1.0 - smoothstep(0.85, 1.0, dist);
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(v_color, alpha);
}`;

const LINE_VS = `
attribute vec2 a_pos;
attribute vec3 a_color;
uniform vec2 u_res;
uniform float u_dpr;
varying vec3 v_color;
void main() {
  v_color = a_color;
  vec2 d = a_pos * u_dpr;
  vec2 clip = vec2(d.x / u_res.x * 2.0 - 1.0, 1.0 - d.y / u_res.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const LINE_FS = `
precision mediump float;
varying vec3 v_color;
void main() {
  gl_FragColor = vec4(v_color, 0.7);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

function program(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('Program link failed: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

export function createDeclutterLayer(
  id: string,
  source: RenderSource,
): CustomLayerInterface {
  let pinProg!: WebGLProgram;
  let lineProg!: WebGLProgram;
  let pinBuf!: WebGLBuffer;
  let lineBuf!: WebGLBuffer;

  let pinPos = 0, pinLocal = 0, pinColor = 0;
  let pinRes!: WebGLUniformLocation, pinDpr!: WebGLUniformLocation;
  let linePos = 0, lineColor = 0;
  let lineRes!: WebGLUniformLocation, lineDpr!: WebGLUniformLocation;

  const F = 4;

  return {
    id,
    type: 'custom',
    renderingMode: '2d',

    onAdd(_map: MlMap, gl: WebGLRenderingContext) {
      pinProg = program(gl, PIN_VS, PIN_FS);
      lineProg = program(gl, LINE_VS, LINE_FS);
      pinBuf = gl.createBuffer()!;
      lineBuf = gl.createBuffer()!;

      pinPos = gl.getAttribLocation(pinProg, 'a_pos');
      pinLocal = gl.getAttribLocation(pinProg, 'a_local');
      pinColor = gl.getAttribLocation(pinProg, 'a_color');
      pinRes = gl.getUniformLocation(pinProg, 'u_res')!;
      pinDpr = gl.getUniformLocation(pinProg, 'u_dpr')!;

      linePos = gl.getAttribLocation(lineProg, 'a_pos');
      lineColor = gl.getAttribLocation(lineProg, 'a_color');
      lineRes = gl.getUniformLocation(lineProg, 'u_res')!;
      lineDpr = gl.getUniformLocation(lineProg, 'u_dpr')!;
    },

    render(gl: WebGLRenderingContext) {
      const w = gl.canvas.width;
      const h = gl.canvas.height;
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      if (source.lineVertCount > 0) {
        gl.lineWidth(2);
        gl.useProgram(lineProg);
        gl.uniform2f(lineRes, w, h);
        gl.uniform1f(lineDpr, dpr);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
        gl.bufferData(gl.ARRAY_BUFFER, source.lineVerts, gl.DYNAMIC_DRAW);
        const stride = 5 * F;
        gl.enableVertexAttribArray(linePos);
        gl.vertexAttribPointer(linePos, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(lineColor);
        gl.vertexAttribPointer(lineColor, 3, gl.FLOAT, false, stride, 2 * F);
        gl.drawArrays(gl.LINES, 0, source.lineVertCount);
      }

      if (source.pinVertCount > 0) {
        gl.useProgram(pinProg);
        gl.uniform2f(pinRes, w, h);
        gl.uniform1f(pinDpr, dpr);
        gl.bindBuffer(gl.ARRAY_BUFFER, pinBuf);
        gl.bufferData(gl.ARRAY_BUFFER, source.pinVerts, gl.DYNAMIC_DRAW);
        const stride = 7 * F;
        gl.enableVertexAttribArray(pinPos);
        gl.vertexAttribPointer(pinPos, 2, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(pinLocal);
        gl.vertexAttribPointer(pinLocal, 2, gl.FLOAT, false, stride, 2 * F);
        gl.enableVertexAttribArray(pinColor);
        gl.vertexAttribPointer(pinColor, 3, gl.FLOAT, false, stride, 4 * F);
        gl.drawArrays(gl.TRIANGLES, 0, source.pinVertCount);
      }
    },
  };
}
