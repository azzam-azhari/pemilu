-- Migration: Allow flexible election status edits (draft <-> open <-> closed)
-- Enables reopening closed elections and editing election details while closed

create or replace function public.guard_election_status() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'Hanya Draft dapat dihapus'; end if;
    return old;
  end if;
  if new.status<>old.status then
    -- Admin diperbolehkan mengubah status antara draft, open, dan closed (termasuk membuka kembali pemilihan yang sudah closed)
    if new.status='open' and (
      not exists(select 1 from public.positions where election_id=new.id) or 
      exists(select 1 from public.positions p where p.election_id=new.id and not exists(select 1 from public.candidates c where c.position_id=p.id))
    ) then 
      raise exception 'Isi jabatan dan kandidat sebelum membuka pemilu'; 
    end if;
  end if;
  return new;
end $$;
