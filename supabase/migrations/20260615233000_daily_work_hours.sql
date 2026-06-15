begin;

create table if not exists public.employee_work_hours (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  project_id uuid not null references public.internal_projects(id) on delete cascade,
  work_date date not null default current_date,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  hourly_rate numeric(12,2) not null check (hourly_rate >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, project_id, work_date)
);

create index if not exists employee_work_hours_date_idx
on public.employee_work_hours(work_date desc, employee_id);

drop trigger if exists employee_work_hours_updated_at on public.employee_work_hours;
create trigger employee_work_hours_updated_at
before update on public.employee_work_hours
for each row execute function public.set_updated_at();

alter table public.employee_work_hours enable row level security;

drop policy if exists organizer_admin_all on public.employee_work_hours;
create policy organizer_admin_all on public.employee_work_hours
for all to authenticated
using (public.is_organizer_admin())
with check (public.is_organizer_admin());

insert into public.employee_work_hours (
  employee_id,
  project_id,
  work_date,
  hours,
  hourly_rate,
  note
)
select
  pw.employee_id,
  pw.project_id,
  coalesce(ip.start_date, pw.created_at::date),
  pw.hours_worked,
  e.hourly_rate,
  nullif(concat_ws(' · ', 'Preneseno iz stare ukupne evidencije', pw.note), '')
from public.project_workers pw
join public.employees e on e.id = pw.employee_id
join public.internal_projects ip on ip.id = pw.project_id
where pw.hours_worked > 0
  and pw.agreed_amount = 0
on conflict (employee_id, project_id, work_date) do nothing;

create or replace function public.sync_project_worker_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_employee uuid;
  affected_project uuid;
begin
  if tg_op = 'DELETE' then
    affected_employee := old.employee_id;
    affected_project := old.project_id;
  else
    affected_employee := new.employee_id;
    affected_project := new.project_id;
  end if;

  if tg_op <> 'DELETE' then
    insert into public.project_workers (project_id, employee_id, hours_worked)
    values (affected_project, affected_employee, 0)
    on conflict (project_id, employee_id) do nothing;
  end if;

  update public.project_workers
  set hours_worked = coalesce((
    select sum(hours)
    from public.employee_work_hours
    where employee_id = affected_employee
      and project_id = affected_project
  ), 0)
  where employee_id = affected_employee
    and project_id = affected_project;

  if tg_op = 'UPDATE'
    and (old.employee_id, old.project_id) is distinct from (new.employee_id, new.project_id) then
    update public.project_workers
    set hours_worked = coalesce((
      select sum(hours)
      from public.employee_work_hours
      where employee_id = old.employee_id
        and project_id = old.project_id
    ), 0)
    where employee_id = old.employee_id
      and project_id = old.project_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists employee_work_hours_sync_project on public.employee_work_hours;
create trigger employee_work_hours_sync_project
after insert or update or delete on public.employee_work_hours
for each row execute function public.sync_project_worker_hours();

update public.project_workers pw
set hours_worked = coalesce((
  select sum(wh.hours)
  from public.employee_work_hours wh
  where wh.employee_id = pw.employee_id
    and wh.project_id = pw.project_id
), pw.hours_worked)
where pw.agreed_amount = 0;

commit;
