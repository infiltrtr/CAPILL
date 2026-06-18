import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import { PHASES } from './constants';

function App() {
  const [inputValue, setInputValue] = useState("");
  const [spheres, setSpheres] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeSphere, setActiveSphere] = useState(null);
  const [step, setStep] = useState(1);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Estados para la coreografía de inmersión
  const [subtasks, setSubtasks] = useState([
    { id: 1, text: '', completed: false },
    { id: 2, text: '', completed: false },
    { id: 3, text: '', completed: false }
  ]);
  const [mode, setMode] = useState('input'); // 'input' | 'validating' | 'merging'
  const [setsCompleted, setSetsCompleted] = useState(0);
  const [isGuided, setIsGuided] = useState(true);

  const updateSphereData = (updatedSubtasks) => {
    const newSpheres = spheres.map(s => 
      s.id === activeSphere.id ? { ...s, subtasks: updatedSubtasks, step, setsCompleted, isGuided } : s
    );
    setSpheres(newSpheres);
  };

  const handleFinalize = () => {
  setIsFinalizing(true); // Activa el efecto shaky por 3s
  setTimeout(() => {
    // Guardamos la finalización Y retenemos el número de sets logrados para la geometría
    const newSpheres = spheres.map(s => 
      s.id === activeSphere.id ? { ...s, is_finalized: true, finalSets: setsCompleted } : s
    );
    setSpheres(newSpheres);
    resetImmersive();
    setIsFinalizing(false);
  }, 1500);
};

  // Función para obtener el polígono CSS según los sets completados
  const getShapeStyle = (sets) => {
    if (sets <= 2) return { borderRadius: '50%' }; 
    if (sets === 3) return { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0' }; 
    if (sets === 4) return { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', borderRadius: '0' }; 
    if (sets === 5) return { clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)', borderRadius: '0' }; 
    if (sets === 6) return { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', borderRadius: '0' }; 
    return { clipPath: 'polygon(50% 0%, 90% 20%, 100% 60%, 75% 100%, 25% 100%, 0% 60%, 10% 20%)', borderRadius: '0' }; 
  };

  const resetImmersive = () => {
    setActiveSphere(null);
    setStep(1);
    setMode('input');
    setSetsCompleted(0);
    setIsGuided(true);
    setSubtasks([{id: 1, text: '', completed: false}, {id: 2, text: '', completed: false}, {id: 3, text: '', completed: false}]);
  };

  const placeholders = [
    "levantarse", 
    "encender la PC", 
    "agarrar la libreta", 
    "abrir el editor", 
    "servirse agua"
  ];

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
        if (error) {
          console.error("Error al crear sesión anónima:", error.message);
          return;
        }
        user = data.user;
      }

      const fetchSpheres = async () => {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('is_completed', false)
          .order('created_at', { ascending: false })
          .limit(5); 
        
        if (!error) setSpheres(data);
      };

      if (user) {
        fetchSpheres();
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
    if (e.key === 'Enter' && inputValue.trim() !== "") {
      const currentPhase = getPhaseConfig();
      const randomColor = currentPhase.colors[Math.floor(Math.random() * currentPhase.colors.length)];
      const { data: { user } } = await supabase.auth.getUser();

      const newTask = {
        title: inputValue,
        color: randomColor,
        type: 'normal',
        phase: currentPhase.name,
        is_completed: false,
        user_id: user.id 
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([newTask])
        .select();

      if (!error && data) {
        setSpheres((prev) => [data[0], ...prev].slice(0, 5));
        setInputValue("");
      } else if (error) {
        console.error("Error al guardar:", error.message);
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

  return (
    <div className="h-screen w-full bg-capill-paper flex flex-col items-center justify-center overflow-hidden font-sans select-none">
      <header className="absolute top-10 left-10">
        <h1 className="text-2xl font-bold tracking-tighter text-capill-ink">
          C<span className="text-red-500">Á</span>PILL
        </h1>
      </header>

      <div className="z-10 w-full max-w-lg px-4">
        <motion.input
          autoFocus
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleCreateSphere}
          placeholder="Define tu certeza..."
          className="w-full bg-transparent text-4xl text-center outline-none border-b border-capill-ink/10 focus:border-capill-ink/30 transition-all p-4 font-light placeholder:opacity-20"
        />
      </div>

      
      {/* DOCK DE BOLITAS EVOLUTIVO Y ARRASTRABLE */}
      <div className="absolute bottom-10 flex gap-5 p-6 bg-white/20 backdrop-blur-xl rounded-full border border-white/40 shadow-lg">
        <AnimatePresence mode="popLayout">
          {spheres.map((s) => (
            <motion.div
              key={s.id}
              layout
              layoutId={`sphere-container-${s.id}`}
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              // Si ya está finalizada, eliminamos el brinco vertical para no interferir con el arrastre
              whileHover={s.is_finalized ? { scale: 1.08 } : { y: -10, scale: 1.1 }}
              
              // COMPORTAMIENTO CONDICIONAL: Solo abre el menú si no está finalizada
              onClick={() => {
                if (!s.is_finalized) setActiveSphere(s);
              }}

              // MECÁNICA FASE 2: Habilitar arrastre libre por la pantalla solo si está finalizada
              drag={s.is_finalized}
              dragElastic={0.1}
              // Límites aproximados para que el usuario pueda subir la figura al lienzo libremente
              dragConstraints={{ top: -800, left: -600, right: 600, bottom: 100 }} 
              
              style={{ 
                backgroundColor: s.color,
                // Si está finalizada, adopta la geometría del polígono ganado, si no, se queda como círculo (borderRadius 50%)
                ...(s.is_finalized ? getShapeStyle(s.finalSets || 3) : { borderRadius: '50%' })
              }}
              
              // ESTÉTICA SUIZA / ACUARELA: Mix-blend-multiply + blur suave simulan la fusión CMYK al encimarse
              className={`w-14 h-14 border border-white/30 relative group transition-colors duration-300 ${
                s.is_finalized 
                  ? 'cursor-grab active:cursor-grabbing shadow-2xl backdrop-blur-sm blur-[1.5px] mix-blend-multiply opacity-85' 
                  : 'cursor-pointer'
              }`}
            >
              {/* Etiqueta flotante con indicador de arrastre */}
              <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-capill-ink text-white text-[10px] px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl pointer-events-none z-30">
                {s.title} {s.is_finalized && " ── ¡Arrástrame al lienzo!"}
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
            style={{ backgroundColor: activeSphere.color }}
            className={`fixed inset-0 w-full h-full z-50 flex flex-col items-center justify-center p-6 overflow-hidden transition-colors duration-300 ${
              activeSphere.phase === 'noche' ? 'text-white' : 'text-capill-ink'
            }`}
          >
            <button 
              onClick={resetImmersive}
              className="absolute top-10 left-10 text-xs tracking-widest uppercase opacity-40 hover:opacity-100 transition-opacity cursor-pointer font-sans"
            >
              ← Volver al éter
            </button>

            {mode === 'input' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full flex flex-col items-center">
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
                  className={`w-full max-w-xl backdrop-blur-2xl rounded-2xl p-8 border shadow-2xl flex flex-col items-center transition-colors ${
                    activeSphere.phase === 'noche' ? 'bg-white/5 border-white/10 shadow-black/40' : 'bg-white/10 border-white/20 shadow-xl'
                  }`}
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

                        if (step < 3) {
                          setStep(prev => prev + 1);
                          e.target.value = "";
                        } else {
                          setMode('validating');
                          e.target.value = "";
                        }
                      }
                    }}
                    className={`w-full bg-transparent text-center text-lg outline-none py-2 transition-colors font-sans font-light border-b ${
                      activeSphere.phase === 'noche' ? 'border-white/20 focus:border-white/60 text-white' : 'border-capill-ink/20 focus:border-capill-ink/50 text-capill-ink'
                    }`}
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
                      key={`circle-${index}`}
                        layout
                        animate={{ 
                          rotateY: task.completed ? 360 : 0, 
                          scale: mode === 'merging' ? 0 : (mode === 'validating' ? 1.5 : (isCurrentOrPast ? 1.1 : 1)),
                        }}
                        // CAMBIO CLAVE: Reactividad sutil al hacer hover durante la validación
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
                      setTimeout(() => {
                        setSetsCompleted(prev => prev + 1);
                        setMode('input');
                        setIsGuided(false);
                        setStep(1);
                        setSubtasks([{id: 1, text: '', completed: false}, {id: 2, text: '', completed: false}, {id: 3, text: '', completed: false}]);
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
                key={`fin-btn-${setsCompleted}`} // <-- CAMBIO CLAVE: Esto fuerza a que el spin se repita por cada set nuevo
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  rotate: [0, 360], 
                  x: isFinalizing ? [-2, 2, -2, 2, -1, 1, 0] : 0, 
                  scale: isFinalizing ? 1.2 : [1, 1.3, 1], // Animación Bouncy restaurada
                  opacity: 1
                }}
                transition={{ 
                  rotate: { duration: 0.8, ease: "easeInOut" },
                  scale: { type: "spring", stiffness: 250, damping: 15 },
                  x: { repeat: isFinalizing ? Infinity : 0, duration: 0.1 }
                }}
                onClick={handleFinalize}
                disabled={isFinalizing}
                style={{ 
                  ...getShapeStyle(setsCompleted), 
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  perspective: 1000
                }}
                className="absolute bottom-10 right-10 w-20 h-20 backdrop-blur-xl border border-white/40 flex items-center justify-center text-white font-bold cursor-pointer hover:bg-white/30 shadow-[0_0_30px_rgba(255,255,255,0.2)] z-30"
              >
                <span className="font-sans text-[10px] tracking-widest opacity-60">FIN</span>
              </motion.button>
            )}
          </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;