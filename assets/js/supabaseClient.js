// ==========================================================================
// GACIP · Cliente Supabase compartido por toda la aplicación
// ==========================================================================
const SUPABASE_URL = 'https://cmlyjfxuybkglkafhyus.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtbHlqZnh1eWJrZ2xrYWZoeXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDM2NjUsImV4cCI6MjEwNDMxOTY2NX0.o1z1TMYzJO5VRX5S0dNY2szIrxvntb5m-EyI7QIYOPY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
