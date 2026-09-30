begin;
create table if not exists public.sr_pedidos (
 id uuid primary key default gen_random_uuid(), nombre text not null, telefono text not null,
 correo text, tipo text not null check(tipo in ('Normal','Doble','Premium')),
 numeros integer[] not null, total integer not null check(total>0),
 estado text not null default 'Pendiente' check(estado in ('Pendiente','Pagado','Cancelado')),
 creado timestamptz not null default now(), pagado timestamptz, confirmado_por text
);
create table if not exists public.sr_boletos (
 numero integer primary key check(numero between 0 and 99999), pedido uuid not null references public.sr_pedidos(id)
);
alter table public.sr_pedidos enable row level security;
alter table public.sr_boletos enable row level security;
revoke all on public.sr_pedidos,public.sr_boletos from anon,authenticated;
grant all on public.sr_pedidos,public.sr_boletos to service_role;
create or replace function public.sr_reservar(p_nombre text,p_telefono text,p_correo text,p_tipo text,p_numeros integer[])
returns public.sr_pedidos language plpgsql set search_path=public as $$
declare r public.sr_pedidos; precio integer;
begin
 perform pg_advisory_xact_lock(8819001);
 precio := case p_tipo when 'Normal' then 10 when 'Doble' then 25 when 'Premium' then 35 else null end;
 if precio is null or cardinality(p_numeros) not between 1 and 500 or length(trim(p_nombre)) not between 3 and 120 or p_telefono !~ '^[0-9]{10,15}$' then raise exception 'Datos inválidos'; end if;
 if exists(select 1 from unnest(p_numeros) n where n is null or n<0 or n>99999) or (select count(distinct n) from unnest(p_numeros) n) <> cardinality(p_numeros) then raise exception 'Números inválidos'; end if;
 if exists(select 1 from public.sr_boletos where numero=any(p_numeros)) then raise exception 'Uno o más boletos ya están apartados'; end if;
 insert into public.sr_pedidos(nombre,telefono,correo,tipo,numeros,total) values(trim(p_nombre),p_telefono,p_correo,p_tipo,p_numeros,cardinality(p_numeros)*precio) returning * into r;
 insert into public.sr_boletos(numero,pedido) select n,r.id from unnest(p_numeros) n;
 return r;
end $$;
create or replace function public.sr_estado(p_id uuid,p_estado text,p_admin text)
returns public.sr_pedidos language plpgsql set search_path=public as $$
declare r public.sr_pedidos;
begin
 perform pg_advisory_xact_lock(8819001);
 select * into r from public.sr_pedidos where id=p_id for update;
 if not found then raise exception 'Pedido no encontrado'; end if;
 if p_estado not in ('Pagado','Cancelado') then raise exception 'Estado inválido'; end if;
 if r.estado=p_estado then return r; end if;
 if r.estado<>'Pendiente' then raise exception 'Solo se pueden cambiar pedidos pendientes'; end if;
 if p_estado='Cancelado' then delete from public.sr_boletos where pedido=p_id; end if;
 update public.sr_pedidos set estado=p_estado,pagado=case when p_estado='Pagado' then now() else null end,confirmado_por=p_admin where id=p_id returning * into r;
 return r;
end $$;
revoke all on function public.sr_reservar(text,text,text,text,integer[]) from public,anon,authenticated;
revoke all on function public.sr_estado(uuid,text,text) from public,anon,authenticated;
grant execute on function public.sr_reservar(text,text,text,text,integer[]),public.sr_estado(uuid,text,text) to service_role;
commit;
