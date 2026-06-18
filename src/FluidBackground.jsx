import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function FluidBackground({ baseColor }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. SETUP DE ESCENA
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // SOLUCIÓN AL COLAPSO: Forzamos al canvas a ser un elemento absoluto inmune a Flexbox
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';

    mountRef.current.appendChild(renderer.domElement);

    // 2. DERIVACIÓN DE COLORES CMYK-SAFE
    const base = new THREE.Color(baseColor);
    const c1 = base.clone().multiplyScalar(0.12); // Valles profundos (Sombra)
    const c2 = base.clone().multiplyScalar(0.45); // Tonos medios oscuros
    const c3 = base.clone();                      // Tono real de tu bolita
    const c4 = base.clone().lerp(new THREE.Color(0xffffff), 0.55); // Crestas (Luz)

    // 3. SHADERS COMPLETAMENTE HIGIENIZADOS (Sin caracteres invisibles)
    const vertexShader = `
      varying vec2 vUv;
      void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform vec3 uColor4;
      uniform vec3 uLightPos;
      uniform float uDepth;
      uniform float uSpeed;
      uniform float uNoiseScale;
      uniform float uWarpAmount;
      uniform float uFoldFrequency;
      uniform float uAngle;
      uniform float uConnections;
      uniform float uShadowWidth;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 105.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      float getSurface(vec2 p) {
          float c = cos(uAngle), s = sin(uAngle);
          mat2 rot = mat2(c, -s, s, c);
          vec2 rp = rot * p;
          float n1 = snoise(vec3(rp * uNoiseScale * 0.25, uTime * uSpeed * 0.7));
          float n2 = snoise(vec3(rp * uNoiseScale * 0.25 + vec2(21.4, 15.2), uTime * uSpeed * 0.9));
          float trig1 = sin(rp.x * uNoiseScale * 0.5 + uTime * uSpeed) * 0.3;
          float trig2 = cos(rp.y * uNoiseScale * 0.5 - uTime * uSpeed) * 0.3;
          vec2 flow = vec2(n1 + trig1, n2 + trig2);
          vec2 wp = rp + flow * (uWarpAmount * 0.12);
          float freq = uFoldFrequency * 0.5;
          float phase = sin(wp.y * freq + flow.y * 2.0) * uConnections;
          float mainWave = sin(wp.x * freq + phase * uWarpAmount * 0.3);
          float n3 = snoise(vec3(wp * 0.5, uTime * uSpeed * 0.5));
          return (mainWave * 0.85 + n3 * 0.15) * 0.5;
      }

      void main() {
          vec2 uv = gl_FragCoord.xy / uResolution.xy;
          vec2 p = uv * 2.0 - 1.0;
          p.x *= uResolution.x / uResolution.y;

          vec2 e = vec2(0.09, 0.0);
          float dx = (getSurface(p + e.xy) - getSurface(p - e.xy)) / (2.0 * e.x);
          float dy = (getSurface(p + e.yx) - getSurface(p - e.yx)) / (2.0 * e.x);
          float safeDepth = max(uDepth, 0.02);
          vec3 normal = normalize(vec3(-dx, -dy, safeDepth));

          vec3 lightDir = normalize(uLightPos);
          float diffuse = dot(normal, lightDir) * 0.5 + 0.5;
          float t = diffuse;
          t += getSurface(p) * 0.04; 
          t = clamp(t, 0.0, 1.0);
          t = t * t * (3.0 - 2.0 * t);

          vec3 color = mix(uColor1, uColor2, smoothstep(0.0, uShadowWidth + 0.15, t));
          color = mix(color, uColor3, smoothstep(uShadowWidth + 0.05, 0.65, t));
          color = mix(color, uColor4, smoothstep(0.55, 1.05, t));

          float grain = fract(sin(dot(uv.xy, vec2(12.9898,78.233))) * 43758.5453);
          color += (grain - 0.5) * 0.03;

          gl_FragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uColor1: { value: c1 },
        uColor2: { value: c2 },
        uColor3: { value: c3 },
        uColor4: { value: c4 },
        uDepth: { value: 0.04 },
        uLightPos: { value: new THREE.Vector3(0.968, -0.36, 1.0) },
        uSpeed: { value: 0.1148 },
        uNoiseScale: { value: 0.714 },
        uWarpAmount: { value: 4.0 },
        uFoldFrequency: { value: 1.865 },
        uAngle: { value: 1.08699 },
        uConnections: { value: 0.8715 },
        uShadowWidth: { value: 0.01 }
      }
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const clock = new THREE.Clock();
    let animationId;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      material.uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement.parentNode) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [baseColor]);

  return (
    <div 
      ref={mountRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden" 
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    />
  );
}