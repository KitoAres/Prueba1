-- ======================================================================
-- GACIP · Sistema de Asistencia QR + Perfil de Liderazgo Transformacional
-- Esquema de Base de Datos para Supabase (PostgreSQL)
--
-- CÓMO USARLO:
-- 1. Abre tu proyecto en https://supabase.com/dashboard
-- 2. Ve a "SQL Editor" -> "New query"
-- 3. Pega TODO este archivo y ejecútalo (Run)
-- 4. Verifica en "Table Editor" que se crearon: roles, users,
--    attendance, leadership_profiles
--
-- NOTA DE SEGURIDAD IMPORTANTE:
-- Este proyecto usa autenticación PROPIA (tabla `users` con contraseñas
-- hasheadas con bcrypt vía pgcrypto), NO Supabase Auth. Por eso, en vez
-- de políticas RLS clásicas basadas en auth.uid(), se bloquea el acceso
-- directo a las tablas para la clave "anon" y TODA la lógica se expone
-- a través de funciones RPC "SECURITY DEFINER" que validan el rol de
-- quien ejecuta la acción (p_actor_id) antes de tocar los datos.
-- Esto es apropiado para una herramienta interna de uso controlado.
-- Si en el futuro quieres seguridad de nivel productivo/bancario,
-- te recomiendo migrar el login a Supabase Auth.
-- ======================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------
-- 1. TABLA: roles
-- ----------------------------------------------------------------------
create table if not exists roles (
  id   smallint primary key,
  name text unique not null
);

insert into roles (id, name) values
  (1, 'sudo'),
  (2, 'admin'),
  (3, 'usuario')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------
-- 2. TABLA: users  (voluntarios GACIP, admins y sudo)
-- ----------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text unique not null,
  password_hash text not null,
  role_id       smallint not null references roles(id) default 3,
  qr_code       text unique not null default replace(gen_random_uuid()::text, '-', ''),
  points        integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- 3. TABLA: attendance  (1 registro por usuario y día)
-- ----------------------------------------------------------------------
create table if not exists attendance (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references users(id) on delete cascade,
  attendance_date date not null default current_date,
  scanned_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  unique (user_id, attendance_date)
);

