import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// 1. CODIGO GLSL: El Fragment Shader encargado de la capilaridad y expansión líquida
const GenerativeFragmentShader = `
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform int u_count;
  uniform vec2 u_positions[20]; // Límite máximo de 20 acuarelas
  uniform vec3 u_colors[20];
  uniform float u_shapes[20]; // Guarda la geometría (finalSets)

  varying vec2 vUv;

  // Función de ruido Simplex para generar las fibras del papel y capilaridad
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx) ;
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,dot(x12.xy)), dot(x12.zw,dot(x12.zw))), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.wwww) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    // Normalizamos el espacio de la pantalla suiza
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    
    // Crear una textura base de fondo estilo papel acuarela rugoso
    float paperTexture = snoise(st * 300.0) * 0.02 + 0.98;
    vec3 finalColor = vec3(paperTexture); // Fondo blanco/crema inicial

    // El tiempo controla la velocidad de expansión exponencial de la tinta
    float expansionRadius = pow(u_time * 0.4, 1.8) * 0.15;

    // Iteramos sobre cada una de tus acuarelas guardadas
    for(int i = 0; i < 20; i++) {
      if (i >= u_count) break;

      // Convertir la coordenada de píxeles del DOM a espacio normalizado WebGL
      vec2 center = u_positions[i] / u_resolution;
      center.y = 1.0 - center.y; // Invertir eje Y

      // Distorsión por ruido para emular la capilaridad orgánica de las fibras del papel
      float noisePattern = snoise(st * 12.0 + u_time * 0.1) * 0.04;
      float dist = distance(st, center) + noisePattern;

      // El radio inicial depende de los sets completados
      float baseRadius = 0.05 + (u_shapes[i] * 0.01);
      float currentRadius = baseRadius + expansionRadius;

      // Renderizado del sangrado líquido (difusión suave en el borde)
      if (dist < currentRadius) {
        float edgeSoftness = 0.08 + (u_time * 0.01);
        float alpha = smoothstep(currentRadius, currentRadius - edgeSoftness, dist);
        
        // MIX-BLEND-MULTIPLY ANALÓGICO: Multiplicamos las densidades de color
        vec3 inkColor = u_colors[i];
        vec3 blendedInk = mix(vec3(1.0), inkColor, alpha * 0.85);
        finalColor *= blendedInk; 
      }
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// 2. COMPONENTE INTERNO: Maneja la actualización de fotogramas del Shader
function ShaderMesh({ polygons }) {
  const meshRef = useRef();
  const { size, gl } = useThree();

  // Mapeo y normalización de tus colores HEX a vectores RGB de WebGL [0.0 - 1.0]
  const uniforms = useMemo(() => {
    const positions = Array(20).fill().map(() => new THREE.Vector2());
    const colors = Array(20).fill().map(() => new THREE.Color());
    const shapes = Array(20).fill(1);

    polygons.forEach((poly, index) => {
      if (index < 20) {
        // Pasamos las posiciones relativas (ajustando el centro geométrico)
        positions[index].set(poly.x + 28, poly.y + 28);
        colors[index].set(poly.color);
        shapes[index] = poly.finalSets;
      }
    });

    return {
      u_resolution: { value: new THREE.Vector2(size.width, size.height) },
      u_time: { value: 0 },
      u_count: { value: polygons.length },
      u_positions: { value: positions },
      u_colors: { value: colors },
      u_shapes: { value: shapes }
    };
  }, [polygons, size]);

  // Actualizar el tiempo en cada frame para mover la animación líquida
  useFrame((state) => {
    if (meshRef.current) {
      // Detenemos la expansión exponencial a los 6 segundos para que no se sature el lienzo
      if (meshRef.current.material.uniforms.u_time.value < 6.0) {
        meshRef.current.material.uniforms.u_time.value = state.clock.getElapsedTime();
      }
    }
  });

  // Asegurar que responda correctamente al redimensionar la ventana de Vite
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
          varying vec2 vUv;
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

// 3. COMPONENTE PRINCIPAL EXPORTABLE
export default function GenerativeCanvas({ polygons, onBack }) {
  const canvasRef = useRef();

  // Función nativa de exportación a alta resolución (Impresión PNG)
  const handleExportImage = () => {
    if (!canvasRef.current) return;
    
    // Forzamos un renderizado para asegurar la captura del buffer
    const gl = canvasRef.current.getContext('webgl2');
    
    const dataURL = canvasRef.current.toDataURL("image/png", 1.0);
    const link = document.createElement("a");
    link.download = `CAPILL_Lienzo_Generativo_${new Date().toISOString().slice(0,10)}.png`;
    link.href = dataURL;
    link.click();
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-white z-50 flex flex-col justify-between">
      {/* El Lienzo de Renderizado */}
      <div className="absolute inset-0 w-full h-full">
        <Canvas 
          gl={{ preserveDrawingBuffer: true }} // CLAVE: Permite descargar el canvas sin que salga negro
          onCreated={({ gl }) => { canvasRef.current = gl.domElement; }}
        >
          <ShaderMesh polygons={polygons} />
        </Canvas>
      </div>

      {/* Menú de Interfaz de Usuario Flotante (UI Suiza Minimalista) */}
      <div className="relative w-full p-8 flex justify-between items-center pointer-events-none z-50">
        <button 
          onClick={onBack}
          className="pointer-events-auto text-xs font-mono tracking-widest text-black/50 hover:text-black transition-colors uppercase"
        >
          ← Volver al Lienzo
        </button>
        <button 
          onClick={handleExportImage}
          className="pointer-events-auto bg-black text-white text-xs font-mono tracking-widest px-6 py-3 rounded-full hover:bg-black/80 transition-all shadow-xl uppercase"
        >
          Imprimir Obra (PNG)
        </button>
      </div>
    </div>
  );
}