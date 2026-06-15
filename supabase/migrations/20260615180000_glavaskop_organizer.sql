begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.profiles (id, email, role)
select id, email, case when lower(email) = 'davidglavocevic@gmail.com' then 'owner' else 'user' end
from auth.users
on conflict (id) do update
set email = excluded.email,
    role = case
      when lower(excluded.email) = 'davidglavocevic@gmail.com' then 'owner'
      else public.profiles.role
    end;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case when lower(new.email) = 'davidglavocevic@gmail.com' then 'owner' else 'user' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_organizer_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'owner')
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  role text,
  hourly_rate numeric(12,2) not null default 0 check (hourly_rate >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text,
  job_type text,
  price numeric(14,2) not null default 0 check (price >= 0),
  estimated_duration text,
  status text not null default 'planned' check (status in ('planned','active','finished','paid','cancelled')),
  description text,
  start_date date,
  end_date date,
  yard_length numeric(12,2) check (yard_length is null or yard_length >= 0),
  yard_width numeric(12,2) check (yard_width is null or yard_width >= 0),
  excavation_depth numeric(12,2) check (excavation_depth is null or excavation_depth >= 0),
  area_m2 numeric(14,2) generated always as (
    case when yard_length is not null and yard_width is not null then yard_length * yard_width end
  ) stored,
  excavation_volume_m3 numeric(14,2) generated always as (
    case when yard_length is not null and yard_width is not null and excavation_depth is not null
      then yard_length * yard_width * excavation_depth end
  ) stored,
  extra_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_workers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.internal_projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  hours_worked numeric(12,2) not null default 0 check (hours_worked >= 0),
  agreed_amount numeric(14,2) not null default 0 check (agreed_amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, employee_id)
);

create table if not exists public.employee_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  project_id uuid references public.internal_projects(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.internal_projects(id) on delete set null,
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  category text,
  expense_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.internal_projects(id) on delete cascade,
  file_name text not null,
  original_file_name text,
  storage_bucket text not null default 'private-project-files',
  storage_path text not null unique,
  file_type text,
  mime_type text,
  file_size_bytes bigint,
  original_size_bytes bigint,
  compressed_size_bytes bigint,
  is_image boolean not null default false,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  is_private boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  all_day boolean not null default false,
  location text,
  type text not null default 'work' check (type in ('work','meeting','reminder','deadline','private','equipment','holiday')),
  status text not null default 'planned' check (status in ('planned','done','cancelled')),
  reminder_minutes integer not null default 15 check (reminder_minutes >= 0),
  reminder_enabled boolean not null default true,
  project_id uuid references public.internal_projects(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or end_time >= start_time)
);

create table if not exists public.calendar_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  remind_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending','sent','cancelled','failed')),
  channel text not null default 'browser',
  created_at timestamptz not null default now(),
  unique(event_id, channel)
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  country text not null default 'HR',
  all_day boolean not null default true,
  type text not null default 'holiday',
  is_public_holiday boolean not null default true,
  created_at timestamptz not null default now(),
  unique(date, country)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create index if not exists project_workers_employee_idx on public.project_workers(employee_id);
create index if not exists payments_employee_date_idx on public.employee_payments(employee_id, paid_at);
create index if not exists expenses_project_date_idx on public.expenses(project_id, expense_date);
create index if not exists files_project_idx on public.project_files(project_id, sort_order);
create index if not exists events_start_idx on public.calendar_events(start_time);
create index if not exists reminders_due_idx on public.calendar_reminders(status, remind_at) where sent_at is null;

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at before update on public.employees
for each row execute function public.set_updated_at();
drop trigger if exists internal_projects_updated_at on public.internal_projects;
create trigger internal_projects_updated_at before update on public.internal_projects
for each row execute function public.set_updated_at();
drop trigger if exists project_workers_updated_at on public.project_workers;
create trigger project_workers_updated_at before update on public.project_workers
for each row execute function public.set_updated_at();
drop trigger if exists project_files_updated_at on public.project_files;
create trigger project_files_updated_at before update on public.project_files
for each row execute function public.set_updated_at();
drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at before update on public.calendar_events
for each row execute function public.set_updated_at();
drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
for each row execute function public.set_updated_at();

