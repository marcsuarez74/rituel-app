-- Rituel — souscriptions push (spec 2026-09-18). Exécutable dans l'éditeur SQL Supabase.
-- Une row par appareil (device_id = uuid par installation) ; ré-inscription = upsert.
-- derniers_creneaux : dédup cron, géré côté serveur — { type: 'YYYY-MM-DD' (tz locale) }.

create table if not exists push_subscriptions (
  household_id uuid not null references households on delete cascade,
  device_id text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  profil text not null check (profil in ('marc', 'melanie')),
  tz text not null,
  config jsonb not null default '{}'::jsonb,
  derniers_creneaux jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (household_id, device_id)
);

alter table push_subscriptions enable row level security;

drop policy if exists foyer_push_subscriptions on push_subscriptions;
create policy foyer_push_subscriptions on push_subscriptions for all
  using (household_id::text = auth.jwt()->>'household_id')
  with check (household_id::text = auth.jwt()->>'household_id');
