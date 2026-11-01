-- VEDANT AI database schema
-- Run this file in Supabase SQL Editor.
-- Row Level Security is enabled on all user-facing tables.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student','employee','manager','admin','owner')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','owner'));
$$;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  level text default 'beginner',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  cover_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  content text,
  video_url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress numeric(5,2) not null default 0 check (progress between 0 and 100),
  enrolled_at timestamptz not null default now(),
  unique(course_id,user_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  course_id uuid references public.courses(id) on delete set null,
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option integer,
  points integer not null default 1,
  position integer not null default 0
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score numeric(8,2) not null default 0,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  source text default 'direct',
  status text not null default 'new' check (status in ('new','contacted','qualified','converted','lost')),
  notes text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  job_title text,
  department text,
  employment_status text not null default 'active',
  joined_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  status text not null default 'requested' check (status in ('requested','confirmed','cancelled','completed')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.leads enable row level security;
alter table public.employees enable row level security;
alter table public.appointments enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.documents enable row level security;

-- Profiles: users see themselves; admins can see all. Role changes are not allowed from the client.
drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
-- Profile updates are intentionally disabled in this starter so users cannot
-- modify privileged fields such as role through the client.

-- Courses and lessons
drop policy if exists "courses visible" on public.courses;
create policy "courses visible" on public.courses for select using (status = 'published' or created_by = auth.uid() or public.is_admin());
drop policy if exists "course admins manage" on public.courses;
create policy "course admins manage" on public.courses for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "lessons visible through course" on public.lessons;
create policy "lessons visible through course" on public.lessons for select using (exists(select 1 from public.courses c where c.id=course_id and (c.status='published' or c.created_by=auth.uid() or public.is_admin())));
drop policy if exists "lesson admins manage" on public.lessons;
create policy "lesson admins manage" on public.lessons for all using (public.is_admin()) with check (public.is_admin());

-- Enrollments
drop policy if exists "enrollment own or admin" on public.enrollments;
create policy "enrollment own or admin" on public.enrollments for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists "enrollment create own" on public.enrollments;
create policy "enrollment create own" on public.enrollments for insert with check (user_id=auth.uid());
drop policy if exists "enrollment update own" on public.enrollments;
create policy "enrollment update own" on public.enrollments for update using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Quizzes
drop policy if exists "quiz visible" on public.quizzes;
create policy "quiz visible" on public.quizzes for select using (published or created_by=auth.uid() or public.is_admin());
drop policy if exists "quiz admin manage" on public.quizzes;
create policy "quiz admin manage" on public.quizzes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quiz questions visible" on public.quiz_questions;
create policy "quiz questions visible" on public.quiz_questions for select using (exists(select 1 from public.quizzes q where q.id=quiz_id and (q.published or q.created_by=auth.uid() or public.is_admin())));
drop policy if exists "quiz questions admin manage" on public.quiz_questions;
create policy "quiz questions admin manage" on public.quiz_questions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "quiz attempt own" on public.quiz_attempts;
create policy "quiz attempt own" on public.quiz_attempts for all using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());

-- CRM, HR, appointments
drop policy if exists "leads creator or admin" on public.leads;
create policy "leads creator or admin" on public.leads for all using (created_by=auth.uid() or public.is_admin()) with check (created_by=auth.uid() or public.is_admin());
drop policy if exists "employees admin only" on public.employees;
create policy "employees admin only" on public.employees for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "appointments creator or admin" on public.appointments;
create policy "appointments creator or admin" on public.appointments for all using (created_by=auth.uid() or public.is_admin()) with check (created_by=auth.uid() or public.is_admin());

-- Private AI conversations and uploaded-document metadata
drop policy if exists "conversations owner" on public.ai_conversations;
create policy "conversations owner" on public.ai_conversations for all using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "documents owner" on public.documents;
create policy "documents owner" on public.documents for all using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Private storage bucket for user documents. Run this after Storage is enabled.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('vedant-documents','vedant-documents',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "user upload own folder" on storage.objects;
create policy "user upload own folder" on storage.objects for insert to authenticated
with check (bucket_id='vedant-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "user read own folder" on storage.objects;
create policy "user read own folder" on storage.objects for select to authenticated
using (bucket_id='vedant-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "user delete own folder" on storage.objects;
create policy "user delete own folder" on storage.objects for delete to authenticated
using (bucket_id='vedant-documents' and (storage.foldername(name))[1]=auth.uid()::text);

-- IMPORTANT: After creating your account, promote your own profile manually in SQL Editor:
-- update public.profiles set role='owner' where id='YOUR_AUTH_USER_UUID';
