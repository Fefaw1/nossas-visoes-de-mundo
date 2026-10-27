-- NOSSAS VISÕES DE MUNDO — instalação do banco (Supabase > SQL Editor > New query)
-- Execute ESTE ARQUIVO inteiro apenas uma vez, em um projeto Supabase novo.
-- O código habilita RLS: visitantes não conseguem ler debates sem participar da sala.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Nosso espaço',
  invite_code text not null unique default encode(extensions.gen_random_bytes(16),'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 36),
  avatar_path text,
  joined_at timestamptz not null default now(),
  primary key(room_id, user_id)
);

create table public.debates (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 5 and 140),
  category text not null default 'Outros',
  description text not null default '' check (char_length(description) <= 1200),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 6000),
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.common_points (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  confirmed_by uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 3 and 600),
  created_at timestamptz not null default now()
);

create index debates_room_time on public.debates(room_id,created_at desc);
create index messages_debate_time on public.messages(debate_id,created_at);
create index common_debate_time on public.common_points(debate_id,created_at);

-- Função privilegiada que APENAS verifica participação, sem expor dados.
create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.members m where m.room_id = p_room and m.user_id = (select auth.uid())); $$;

create or replace function public.is_debate_member(p_debate uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.debates d join public.members m on m.room_id=d.room_id where d.id=p_debate and m.user_id=(select auth.uid())); $$;

-- Cria sala e sua primeira participação de forma atômica.
create or replace function public.is_debate_open_member(p_debate uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.debates d join public.members m on m.room_id=d.room_id where d.id=p_debate and d.status='open' and m.user_id=(select auth.uid())); $$;

create or replace function public.create_couple_room(p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_room uuid; v_name text := trim(p_name);
begin
  if v_user is null then raise exception 'Faça login primeiro.'; end if;
  if char_length(v_name) not between 2 and 36 then raise exception 'O nome precisa ter 2 a 36 caracteres.'; end if;
  if exists(select 1 from public.members where user_id=v_user) then raise exception 'Você já participa de uma sala.'; end if;
  insert into public.rooms(created_by) values(v_user) returning id into v_room;
  insert into public.members(room_id,user_id,display_name) values(v_room,v_user,v_name);
  return v_room;
end; $$;

-- Entrar com código secreto. Bloqueia a linha, evitando mais de 2 participantes.
create or replace function public.join_couple_room(p_code text,p_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_room uuid; v_name text := trim(p_name);
begin
  if v_user is null then raise exception 'Faça login primeiro.'; end if;
  if char_length(v_name) not between 2 and 36 then raise exception 'O nome precisa ter 2 a 36 caracteres.'; end if;
  if exists(select 1 from public.members where user_id=v_user) then raise exception 'Você já participa de uma sala.'; end if;
  select r.id into v_room from public.rooms r where r.invite_code=lower(trim(p_code)) for update;
  if v_room is null then raise exception 'Código inválido.'; end if;
  if (select count(*) from public.members where room_id=v_room) >= 2 then raise exception 'Esta sala já tem duas pessoas.'; end if;
  insert into public.members(room_id,user_id,display_name) values(v_room,v_user,v_name);
  return v_room;
end; $$;

-- Uma resposta só pode apontar para mensagem do MESMO debate.
create or replace function public.validate_message_reply()
returns trigger language plpgsql set search_path = ''
as $$
begin
 if new.reply_to is not null and not exists(select 1 from public.messages m where m.id=new.reply_to and m.debate_id=new.debate_id) then
   raise exception 'A resposta precisa pertencer ao mesmo debate.';
 end if;
 return new;
end; $$;
create trigger validate_message_parent before insert or update on public.messages
for each row execute function public.validate_message_reply();

-- Somente usuários autenticados acessam funções de criação/consulta.
revoke all on function public.is_room_member(uuid) from public,anon;
revoke all on function public.is_debate_member(uuid) from public,anon;
revoke all on function public.is_debate_open_member(uuid) from public,anon;
revoke all on function public.create_couple_room(text) from public,anon;
revoke all on function public.join_couple_room(text,text) from public,anon;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.is_debate_member(uuid) to authenticated;
grant execute on function public.is_debate_open_member(uuid) to authenticated;
grant execute on function public.create_couple_room(text) to authenticated;
grant execute on function public.join_couple_room(text,text) to authenticated;

alter table public.rooms enable row level security;
alter table public.members enable row level security;
alter table public.debates enable row level security;
alter table public.messages enable row level security;
alter table public.common_points enable row level security;

create policy "Sala visível apenas para os dois participantes"
on public.rooms for select to authenticated using (public.is_room_member(id));

create policy "Membros visíveis somente entre participantes da sala"
on public.members for select to authenticated using (public.is_room_member(room_id));
create policy "Editar apenas meu próprio perfil"
on public.members for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy "Ver debates da própria sala"
on public.debates for select to authenticated using (public.is_room_member(room_id));
create policy "Criar debates na própria sala"
on public.debates for insert to authenticated
with check (author_id=(select auth.uid()) and public.is_room_member(room_id));
create policy "Participantes podem reabrir e encerrar"
on public.debates for update to authenticated
using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));

create policy "Ver respostas dos próprios debates"
on public.messages for select to authenticated using (public.is_debate_member(debate_id));
create policy "Comentar nos próprios debates"
on public.messages for insert to authenticated
with check (author_id=(select auth.uid()) and public.is_debate_open_member(debate_id));

create policy "Ver pontos em comum"
on public.common_points for select to authenticated using (public.is_debate_member(debate_id));
create policy "Registrar pontos em comum"
on public.common_points for insert to authenticated
with check (author_id=(select auth.uid()) and confirmed_by is null and public.is_debate_open_member(debate_id));
create policy "A outra pessoa pode confirmar propostas"
on public.common_points for update to authenticated
using (confirmed_by is null and author_id <> (select auth.uid()) and public.is_debate_member(debate_id))
with check (confirmed_by = (select auth.uid()) and author_id <> (select auth.uid()) and public.is_debate_member(debate_id));

-- Privilégios explícitos por coluna: membros não podem editar sala, autor, mensagens antigas.
revoke all on public.rooms,public.members,public.debates,public.messages,public.common_points from anon,authenticated;
grant select on public.rooms,public.members,public.debates,public.messages,public.common_points to authenticated;
grant update(display_name,avatar_path) on public.members to authenticated;
grant insert on public.debates,public.messages,public.common_points to authenticated;
grant update(status) on public.debates to authenticated;
grant update(confirmed_by) on public.common_points to authenticated;

-- Bucket PRIVADO para fotos. Não é necessário criá-lo manualmente.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('couple-avatars','couple-avatars',false,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;

create policy "Participantes da sala podem ler avatares" on storage.objects
for select to authenticated using (
 bucket_id='couple-avatars' and (
  (storage.foldername(name))[1] = (select auth.uid())::text
  or exists (
    select 1 from public.members me join public.members partner on me.room_id=partner.room_id
    where me.user_id=(select auth.uid()) and partner.user_id::text=(storage.foldername(name))[1]
  )
 )
);
create policy "Cada pessoa envia só seu avatar" on storage.objects
for insert to authenticated with check (
 bucket_id='couple-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy "Cada pessoa troca só seu avatar" on storage.objects
for update to authenticated using (
 bucket_id='couple-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
) with check (
 bucket_id='couple-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
);
