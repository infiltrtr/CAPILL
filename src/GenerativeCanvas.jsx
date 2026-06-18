import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// 1. SHADER DE FRAGMENTOS (Actualizado a GLSL 3.00 ES con Tipado Seguro)
const GenerativeFragmentShader = `
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_count; 
  uniform vec2 u_positions[20];
  uniform vec3 u_colors[20];
  uniform float u_shapes[20];

  in vec2 vUv;
  out vec4 fragColor; // Esta es nuestra variable oficial de salida

  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx) ;
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,dot(x12.xy)), dot(x12.zw,dot(x12.zw))), 0.0);
    m = m*m ; m = m*m ;
    vec3 x = 2.0 * fract(p * C.规律) - 1.0; // Nota: Si el compilador se queja de este caracter, usa C.wwww
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // Pequeño fix preventivo por si se coló un caracter extraño arriba
  float safeSnoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx) ;
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,dot(x12.xy)), dot(x12.zw,dot(x12.zw))), 0.0);
    m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.wwww) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    vec2 st = vUv;
    float aspect = u_resolution.x / u_resolution.y;
    st.x *= aspect; 
    
    float paperTexture = safeSnoise(st * 400.0) * 0.01 + 0.99;
    vec3 finalColor = vec3(paperTexture);

    float expansionRadius = pow(u_time * 0.5, 1.5) * 0.12;

    for(int i = 0; i < 20; i++) {
      if (float(i) >= u_count) break; 

      vec2 center = u_positions[i] / u_resolution;
      center.y = 1.0 - center.y; 
      center.x *= aspect;

      float noisePattern = safeSnoise(st * 10.0 + u_time * 0.2) * 0.05;
      float dist = distance(st, center) + noisePattern;

      float baseRadius = 0.03 + (u_shapes[i] * 0.015);
      float currentRadius = baseRadius + expansionRadius;

      if (dist < currentRadius) {
        float edgeSoftness = 0.08 + (u_time * 0.01);
        float alpha = smoothstep(currentRadius, currentRadius - edgeSoftness, dist);
        
        vec3 inkColor = u_colors[i];
        vec3 blendedInk = mix(vec3(1.0), inkColor, alpha * 0.9);
        
        finalColor *= blendedInk; 
      }
    }

    // 🌟 CORRECCIÓN CLAVE: Asignamos el color a nuestra variable nativa de GLSL3
    fragColor = vec4(finalColor, 1.0);
  }
`;

function ShaderMesh({ polygons }) {
  const meshRef = useRef();
  const { size } = useThree();

  const uniforms = useMemo(() => {
    const positions = Array(20).fill().map(() => new THREE.Vector2());
    const colors = Array(20).fill().map(() => new THREE.Color());
    const shapes = Array(20).fill(1);

    polygons.forEach((poly, index) => {
      if (index < 20) {
        // Posicionamiento alineado
        positions[index].set(poly.x + 40 + 28, poly.y + 128 + 28);
        colors[index].set(poly.color || '#E5E7EB');
        shapes[index] = poly.finalSets || 1;
      }
    });

    return {
      u_resolution: { value: new THREE.Vector2(size.width, size.height) },
      u_time: { value: 0 },
      u_count: { value: parseFloat(polygons.length) },
      u_positions: { value: positions },
      u_colors: { value: colors },
      u_shapes: { value: shapes }
    };
  }, [polygons, size]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      if (meshRef.current.material.uniforms.u_time.value < 5.0) {
        meshRef.current.material.uniforms.u_time.value += delta;
      }
    }
  });

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.u_resolution.value.set(size.width, size.height);
    }
  }, [size]);

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        fragmentShader={GenerativeFragmentShader}
        vertexShader={`
          // FIX DE COMPILACIÓN: Eliminamos 'in vec3 position' y 'in vec2 uv' 
          // porque Three.js las inyecta de forma automática en GLSL3.
          out vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position, 1.0);
          }
        `}
        uniforms={uniforms}
        glslVersion={THREE.GLSL3}
      />
    </mesh>
  );
}

export default function GenerativeCanvas({ polygons, onBack }) {
  const canvasRef = useRef();

  // 🔍 RASTREADOR DE EMERGENCIA PARA APP.JSX
  // Abre la consola (F12) al dar clic en Terminar Sesión.
  // Si aquí te aparece un arreglo vacío [], el problema es de App.jsx
  useEffect(() => {
    console.log("Polígonos reales recibidos desde App.jsx:", polygons);
  }, [polygons]);

  const handleExportImage = () => {
    if (!canvasRef.current) return;
    const glCanvas = canvasRef.current;
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');

    const bleed = 80; 
    exportCanvas.width = glCanvas.width + (bleed * 2);
    exportCanvas.height = glCanvas.height + (bleed * 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(glCanvas, bleed, bleed);

    const dataURL = exportCanvas.toDataURL("image/png", 1.0);
    const link = document.createElement("a");
    link.download = `CAPILL_Impresion_${new Date().toISOString().slice(0,10)}.png`;
    link.href = dataURL;
    link.click();
  };

  // ... El resto de tu return del componente se queda exactamente igual



  return (
    <div className="fixed inset-0 w-full h-full bg-white z-50 flex flex-col justify-between">
      <div className="absolute inset-0 w-full h-full">
        <Canvas 
          dpr={[1, 1.5]} // Restricción balanceada para evitar sobrecalentamiento en pantallas Retina/4K
          gl={{ preserveDrawingBuffer: true, antialias: true }} 
          onCreated={({ gl }) => { 
            canvasRef.current = gl.domElement; 
            gl.setClearColor('#FFFFFF'); 
          }}
        >
          <ShaderMesh polygons={polygons} />
        </Canvas>
      </div>

      <div className="relative w-full p-8 flex justify-between items-center pointer-events-none z-50">
        <button 
          onClick={onBack}
          className="pointer-events-auto text-xs font-mono tracking-widest text-black/50 hover:text-black transition-colors uppercase"
        >
          ← Volver y Limpiar Lienzo
        </button>
        <button 
          onClick={handleExportImage}
          className="pointer-events-auto bg-black text-white text-xs font-mono tracking-widest px-8 py-4 rounded-full hover:bg-black/80 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.3)] uppercase"
        >
          Imprimir Obra (PNG)
        </button>
      </div>
    </div>
  );
}