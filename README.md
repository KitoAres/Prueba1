# GACIP · Asistencia QR + Perfiles de Liderazgo Transformacional

Aplicación web (HTML/CSS/JS vanilla + Supabase) para el control de asistencia
por código QR y el seguimiento de perfiles de liderazgo transformacional de
los voluntarios GACIP.

## 1. Configurar la base de datos

1. Entra a tu proyecto de Supabase → **SQL Editor** → **New query**.
2. Copia y pega **todo** el contenido de `database/schema.sql` y ejecútalo.
3. Esto crea las tablas `roles`, `users`, `attendance`, `leadership_profiles`,
   activa RLS, crea las funciones RPC necesarias y siembra un usuario **sudo**
   inicial:

   ```
   Email:    sudo@gacip.org
   Password: Gacip#2026
   ```

   **Cambia esta contraseña de inmediato** desde el Panel Sudo una vez que
   inicies sesión.

## 2. Ejecutar la aplicación

Este es un sitio 100% estático (no requiere Node ni build). Para evitar
problemas de cámara (que los navegadores solo habilitan en `https://` o
`localhost`), sírvelo con cualquier servidor local, por ejemplo:

```bash
cd gacip-app
python3 -m http.server 8080
# abre http://localhost:8080
```

o publícalo directamente en Netlify / Vercel / GitHub Pages (todos ya sirven
sobre HTTPS).

## 3. Estructura del proyecto

```
gacip-app/
├── database/
│   └── schema.sql          ← Ejecutar una sola vez en Supabase
├── assets/
│   ├── css/style.css       ← Estilos globales
│   └── js/
│       ├── supabaseClient.js  ← Cliente Supabase (URL + anon key)
│       ├── session.js         ← Sesión, guardas de ruta, navegación
│       ├── auth.js             ← Lógica de login
│       ├── dashboard.js        ← Escaneo QR + registro de asistencia
│       ├── profile.js          ← Perfil propio (puntos, QR, liderazgo)
│       ├── voluntarios.js      ← Listado y edición de perfiles (admin/sudo)
│       └── sudo.js             ← CRUD de cuentas, roles y contraseñas
├── index.html               ← Login
├── dashboard.html            ← Escaneo QR (admin/sudo)
├── perfil.html                ← Mi perfil (todos los roles)
├── voluntarios.html            ← Gestión de voluntarios (admin/sudo)
└── sudo.html                    ← Panel Sudo (solo sudo)
```

## 4. Roles

| Rol      | Puede hacer |
|----------|-------------|
| **sudo**    | Todo lo del admin + crear/eliminar cuentas, cambiar roles y contraseñas de cualquiera. |
| **admin**   | Escanear QR y registrar asistencia, ver y editar perfiles de liderazgo de voluntarios. |
| **usuario** | Ver sus propios puntos, su código QR y su perfil de liderazgo. |

## 5. Cómo funciona la seguridad

Esta app usa una tabla `users` propia (no Supabase Auth) con contraseñas
hasheadas con `bcrypt` (extensión `pgcrypto`). Row Level Security está
**activo pero sin políticas**, lo que bloquea cualquier lectura/escritura
directa desde el navegador con la clave `anon`. Toda la lógica pasa por
funciones RPC `SECURITY DEFINER`, cada una validando el rol del usuario que
ejecuta la acción antes de tocar los datos.

> Nota: al no usar Supabase Auth, la sesión se guarda en `localStorage` del
> navegador. Es un modelo adecuado para una herramienta interna de uso
> controlado. Si en el futuro necesitas seguridad de nivel productivo (con
> tokens firmados, expiración de sesión, 2FA, etc.), te recomiendo migrar el
> login a **Supabase Auth** y usar `auth.uid()` en las políticas RLS.

## 6. Regla de negocio de asistencia

La función `register_attendance` valida con una restricción `unique(user_id,
attendance_date)` que solo pueda existir **un registro de asistencia por
usuario por día**. Si el voluntario ya escaneó su QR hoy, el sistema muestra
"Ya registró su asistencia hoy" en lugar de sumar otro punto.

## 7. Generar el QR de un voluntario

Cada usuario tiene un campo `qr_code` único generado automáticamente al
crear la cuenta. Los voluntarios pueden ver e imprimir/guardar su propio
código QR desde `perfil.html` (se genera en el navegador con `qrcodejs`).
