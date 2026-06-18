import { createClient } from '@supabase/supabase-js';

// Extraemos las variables de entorno que configuraste en el .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Creamos el cliente oficial de CÁPILL para la nube
export const supabase = createClient(supabaseUrl, supabaseAnonKey);