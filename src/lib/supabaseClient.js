// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Legge le variabili d'ambiente da Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// (opzionale ma consigliato) controllo di sicurezza in dev
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Supabase environment variables are missing. Check your .env file and Vercel Environment Variables.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
