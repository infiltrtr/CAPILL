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

// Nuevos estados para la coreografía de inmersión
const [subtasks, setSubtasks] = useState([
  { id: 1, text: '', completed: false },
  { id: 2, text: '', completed: false },
  { id: 3, text: '', completed: false }
]);
const [mode, setMode] = useState('input'); // 'input' | 'validating' | 'merging'
const [setsCompleted, setSetsCompleted] = useState(0);
const [isGuided, setIsGuided] = useState(true);

// Función para obtener el polígono CSS según los sets completados
const getShapeStyle = (sets) => {
  if (sets <= 2) return { borderRadius: '50%' }; // Círculo
  if (sets === 3) return { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', borderRadius: '0' }; // Triángulo
  if (sets === 4) return { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', borderRadius: '0' }; // Cuadrado
  if (sets === 5) return { clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)', borderRadius: '0' }; // Pentágono
  if (sets === 6) return { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', borderRadius: '0' }; // Hexágono
  return { clipPath: 'polygon(50% 0%, 90% 20%, 100% 60%, 75% 100%, 25% 100%, 0% 60%, 10% 20%)', borderRadius: '0' }; // Heptágono
};

// Función para reiniciar el modo inmersivo al salir
const resetImmersive = () => {
  setActiveSphere(null);
  setStep(1);
  setMode('input');
  setSetsCompleted(0);
  setIsGuided(true);
  setSubtasks([{id: 1, text: '', completed: false}, {id: 2, text: '', completed: false}, {id: 3, text: '', completed: false}]);
};

// Ejemplos para el carrusel de sugerencias
const placeholders = [
  "levantarse", 
  "encender la PC", 
  "agarrar la libreta", 
  "abrir el editor", 
  "servirse agua"
];

// Cambiar el texto del carrusel automáticamente cada 2.5 segundos
useEffect(() => {
  if (activeSphere && step === 1) {
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % placeholders.length);
    }, 2500);
    return () => clearInterval(interval);
  }
}, [activeSphere, step]);

  useEffect(() => {
    // Inicializar la sesión anónima invisible
    const initializeSession = async () => {
      // 1. Verificar si ya hay un usuario en el navegador
      let { data: { user } } = await supabase.auth.getUser();

      // 2. Si es un visitante nuevo, crearle su sesión anónima
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
      .limit(5); // Límite del bosque
    
    if (!error) setSpheres(data);
  };

      // 3. Una vez garantizada la identidad, traer sus bolitas específicas
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

      // Obtenemos el ID del usuario actual de la sesión activa
      const { data: { user } } = await supabase.auth.getUser();

      const newTask = {
        title: inputValue,
        color: randomColor,
        type: 'normal',
        phase: currentPhase.name,
        is_completed: false,
        user_id: user.id // <-- Enganchamos la tarea al usuario con certeza
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

      <div className="absolute bottom-10 flex gap-5 p-6 bg-white/20 backdrop-blur-xl rounded-full border border-white/40 shadow-lg">
        <AnimatePresence mode="popLayout">
          {spheres.map((s) => (
            <motion.div
              key={s.id}
              layout
              layoutId={`sphere-container-${s.id}`} // <-- ID único de animación compartido
              initial={{ scale: 0, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ y: -10, scale: 1.1 }}
              onClick={() => setActiveSphere(s)} // <-- Activa el modo inmersivo
              style={{ backgroundColor: s.color }}
              className="w-14 h-14 rounded-full cursor-pointer border border-white/30 relative group"
            >
              <span className="absolute -top-12 left-1/2 -translate-x-1/2 bg-capill-ink text-white text-[10px] px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-xl">
                {s.title}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
  {activeSphere && (
    <motion.div
      layoutId={`sphere-container-${activeSphere.id}`}
      transition={{ type: "spring", stiffness: 120, damping: 20 }}
      style={{ backgroundColor: activeSphere.color }}
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 transition-colors duration-300 ${
        activeSphere.phase === 'noche' ? 'text-white' : 'text-capill-ink'
      }`}
    >
      {/* Botón para regresar al éter */}
      <button 
        onClick={resetImmersive}
        className="absolute top-10 left-10 text-xs tracking-widest uppercase opacity-40 hover:opacity-100 transition-opacity cursor-pointer font-sans"
      >
        ← Volver al éter
      </button>

      {/* Título del objetivo (Solo en modo captura) */}
      {mode === 'input' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full flex flex-col items-center">
          <h2 className="text-xs uppercase tracking-widest opacity-40 font-sans font-bold mb-2">Objetivo actual</h2>
          <h1 className="text-4xl font-light tracking-tight max-w-2xl mb-12">{activeSphere.title}</h1>
        </motion.div>
      )}

      {/* Caja de Diálogo */}
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

      {/* Contenedor Flex para agrupar los círculos y el nuevo botón manual verticalmente */}
      <div className="flex flex-col items-center justify-center mt-12 relative z-10">
        
        {/* Los Círculos Romanos */}
        <motion.div 
          layout
          className={mode === 'input' ? "absolute bottom-12 flex gap-4 left-1/2 -translate-x-1/2 w-max" : "flex gap-8 items-center justify-center"}
        >
          {[0, 1, 2].map((index) => {
            const roman = ['I', 'II', 'III'][index];
            const isCurrentOrPast = step >= index + 1;
            const task = subtasks[index];

            return (
              <motion.div
                key={`circle-${index}`}
                layout
                animate={{ 
                  rotate: task.completed ? 360 : 0, 
                  scale: mode === 'merging' ? 0 : (mode === 'validating' ? 1.5 : (isCurrentOrPast ? 1.1 : 1)),
                  opacity: mode === 'merging' ? 0 : 1
                }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                onClick={() => {
                  if (mode === 'validating') {
                    // Lógica Reversible: cambia entre true y false
                    const newTasks = [...subtasks];
                    newTasks[index].completed = !newTasks[index].completed;
                    setSubtasks(newTasks);
                  }
                }}
                className={`rounded-full flex items-center justify-center font-serif font-bold transition-colors duration-500 group relative select-none
                  ${mode === 'input' ? 'w-10 h-10 text-sm border' : 'w-20 h-20 text-2xl border-2 cursor-pointer shadow-2xl'}
                  ${task.completed ? 'bg-white/20 backdrop-blur-md border-white/50 text-white' : (isCurrentOrPast ? 'bg-white text-black border-white' : 'border-white/20 opacity-30 text-white')}
                `}
              >
                {roman}
                
                {/* Etiqueta flotante con el recordatorio del texto real escrito en hover */}
                {mode === 'validating' && task.text && (
                   <span className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[11px] px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal max-w-[160px] text-center font-sans font-light backdrop-blur-md pointer-events-none shadow-2xl border border-white/10 z-20">
                     {task.text}
                     <span className="block text-[8px] opacity-40 mt-1 uppercase tracking-wider">
                       {task.completed ? 'Resetear' : 'Completar'}
                     </span>
                   </span>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Botón Glassmorphism manual para Sellar el Bloque */}
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
      </div>

      {/* Botón Finalizador Evolutivo (Esquina inferior derecha) con Giro 360 en Eje Y */}
      <AnimatePresence>
        {setsCompleted > 0 && (
          <motion.button
            key={setsCompleted} // Forzar re-render para disparar el spin y el bounce juntos
            initial={{ scale: 0, opacity: 0, rotateY: 0 }}
            animate={{ 
              scale: [1, 1.3, 1], // Efecto bouncy
              rotateY: 360,       // Giro sutil en el eje Y
              opacity: 1 
            }}
            transition={{ 
              scale: { type: "spring", stiffness: 250, damping: 15 },
              rotateY: { duration: 0.7, ease: "easeInOut" }
            }}
            onClick={() => {
              alert(`Actividad guardada. Forjado un polígono de ${setsCompleted <= 2 ? 'forma circular' : (setsCompleted + ' lados')}.`);
              resetImmersive();
            }}
            style={{ 
              ...getShapeStyle(setsCompleted), 
              backgroundColor: 'rgba(255,255,255,0.15)',
              perspective: 1000 // Le da profundidad 3D al giro en Y
            }}
            className="absolute bottom-10 right-10 w-20 h-20 backdrop-blur-xl border border-white/40 flex items-center justify-center text-white font-bold cursor-pointer hover:bg-white/30 transition-colors shadow-[0_0_30px_rgba(255,255,255,0.2)] z-30"
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