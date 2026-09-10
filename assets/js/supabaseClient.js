// ==========================================================================
// GACIP · Cliente Supabase compartido por toda la aplicación
// ==========================================================================
var SUPABASE_URL = 'https://cmlyjfxuybkglkafhyus.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtbHlqZnh1eWJrZ2xrYWZoeXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDM2NjUsImV4cCI6MjEwNDMxOTY2NX0.o1z1TMYzJO5VRX5S0dNY2szIrxvntb5m-EyI7QIYOPY';

// OJO: aquí NO usamos "const" ni "let" para no chocar con la variable
// global "supabase" que ya creó la librería cargada por el <script> del CDN.
// Simplemente reemplazamos su contenido por el cliente ya conectado.
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
