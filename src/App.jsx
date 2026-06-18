import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import { PHASES } from './constants';
import FluidBackground from './FluidBackground';
import './App.css'; 

import GenerativeCanvas from './components/GenerativeCanvas';

const RARE_CMYK_MUTATIONS = [
  "#A9DFBF", "#F9E79F", "#F5B041", "#A2D9CE", "#EDBB99"
];

function App() {

  const [isGenerativeMode, setIsGenerativeMode] = useState(false);
  
  const [inputValue, setInputValue] = useState("");
  const [spheres, setSpheres] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeSphere, setActiveSphere] = useState(null);
  const [step, setStep] = useState(1);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isInputVisible, setIsInputVisible] = useState(false);

  // NUEVOS ESTADOS PARA EL LIENZO MAGNÉTICO
  const canvasRef = React.useRef(null); // Referencia al rectángulo invisible central
 

  // Estado para guardar la colección de acuarelas estampadas en el lienzo libre
  const [canvasPolygons, setCanvasPolygons] = useState([]); // [{ id, title, color, x, y, finalSets }]

  // Estados para la coreografía de inmersión
  const [subtasks, setSubtasks] = useState([
    { id: 1, text: '', completed: false },
    { id: 2, text: '', completed: false },
    { id: 3, text: '', completed: false }
  ]);
  const [mode, setMode] = useState('input'); 
  const [setsCompleted, setSetsCompleted] = useState(0);
  const [isGuided, setIsGuided] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Solo permite invocar el spotlight si ya existe al menos una tarea
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && spheres.length > 0) {
        e.preventDefault();
        setIsInputVisible(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [spheres.length]);

  const updateSphereData = (updatedSubtasks) => {
    setSpheres(prev => prev.map(s => 
      s.id === activeSphere.id ? { ...s, subtasks: updatedSubtasks, step, setsCompleted, isGuided, mode } : s
    ));
  };

  const handleFinalize = () => {
  setIsFinalizing(true);
  
  // Capturamos el valor actual de los sets completados ANTES del delay de salida
  const finalSetsCount = setsCompleted || 1;

  setTimeout(() => {
    setSpheres(prev => prev.map(s => 
      s.id === activeSphere.id 
        ? { ...s, is_finalized: true, setsCompleted: finalSetsCount } 
        : s
    ));
    
    // Salida limpia al éter
    setActiveSphere(null);
    setStep(1);
    setMode('input');
    setSetsCompleted(0);
    setIsGuided(true);
    setSubtasks([
      { id: 1, text: '', completed: false },
      { id: 2, text: '', completed: false },
      { id: 3, text: '', completed: false }
    ]);
    
    setIsFinalizing(false);
  }, 1000); // Reducido a 1 segundo para evitar pérdida de estados reactivos
};

const handleClearCanvas = async () => {
  // 1. Limpieza visual inmediata en el estado de React
  setCanvasPolygons([]);

  // 2. Limpieza real en Supabase: 
  // Modificamos SOLO las tareas completadas que tienen posición en el lienzo.
  // En lugar de borrarlas (DELETE), les quitamos las coordenadas y el 'is_completed'
  // para que regresen al flujo si es necesario, o simplemente las desvinculamos del lienzo.
  const { error } = await supabase
    .from('tasks')
    .update({
      canvas_x: null,
      canvas_y: null,
      grid_cell_index: null,
      is_completed: false // Si quieres que vuelvan al Dock como pendientes, pon 'false'. Si quieres archivarlas para siempre, déjalo en 'true'.
    })
    .not('canvas_x', 'is', null); // Solo afecta a las que estaban pintadas

  if (error) {
    console.error("Error al limpiar el lienzo en Supabase:", error.message);
  } else {
    // Re-indexamos las tareas para que el Dock se vuelva a llenar con lo que quedó en el éter
    const { data: pendingData } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_completed', false)
      .order('created_at', { ascending: false });
    
    if (pendingData) {
      setSpheres(pendingData.map(t => ({ ...t, is_in_canvas: false })));
    }
  }
};

  const getShapeStyle = (sets) => {
    if (sets <= 2) return { borderRadius: '50%' }; 
    if (sets === 3) return { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0' }; 
    if (sets === 4) return { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', borderRadius: '0' }; 
    if (sets === 5) return { clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)', borderRadius: '0' }; 
    if (sets === 6) return { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', borderRadius: '0' }; 
    return { clipPath: 'polygon(50% 0%, 90% 20%, 100% 60%, 75% 100%, 25% 100%, 0% 60%, 10% 20%)', borderRadius: '0' }; 
  };

  const handleBackToEther = () => {
    if (activeSphere) {
      setSpheres(prev => prev.map(s => 
        s.id === activeSphere.id 
          ? { ...s, subtasks, step, setsCompleted, isGuided, mode } 
          : s
      ));
    }
    setActiveSphere(null);
    setStep(1);
    setMode('input');
    setSetsCompleted(0);
    setIsGuided(true);
    setSubtasks([{id: 1, text: '', completed: false}, {id: 2, text: '', completed: false}, {id: 3, text: '', completed: false}]);
  };

  const placeholders = ["levantarse", "encender la PC", "agarrar la libreta", "abrir el editor", "servirse agua"];

  useEffect(() => {
    if (activeSphere && step === 1) {
      const interval = setInterval(() => {
        setCarouselIndex((prev) => (prev + 1) % placeholders.length);
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [activeSphere, step]);

  useEffect(() => {
  const initializeSession = async () => {
    let { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) return;
      user = data.user;
    }
    
    if (user) {
      // 1. TRAER TAREAS PENDIENTES (Para el Dock)
      const { data: pendingData, error: pendingError } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_completed', false)
        .order('created_at', { ascending: false });
      
      if (!pendingError && pendingData) {
        // Mapeamos asegurando que inicien con su bandera local en false
        setSpheres(pendingData.map(t => ({ ...t, is_in_canvas: false })));
      }

      // 2. TRAER HISTÓRICO COMPLETADO (Para rehidratar el lienzo de acuarelas)
            
      const { data: completedData, error: completedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_completed', true)
        .not('canvas_x', 'is', null);

      if (!completedError && completedData) {
        const loadedPolygons = completedData.map(t => ({
          id: t.id,
          title: t.title,
          color: t.color,
          x: Number(t.canvas_x),
          y: Number(t.canvas_y),
          // CORRECCIÓN: Leemos exactamente 'sets_completed' de la base de datos
          finalSets: Number(t.sets_completed) || 1 
        }));
        setCanvasPolygons(loadedPolygons);
      }
    }
    setLoading(false);
  };
  initializeSession();
}, []);

  const getPhaseConfig = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return PHASES.MORNING;
    if (hour >= 12 && hour < 19) return PHASES.AFTERNOON;
    return PHASES.NIGHT;
  };

  const handleCreateSphere = async (e) => {
  if (inputValue.trim() !== "") {
    const currentPhase = getPhaseConfig();
    const { data: { user } } = await supabase.auth.getUser();

    let randomColor;
    if (Math.random() < 0.15) { 
      randomColor = RARE_CMYK_MUTATIONS[Math.floor(Math.random() * RARE_CMYK_MUTATIONS.length)];
    } else {
      // CORREGIDO: Ahora sí asignamos el color correctamente a la variable
      randomColor = currentPhase.colors[Math.floor(Math.random() * currentPhase.colors.length)];
    }

    const newTask = {
      title: inputValue,
      color: randomColor,
      type: 'normal',
      phase: currentPhase.name,
      is_completed: false,
      user_id: user.id
    };

    const { data, error } = await supabase.from('tasks').insert([newTask]).select();
    
    if (!error && data) {
      const localTask = { ...data[0], is_in_canvas: false };
      setSpheres((prev) => [...prev, localTask]);
      setInputValue("");
      setIsInputVisible(false); 
    } else if (error) {
      console.error("Error al guardar en Supabase:", error.message);
    }
  }
};

  if (loading) {
    return (
      <div className="h-screen w-full bg-capill-paper flex items-center justify-center font-sans text-capill-ink/40 uppercase tracking-widest text-xs">
        Preparando el éter...
      </div>
    );
  }

  const handleDragEnd = async (event, info, task) => {
  if (!canvasRef.current) return;

  const dropX = info.point.x;
  const dropY = info.point.y;
  const rect = canvasRef.current.getBoundingClientRect();

  const isInsideCanvas = (
    dropX >= rect.left &&
    dropX <= rect.right &&
    dropY >= rect.top &&
    dropY <= rect.bottom
  );

  if (isInsideCanvas) {
    const localX = dropX - rect.left - 28;
    const localY = dropY - rect.top - 28;
    
    // Capturamos el número exacto de sets que trae la bolita desde la inmersión
    const finalSetsCount = task.setsCompleted || 1;

    const newPolygon = {
      id: task.id,
      title: task.title,
      color: task.color,
      x: localX,
      y: localY,
      finalSets: finalSetsCount // Guardamos la geometría real localmente
    };

    setCanvasPolygons(prev => [...prev, newPolygon]);
    setSpheres(prev => prev.filter(s => s.id !== task.id));

    // Sincronizamos con Supabase incluyendo la columna de sets
    const { error } = await supabase
      .from('tasks')
      .update({
        is_completed: true,
        canvas_x: localX,
        canvas_y: localY,
        sets_completed: finalSetsCount // <-- Asegúrate de que esta columna se llame así en tu DB
      })
      .eq('id', task.id);

    if (error) {
      console.error("Error al guardar en Supabase:", error.message);
    }
  }
};

  return (
    

    
    <div className="h-screen w-full bg-capill-paper flex flex-col items-center justify-center overflow-hidden font-sans select-none relative">
      
      {/* RETÍCULA SUIZA 3X3 DELIMITADA EN LA ZONA SEGURA CENTRAL */}
      {/* RETÍCULA SUIZA 3X3 DELIMITADA Y CONTENEDOR DE ACUARELAS */}
      {/* RETÍCULA SUIZA CENTRAL LIMPIA */}
        <div 
          ref={canvasRef} 
          className="absolute top-32 bottom-32 left-10 right-10 z-0 pointer-events-none border border-black/[0.01]"
        >
          {/* Capa donde flotan las acuarelas guardadas */}
          <div className="absolute inset-0 pointer-events-auto">
            {canvasPolygons.map((poly) => (
              <motion.div
                key={`canvas-poly-${poly.id}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.85 }}
                style={{ 
                  position: 'absolute',
                  left: poly.x,
                  top: poly.y,
                  backgroundColor: poly.color,
                  ...getShapeStyle(poly.finalSets)
                }}
                className="w-14 h-14 shadow-2xl backdrop-blur-sm blur-[1.5px] mix-blend-multiply cursor-pointer group"
              >
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-capill-ink text-white text-[9px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none z-30">
                  {poly.title}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

      {/* HEADER COHESIVO CON BOTÓN FÍSICO */}
      <header className="absolute top-10 left-10 z-10 flex items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-capill-ink">
            C<span className="text-red-500">Á</span>PILL
          </h1>
          {spheres.length > 0 && <p className="text-[9px] uppercase tracking-widest opacity-30 mt-1">Ctrl + K para crear</p>}
        </div>

        {canvasPolygons.length > 0 && (
  <button
    onClick={() => setIsGenerativeMode(true)}
    className="absolute top-10 right-32 text-xs font-mono tracking-widest bg-capill-ink text-white px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity z-20 shadow-lg uppercase"
  >
    Terminar Sesión
  </button>
)}

        {/* El botón físico solo aparece si ya hay elementos en existencia */}
        {spheres.length > 0 && (
          <motion.button
            whileHover={{ scale: 1.04, backgroundColor: 'rgba(255,255,255,0.9)' }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsInputVisible(true)}
            className="px-4 py-2 bg-white/50 backdrop-blur-md border border-white/40 rounded-xl text-xs font-sans font-medium tracking-wide text-capill-ink shadow-sm cursor-pointer transition-colors"
          >
            + Nueva Certeza
          </motion.button>
        )}
      </header>

      {/* FLUJO DE ENTRADA HÍBRIDO (PRIMERA ACTIVIDAD VS SPOTLIGHT MODAL) */}
      <AnimatePresence mode="wait">
        {spheres.length === 0 ? (
          // UI CLÁSICA CENTRAL: Solo se renderiza si la lista está en cero
          <motion.div
            key="initial-center-input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="z-10 w-full max-w-lg px-4 text-center"
          >
            <input
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSphere(e);
              }}
              placeholder="Define tu certeza..."
              className="w-full bg-transparent text-4xl text-center outline-none border-b border-capill-ink/10 focus:border-capill-ink/30 p-4 font-light placeholder:opacity-20 text-capill-ink"
            />
            <p className="text-[10px] opacity-30 mt-4 tracking-widest uppercase font-sans">Escribe tu primer gran objetivo para liberar el lienzo</p>
          </motion.div>
        ) : (
          // SPOTLIGHT MODAL: Se activa para tareas subsecuentes mediante Ctrl+K o botón físico
          isInputVisible && (
            <motion.div
              key="spotlight-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInputVisible(false)} 
              className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.96, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 15 }}
                onClick={(e) => e.stopPropagation()} 
                className="w-full max-w-lg bg-white/70 backdrop-blur-2xl border border-white/40 p-6 rounded-2xl shadow-2xl"
              >
                <input
                  autoFocus
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSphere(e);
                  }}
                  placeholder="Define tu certeza..."
                  className="w-full bg-transparent text-2xl text-center outline-none p-2 font-light border-b border-capill-ink/10 focus:border-capill-ink/30 text-capill-ink placeholder:opacity-30"
                />
                <div className="text-[9px] text-center opacity-30 mt-4 tracking-widest uppercase">PULSA ENTER PARA EMBEBER</div>
              </motion.div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* DOCK CON RESPALDO INTELIGENTE Y COLORES BLINDADOS */}
      <div className="absolute bottom-10 flex gap-5 p-6 bg-white/20 backdrop-blur-xl rounded-full border border-white/40 shadow-lg z-20">
        <AnimatePresence mode="popLayout">
          {spheres
            .filter(s => !s.is_in_canvas)
            .slice(0, 5)
            .map((s) => (
              <motion.div
                // 1. CLAVE: Asegura que React reconozca cada bolita como única
                key={s.id} 
                
                // 2. Framer Motion Animation Properties
                layout
                layoutId={`sphere-container-${s.id}`}
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                
                // 3. Hover and Tap states (Interaction feel)
                whileHover={s.is_finalized ? { scale: 1.08 } : { y: -10, scale: 1.1 }}
                whileTap={s.is_finalized ? {} : { scale: 0.95 }}

                // 4. Mecánica de Clic (Modo Inmersivo)
                onClick={() => {
                  if (!s.is_finalized) {
                    setActiveSphere(s);
                    setStep(s.step || 1);
                    setSetsCompleted(s.setsCompleted || 0);
                    setIsGuided(s.isGuided !== undefined ? s.isGuided : true);
                    setMode(s.mode || 'input');
                    setSubtasks(s.subtasks && s.subtasks.length > 0 ? s.subtasks : [
                      { id: 1, text: '', completed: false },
                      { id: 2, text: '', completed: false },
                      { id: 3, text: '', completed: false }
                    ]);
                  }
                }}

                // 5. Mecánica de Arrastre (Fase 2)
                // Reemplaza estas propiedades específicas dentro del map de tus spheres en el Dock:
                drag={s.is_finalized}
                dragConstraints={canvasRef} // Vincula los límites al rectángulo invisible central
                dragElastic={0.2}
                onDragEnd={(event, info) => handleDragEnd(event, info, s)}
                
                // 6. ESTILO BLINDADO: Aseguramos el color
                style={{ 
                  backgroundColor: s.color || '#E5E7EB',
                  // Si ya se finalizó en inmersión, lee 'setsCompleted'. Si no, mantiene el círculo perfecto.
                  ...(s.is_finalized ? getShapeStyle(s.setsCompleted || 1) : { borderRadius: '50%' })
                }}
                
                className={`w-14 h-14 border border-white/30 relative group ${
                  s.is_finalized 
                    ? 'cursor-grab active:cursor-grabbing shadow-2xl backdrop-blur-sm blur-[1.5px] mix-blend-multiply opacity-85' 
                    : 'cursor-pointer'
                }`}
              >
                {/* Etiqueta flotante */}
                <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-capill-ink text-white text-[10px] px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none z-30">
                  {s.title} {s.is_finalized && " ── Arrástrame!"}
                </span>
              </motion.div>
            ))}
        </AnimatePresence>
      </div>

      {/* MODO INMERSIVO */}
      <AnimatePresence>
        {activeSphere && (
          <motion.div
            layoutId={`sphere-container-${activeSphere.id}`}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            style={{ backgroundColor: setsCompleted > 0 ? '#000000' : activeSphere.color }}
            className="fixed inset-0 w-full h-full z-50 flex flex-col items-center justify-center p-6 overflow-hidden transition-colors duration-300 text-white"
          >
            {setsCompleted > 0 && <FluidBackground baseColor={activeSphere.color} />}

            <button 
              onClick={handleBackToEther}
              className="absolute top-10 left-10 text-xs tracking-widest uppercase opacity-40 hover:opacity-100 transition-opacity cursor-pointer font-sans z-10"
            >
              ← Volver al éter
            </button>

            {mode === 'input' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full flex flex-col items-center z-10">
                <h2 className="text-xs uppercase tracking-widest opacity-40 font-sans font-bold mb-2">Objetivo actual</h2>
                <h1 className="text-4xl font-light tracking-tight max-w-2xl mb-12">{activeSphere.title}</h1>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {mode === 'input' && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="w-full max-w-xl backdrop-blur-2xl rounded-2xl p-8 border shadow-2xl flex flex-col items-center bg-white/5 border-white/10 shadow-black/40 z-10"
                >
                  <div className="w-full text-center mb-6">
                    <p className="text-xl font-medium mb-2">
                      {isGuided 
                        ? (step === 1 ? '¿Cuál es el primer paso físico necesario?' : step === 2 ? '¿En dónde se realizará la actividad?' : '¿Qué sigue inmediatamente después?')
                        : '¿Se requieren más pasos?'}
                    </p>
                    {isGuided && step === 1 && <p className="text-sm opacity-40 font-sans italic">Ejemplo: {placeholders[carouselIndex]}...</p>}
                    {!isGuided && <p className="text-sm opacity-40 font-sans italic">Desglosa el siguiente bloque...</p>}
                  </div>

                  <input
                    autoFocus
                    type="text"
                    placeholder="Escribe la acción..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim() !== "") {
                        const newTasks = [...subtasks];
                        newTasks[step - 1].text = e.target.value;
                        setSubtasks(newTasks);
                        updateSphereData(newTasks);

                        if (step < 3) {
                          setStep(prev => prev + 1);
                          e.target.value = "";
                        } else {
                          setMode('validating');
                          e.target.value = "";
                        }
                      }
                    }}
                    className="w-full bg-transparent text-center text-lg outline-none py-2 font-sans font-light border-b border-white/20 focus:border-white/60 text-white"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div 
              layout 
              className={mode === 'input' ? 'absolute bottom-8 left-1/2 -translate-x-1/2 z-10' : 'flex flex-col items-center justify-center mt-12 z-10 relative'}
            >
              <motion.div layout className={`flex ${mode === 'input' ? 'gap-4' : 'gap-8'} items-center justify-center`}>
                {[0, 1, 2].map((index) => {
                  const roman = ['I', 'II', 'III'][index];
                  const isCurrentOrPast = step >= index + 1;
                  const task = subtasks[index];

                  return (
                    <motion.div
                      key={`circle-${index}`}
                      layout
                      animate={{ 
                        rotateY: task.completed ? 360 : 0, 
                        scale: mode === 'merging' ? 0 : (mode === 'validating' ? 1.5 : (isCurrentOrPast ? 1.1 : 1)),
                      }}
                      whileHover={mode === 'validating' && !task.completed ? { scale: 1.6, y: -5 } : {}}
                      style={{ perspective: 1000 }} 
                      onClick={() => {
                        if (mode === 'validating') {
                          const newTasks = [...subtasks];
                          newTasks[index].completed = !newTasks[index].completed;
                          setSubtasks(newTasks);
                          updateSphereData(newTasks); 
                        }
                      }}
                      className={`rounded-full flex items-center justify-center font-serif font-bold transition-colors duration-500 group relative select-none
                        ${mode === 'input' ? 'w-10 h-10 text-sm border' : 'w-20 h-20 text-2xl border-2 cursor-pointer shadow-2xl'}
                        ${task.completed ? 'bg-white/20 backdrop-blur-md border-white/50 text-white' : (isCurrentOrPast ? 'bg-white text-black border-white' : 'border-white/20 opacity-30 text-white')}
                      `}
                    >
                      {roman}
                      
                      {mode === 'validating' && task.text && (
                         <span className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[11px] px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal max-w-[160px] text-center font-sans font-light backdrop-blur-md pointer-events-none shadow-2xl border border-white/10 z-20">
                           {task.text}
                           <span className="block text-[8px] opacity-40 mt-1 uppercase tracking-wider">
                             {task.completed ? 'Deshacer' : 'Completar'}
                           </span>
                         </span>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>

              <AnimatePresence>
                {mode === 'validating' && subtasks.every(t => t.completed) && (
                  <motion.button
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.9 }}
                    onClick={() => {
                      setMode('merging');
                      const nextSets = setsCompleted + 1;
                      setSetsCompleted(nextSets);
                      setTimeout(() => {
                        setMode('input');
                        setIsGuided(false);
                        setStep(1);
                        const resetTasks = [{id: 1, text: '', completed: false}, {id: 2, text: '', completed: false}, {id: 3, text: '', completed: false}];
                        setSubtasks(resetTasks);
                        setSpheres(prev => prev.map(s => 
                          s.id === activeSphere.id ? { ...s, subtasks: resetTasks, step: 1, setsCompleted: nextSets, isGuided: false, mode: 'input' } : s
                        ));
                      }, 600);
                    }}
                    className="mt-12 px-8 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-xs font-sans tracking-widest uppercase text-white hover:bg-white/20 transition-all cursor-pointer shadow-xl hover:scale-105 active:scale-95"
                  >
                    Sellar Bloque
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            <AnimatePresence>
              {setsCompleted > 0 && (
                <motion.button
                  key={`fin-btn-${setsCompleted}`}
                  // CAMBIO: Nuevas físicas de escala y rotación tridimensional con rebote elástico
                  animate={{ 
                    rotate: [0, 360], // Tu rotación 2D original
                    rotateX: isFinalizing ? [0, 20, -20, 0] : [0, 15, 0], // Inclinación 3D en el eje X
                    scale: isFinalizing ? 1.2 : [0.3, 1.3, 1], // Efecto Bounce In-Out en tamaño
                    x: isFinalizing ? [-2, 2, -2, 2, -1, 1, 0] : 0, 
                    opacity: 1
                  }}
                  transition={{ 
                    rotate: { duration: 0.8, ease: "easeInOut" },
                    // Un resorte con alta rigidez (stiffness) y bajo amortiguamiento (damping) para el rebote 3D
                    scale: { type: "spring", stiffness: 400, damping: 12 }, 
                    rotateX: { duration: 0.6, ease: "easeInOut" },
                    x: { repeat: isFinalizing ? Infinity : 0, duration: 0.1 }
                  }}
                  onClick={handleFinalize}
                  disabled={isFinalizing}
                  style={{ 
                    ...getShapeStyle(setsCompleted), 
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    perspective: 1000
                  }}
// CAMBIO: Añadida la clase 'mix-blend-difference' para invertir el color automáticamente
                  // CAMBIO: Cambiamos 'mix-blend-difference' por 'backdrop-invert-[80%]'
className="absolute bottom-10 right-10 w-20 h-20 backdrop-blur-xl border border-white/40 flex items-center justify-center text-white font-bold cursor-pointer hover:bg-white/30 shadow-[0_0_30px_rgba(255,255,255,0.2)] backdrop-invert-[80%] z-30"> 
                  <span className="font-sans text-[10px] tracking-widest opacity-60">FIN</span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

{isGenerativeMode && (
  <GenerativeCanvas 
    polygons={canvasPolygons} 
    onBack={() => {
      // Al salir del modo generativo, limpiamos el lienzo automáticamente
      handleClearCanvas(); 
      setIsGenerativeMode(false);
    }} 
  />
)}

    </div>

        

  );
}

export default App;