create or replace function public.sync_calendar_reminder()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.reminder_enabled and new.status = 'planned' and new.type <> 'holiday' then
    insert into public.calendar_reminders (event_id, remind_at, status, sent_at, channel)
    values (new.id, new.start_time - make_interval(mins => new.reminder_minutes), 'pending', null, 'browser')
    on conflict (event_id, channel) do update
    set remind_at = excluded.remind_at, status = 'pending', sent_at = null;
  else
    update public.calendar_reminders
    set status = 'cancelled'
    where event_id = new.id and channel = 'browser';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_event_reminder_sync on public.calendar_events;
create trigger calendar_event_reminder_sync
after insert or update of start_time, reminder_minutes, reminder_enabled, status
on public.calendar_events
for each row execute function public.sync_calendar_reminder();

insert into public.holidays (date, name) values
  ('2026-01-01', 'Nova godina'),
  ('2026-01-06', 'Bogojavljenje / Sveta tri kralja'),
  ('2026-04-05', 'Uskrs'),
  ('2026-04-06', 'Uskrsni ponedjeljak'),
  ('2026-05-01', 'Praznik rada'),
  ('2026-05-30', 'Dan državnosti'),
  ('2026-06-04', 'Tijelovo'),
  ('2026-06-22', 'Dan antifašističke borbe'),
  ('2026-08-05', 'Dan pobjede i domovinske zahvalnosti i Dan hrvatskih branitelja'),
  ('2026-08-15', 'Velika Gospa'),
  ('2026-11-01', 'Svi sveti'),
  ('2026-11-18', 'Dan sjećanja na žrtve Domovinskog rata i Dan sjećanja na žrtvu Vukovara i Škabrnje'),
  ('2026-12-25', 'Božić'),
  ('2026-12-26', 'Sveti Stjepan')
on conflict (date, country) do update set name = excluded.name;

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.internal_projects enable row level security;
alter table public.project_workers enable row level security;
alter table public.employee_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.project_files enable row level security;
alter table public.calendar_events enable row level security;
alter table public.calendar_reminders enable row level security;
alter table public.holidays enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'employees','internal_projects','project_workers','employee_payments','expenses',
    'project_files','calendar_events','calendar_reminders','holidays','push_subscriptions'
  ]
  loop
    execute format('drop policy if exists organizer_admin_all on public.%I', table_name);
    execute format(
      'create policy organizer_admin_all on public.%I for all to authenticated using (public.is_organizer_admin()) with check (public.is_organizer_admin())',
      table_name
    );
  end loop;
end
$$;

drop policy if exists profiles_owner_read on public.profiles;
create policy profiles_owner_read on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_organizer_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-project-files',
  'private-project-files',
  false,
  20971520,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists organizer_private_files_select on storage.objects;
create policy organizer_private_files_select on storage.objects
for select to authenticated
using (bucket_id = 'private-project-files' and public.is_organizer_admin());
drop policy if exists organizer_private_files_insert on storage.objects;
create policy organizer_private_files_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'private-project-files' and public.is_organizer_admin());
drop policy if exists organizer_private_files_update on storage.objects;
create policy organizer_private_files_update on storage.objects
for update to authenticated
using (bucket_id = 'private-project-files' and public.is_organizer_admin())
with check (bucket_id = 'private-project-files' and public.is_organizer_admin());
drop policy if exists organizer_private_files_delete on storage.objects;
create policy organizer_private_files_delete on storage.objects
for delete to authenticated
using (bucket_id = 'private-project-files' and public.is_organizer_admin());

commit;
