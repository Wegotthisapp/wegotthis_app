// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dpxuxfgoyjsrfqtwspzw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRweHV4ZmdveWpzcmZxdHdzcHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExOTI4NzUsImV4cCI6MjA2Njc2ODg3NX0.l0xzcMfOPdcYd55ThesLt5vNYmoLq7AbsnyzPpR3GKY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
