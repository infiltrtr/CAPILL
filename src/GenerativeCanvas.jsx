import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// 1. SHADER CON RUIDO FBM ULTRA-ESTABLE PARA SIMULACIÓN DE CAPILARIDAD
const GenerativeFragmentShader = `
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_count; 
  uniform vec2 u_positions[20];
  uniform vec3 u_colors[20];
  uniform float u_shapes[20];

  in vec2 vUv;
  out vec4 fragColor;

  // Hash matemático para generación pseudo-aleatoria libre de errores
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // Ruido de valor suave de 2 dimensiones
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }

  // FBM de 3 octavas para esculpir las ramificaciones orgánicas de la acuarela
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 st = vUv;
    float aspect = u_resolution.x / u_resolution.y;
    st.x *= aspect; 
    
    // Textura de grano fino emulando papel poroso absorbiendo agua
    float paperTexture = noise(st * 500.0) * 0.012 + 0.988;
    vec3 finalColor = vec3(paperTexture);

    // Crecimiento de la mancha controlado en el tiempo
    float expansionRadius = pow(u_time * 0.4, 1.4) * 0.16;

    for(int i = 0; i < 20; i++) {
      if (float(i) >= u_count) break; 

      vec2 center = u_positions[i] / u_resolution;
      center.y = 1.0 - center.y; 
      center.x *= aspect;

      // Distorsión fluida cruzada por FBM (Simula la capilaridad real del papel mojado)
      float liquidBleed = fbm(st * 7.0 + u_time * 0.15) * 0.07;
      float dist = distance(st, center) + liquidBleed - 0.03;

      float baseRadius = 0.02 + (u_shapes[i] * 0.015);
      float currentRadius = baseRadius + expansionRadius;

      if (dist < currentRadius) {
        float edgeSoftness = 0.07 + (u_time * 0.015);
        float alpha = smoothstep(currentRadius, currentRadius - edgeSoftness, dist);
        
        vec3 inkColor = u_colors[i];
        vec3 blendedInk = mix(vec3(1.0), inkColor, alpha * 0.92);
        
        // Multiplicación pura de pigmentación translúcida
        finalColor *= blendedInk; 
      }
    }

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
        // Mapeo exacto sumando márgenes del layout suizo
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
      // Detenemos la expansión a los 5.5 segundos para conservar la nitidez artística
      if (meshRef.current.material.uniforms.u_time.value < 5.5) {
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

  return (
    <div className="fixed inset-0 w-full h-full bg-white z-50 flex flex-col justify-between">
      <div className="absolute inset-0 w-full h-full">
        <Canvas 
          dpr={[1, 1.5]} 
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