-- ----------------------------------------------------------------------
-- 4. TABLA: leadership_profiles (liderazgo transformacional)
-- ----------------------------------------------------------------------
create table if not exists leadership_profiles (
  id                              bigint generated always as identity primary key,
  user_id                         uuid unique not null references users(id) on delete cascade,
  -- Métricas cuantitativas (0-100)
  idealized_influence_attributes smallint not null default 0 check (idealized_influence_attributes between 0 and 100),
  idealized_influence_behaviors  smallint not null default 0 check (idealized_influence_behaviors  between 0 and 100),
  individualized_consideration   smallint not null default 0 check (individualized_consideration   between 0 and 100),
  inspirational_motivation       smallint not null default 0 check (inspirational_motivation        between 0 and 100),
  intellectual_stimulation       smallint not null default 0 check (intellectual_stimulation         between 0 and 100),
  -- Métricas cualitativas
  improvement_notes text not null default '',
  weaknesses        text not null default '',
  strengths         text not null default '',
  updated_by        uuid references users(id),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_attendance_user_date on attendance(user_id, attendance_date);
create index if not exists idx_users_qr on users(qr_code);

-- ----------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (bloqueo total del acceso directo vía anon key)
-- ----------------------------------------------------------------------
alter table roles                enable row level security;
alter table users                enable row level security;
alter table attendance           enable row level security;
alter table leadership_profiles  enable row level security;
-- A propósito NO se crean políticas: sin políticas + RLS activo = nadie
-- puede leer/escribir estas tablas directamente con la anon key.
-- Sólo las funciones RPC (definidas como SECURITY DEFINER, dueñas del
-- esquema) pueden operar sobre ellas, y cada una valida el rol primero.

-- ----------------------------------------------------------------------
-- 6. HELPER interno
-- ----------------------------------------------------------------------
create or replace function _get_role(p_user_id uuid)
returns text
language sql stable
as $$
  select r.name
  from users u join roles r on r.id = u.role_id
  where u.id = p_user_id and u.active = true;
$$;

-- ----------------------------------------------------------------------
-- 7. AUTENTICACIÓN
-- ----------------------------------------------------------------------
create or replace function login(p_email text, p_password text)
returns json
language plpgsql security definer
as $$
declare v users%rowtype;
begin
  select * into v from users where lower(email) = lower(p_email) and active = true;
  if not found then
    raise exception 'Credenciales inválidas';
  end if;
  if v.password_hash <> crypt(p_password, v.password_hash) then
    raise exception 'Credenciales inválidas';
  end if;
  return json_build_object(
    'id', v.id,
    'full_name', v.full_name,
    'email', v.email,
    'role', (select name from roles where id = v.role_id),
    'qr_code', v.qr_code,
    'points', v.points
  );
end;
$$;

-- ----------------------------------------------------------------------
-- 8. GESTIÓN DE USUARIOS (crear / password / rol / activo / eliminar)
-- ----------------------------------------------------------------------
create or replace function create_user(
  p_actor_id uuid, p_full_name text, p_email text, p_password text, p_role_name text
) returns json
language plpgsql security definer
as $$
declare v_actor_role text; v_role_id smallint; v_new users%rowtype;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role is null or v_actor_role = 'usuario' then
    raise exception 'No autorizado';
  end if;
  if v_actor_role = 'admin' and p_role_name <> 'usuario' then
    raise exception 'Un admin sólo puede registrar voluntarios (rol usuario)';
  end if;

  select id into v_role_id from roles where name = p_role_name;
  if v_role_id is null then raise exception 'Rol inválido'; end if;

  insert into users (full_name, email, password_hash, role_id)
  values (p_full_name, lower(p_email), crypt(p_password, gen_salt('bf')), v_role_id)
  returning * into v_new;

  insert into leadership_profiles (user_id) values (v_new.id);

  return json_build_object('id', v_new.id, 'qr_code', v_new.qr_code, 'full_name', v_new.full_name);
end;
$$;

create or replace function set_password(p_actor_id uuid, p_target_id uuid, p_new_password text)
returns void
language plpgsql security definer
as $$
declare v_actor_role text;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role <> 'sudo' and p_actor_id <> p_target_id then
    raise exception 'No autorizado';
  end if;
  update users set password_hash = crypt(p_new_password, gen_salt('bf')) where id = p_target_id;
end;
$$;

create or replace function set_role(p_actor_id uuid, p_target_id uuid, p_new_role text)
returns void
language plpgsql security definer
as $$
declare v_actor_role text; v_role_id smallint;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role <> 'sudo' then raise exception 'Sólo un usuario sudo puede cambiar roles'; end if;
  select id into v_role_id from roles where name = p_new_role;
  if v_role_id is null then raise exception 'Rol inválido'; end if;
  update users set role_id = v_role_id where id = p_target_id;
end;
$$;

create or replace function set_active(p_actor_id uuid, p_target_id uuid, p_active boolean)
returns void
language plpgsql security definer
as $$
declare v_actor_role text;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role <> 'sudo' then raise exception 'Sólo un usuario sudo puede activar/desactivar cuentas'; end if;
  update users set active = p_active where id = p_target_id;
end;
$$;

create or replace function delete_user(p_actor_id uuid, p_target_id uuid)
returns void
language plpgsql security definer
as $$
declare v_actor_role text;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role <> 'sudo' then raise exception 'Sólo un usuario sudo puede eliminar cuentas'; end if;
  if p_actor_id = p_target_id then raise exception 'No puedes eliminar tu propia cuenta'; end if;
  delete from users where id = p_target_id;
end;
$$;

create or replace function update_profile_info(p_actor_id uuid, p_target_id uuid, p_full_name text, p_email text)
returns void
language plpgsql security definer
as $$
declare v_actor_role text;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role not in ('sudo','admin') and p_actor_id <> p_target_id then
    raise exception 'No autorizado';
  end if;
  update users set full_name = p_full_name, email = lower(p_email) where id = p_target_id;
end;
$$;

-- ----------------------------------------------------------------------
-- 9. LISTADOS Y PERFILES
-- ----------------------------------------------------------------------
create or replace function get_users(p_actor_id uuid)
returns table(id uuid, full_name text, email text, role text, qr_code text, points int, active boolean, created_at timestamptz)
language plpgsql security definer
as $$
declare v_actor_role text;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role not in ('sudo','admin') then raise exception 'No autorizado'; end if;
  return query
    select u.id, u.full_name, u.email, r.name, u.qr_code, u.points, u.active, u.created_at
    from users u join roles r on r.id = u.role_id
    order by u.full_name;
end;
$$;

create or replace function get_my_profile(p_user_id uuid)
returns json
language plpgsql security definer
as $$
declare v_user json; v_lp json; v_today_marked boolean;
begin
  select json_build_object(
    'id', u.id, 'full_name', u.full_name, 'email', u.email,
    'role', r.name, 'qr_code', u.qr_code, 'points', u.points
  ) into v_user
  from users u join roles r on r.id = u.role_id where u.id = p_user_id;

  select json_build_object(
    'idealized_influence_attributes', idealized_influence_attributes,
    'idealized_influence_behaviors',  idealized_influence_behaviors,
    'individualized_consideration',   individualized_consideration,
    'inspirational_motivation',       inspirational_motivation,
    'intellectual_stimulation',       intellectual_stimulation,
    'improvement_notes', improvement_notes,
    'weaknesses',         weaknesses,
    'strengths',          strengths,
    'updated_at',         updated_at
  ) into v_lp
  from leadership_profiles where user_id = p_user_id;

  select exists(
    select 1 from attendance where user_id = p_user_id and attendance_date = current_date
  ) into v_today_marked;

  return json_build_object('user', v_user, 'leadership_profile', v_lp, 'attended_today', v_today_marked);
end;
$$;

create or replace function get_leadership_profile(p_actor_id uuid, p_target_id uuid)
returns json
language plpgsql security definer
as $$
declare v_actor_role text; v_lp json;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role not in ('sudo','admin') and p_actor_id <> p_target_id then
    raise exception 'No autorizado';
  end if;
  select json_build_object(
    'idealized_influence_attributes', idealized_influence_attributes,
    'idealized_influence_behaviors',  idealized_influence_behaviors,
    'individualized_consideration',   individualized_consideration,
    'inspirational_motivation',       inspirational_motivation,
    'intellectual_stimulation',       intellectual_stimulation,
    'improvement_notes', improvement_notes,
    'weaknesses',         weaknesses,
    'strengths',          strengths,
    'updated_at',         updated_at
  ) into v_lp
  from leadership_profiles where user_id = p_target_id;
  return v_lp;
end;
$$;

create or replace function upsert_leadership_profile(
  p_actor_id uuid, p_target_id uuid,
  p_ii_attr smallint, p_ii_behav smallint, p_ic smallint, p_im smallint, p_is smallint,
  p_improvements text, p_weaknesses text, p_strengths text
) returns void
language plpgsql security definer
as $$
declare v_actor_role text;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role not in ('sudo','admin') then raise exception 'No autorizado'; end if;

  insert into leadership_profiles (
    user_id, idealized_influence_attributes, idealized_influence_behaviors,
    individualized_consideration, inspirational_motivation, intellectual_stimulation,
    improvement_notes, weaknesses, strengths, updated_by, updated_at
  ) values (
    p_target_id, p_ii_attr, p_ii_behav, p_ic, p_im, p_is,
    p_improvements, p_weaknesses, p_strengths, p_actor_id, now()
  )
  on conflict (user_id) do update set
    idealized_influence_attributes = excluded.idealized_influence_attributes,
    idealized_influence_behaviors  = excluded.idealized_influence_behaviors,
    individualized_consideration   = excluded.individualized_consideration,
    inspirational_motivation       = excluded.inspirational_motivation,
    intellectual_stimulation       = excluded.intellectual_stimulation,
    improvement_notes = excluded.improvement_notes,
    weaknesses         = excluded.weaknesses,
    strengths           = excluded.strengths,
    updated_by = excluded.updated_by,
    updated_at = now();
end;
$$;

-- ----------------------------------------------------------------------
-- 10. ASISTENCIA POR QR
-- ----------------------------------------------------------------------
create or replace function register_attendance(p_actor_id uuid, p_qr_code text)
returns json
language plpgsql security definer
as $$
declare v_actor_role text; v_target users%rowtype; v_already boolean; v_points int;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role not in ('sudo','admin') then
    raise exception 'No autorizado para registrar asistencia';
  end if;

  select * into v_target from users where qr_code = p_qr_code and active = true;
  if not found then
    raise exception 'Código QR no reconocido';
  end if;

  select exists(
    select 1 from attendance where user_id = v_target.id and attendance_date = current_date
  ) into v_already;

  if v_already then
    return json_build_object('status', 'duplicate', 'full_name', v_target.full_name, 'points', v_target.points);
  end if;

  insert into attendance (user_id, attendance_date, scanned_by)
  values (v_target.id, current_date, p_actor_id);

  update users set points = points + 1 where id = v_target.id returning points into v_points;

  return json_build_object('status', 'ok', 'full_name', v_target.full_name, 'points', v_points);
end;
$$;

create or replace function get_attendance_history(p_actor_id uuid, p_target_id uuid default null, p_limit int default 200)
returns table(user_id uuid, full_name text, attendance_date date, created_at timestamptz)
language plpgsql security definer
as $$
declare v_actor_role text; v_filter uuid; v_use_filter boolean;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role in ('sudo','admin') then
    v_filter := p_target_id;
    v_use_filter := (p_target_id is not null);
  elsif p_target_id is null or p_target_id = p_actor_id then
    v_filter := p_actor_id;
    v_use_filter := true;
  else
    raise exception 'No autorizado';
  end if;

  return query
    select a.user_id, u.full_name, a.attendance_date, a.created_at
    from attendance a join users u on u.id = a.user_id
    where (not v_use_filter) or a.user_id = v_filter
    order by a.attendance_date desc, a.created_at desc
    limit p_limit;
end;
$$;

create or replace function get_dashboard_stats(p_actor_id uuid)
returns json
language plpgsql security definer
as $$
declare v_actor_role text; v_today int; v_total_users int; v_total_points bigint;
begin
  v_actor_role := _get_role(p_actor_id);
  if v_actor_role not in ('sudo','admin') then raise exception 'No autorizado'; end if;

  select count(*) into v_today from attendance where attendance_date = current_date;
  select count(*) into v_total_users from users where active = true and role_id = 3;
  select coalesce(sum(points),0) into v_total_points from users where role_id = 3;

  return json_build_object(
    'today_attendance', v_today,
    'total_volunteers', v_total_users,
    'total_points', v_total_points
  );
end;
$$;

-- ----------------------------------------------------------------------
-- 11. USUARIO SUDO INICIAL
--     ⚠️ Cambia esta contraseña apenas inicies sesión por primera vez.
--     Email:    sudo@gacip.org
--     Password: Gacip#2026
-- ----------------------------------------------------------------------
insert into users (full_name, email, password_hash, role_id)
values ('Administrador Sudo', 'sudo@gacip.org', crypt('Gacip#2026', gen_salt('bf')), 1)
on conflict (email) do nothing;

insert into leadership_profiles (user_id)
select id from users where email = 'sudo@gacip.org'
on conflict (user_id) do nothing;

-- ======================================================================
-- FIN DEL SCRIPT
-- ======================================================================
