create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- First account ever created becomes admin; later signups get no admin access.
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_role after insert on auth.users
for each row execute function public.handle_new_user_role();

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null check (char_length(client_name) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  destination_url text not null check (destination_url ~* '^https?://[^\s]+$' and char_length(destination_url) <= 2048),
  notes text check (notes is null or char_length(notes) <= 2000),
  is_active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.redirects to authenticated;
grant all on public.redirects to service_role;
alter table public.redirects enable row level security;
create policy "Admins manage redirects" on public.redirects for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Slug is permanent once created
create or replace function public.redirects_guard()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.slug <> old.slug then raise exception 'Slug is permanent and cannot be changed'; end if;
  new.updated_at = now();
  return new;
end $$;
create trigger redirects_guard before update on public.redirects
for each row execute function public.redirects_guard();

create table public.redirect_clicks (
  id bigserial primary key,
  redirect_id uuid not null references public.redirects(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  device text not null default 'unknown',
  referrer_host text
);
create index on public.redirect_clicks(redirect_id, clicked_at desc);
grant select on public.redirect_clicks to authenticated;
grant all on public.redirect_clicks to service_role;
alter table public.redirect_clicks enable row level security;
create policy "Admins read clicks" on public.redirect_clicks for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Public resolver: returns destination for an active slug and logs an anonymous click
create or replace function public.resolve_redirect(_slug text, _device text, _referrer_host text)
returns text language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  select id, destination_url into r from public.redirects where slug = lower(_slug) and is_active limit 1;
  if r.id is null then return null; end if;
  insert into public.redirect_clicks(redirect_id, device, referrer_host)
  values (r.id,
    case when _device in ('mobile','tablet','desktop','bot') then _device else 'unknown' end,
    left(nullif(_referrer_host,''), 253));
  return r.destination_url;
end $$;
revoke all on function public.resolve_redirect(text,text,text) from public;
grant execute on function public.resolve_redirect(text,text,text) to anon, authenticated;

insert into public.redirects(client_name, slug, destination_url, notes, is_demo)
values ('DEMO — Testing only', 'demo', 'https://www.google.com/', 'Demo redirect for testing only. Not a real client.', true);