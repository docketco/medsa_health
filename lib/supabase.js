// lib/supabase.js
// ─────────────────────────────────────────────────────────────────────────────
// Supabase client — single connection used across all Medsa portals.
// Import wherever you need database access:
//   import { supabase } from '../lib/supabase'
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lqbaotvtzqnddaeslroe.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxYmFvdHZ0enFuZGRhZXNscm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NTk1NTUsImV4cCI6MjA5ODUzNTU1NX0.-pznSL9tO7_fzDBvypdsjnMjAhODMABKbYCdsdkU9HI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
