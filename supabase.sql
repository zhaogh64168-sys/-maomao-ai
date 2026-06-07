create extension if not exists pgcrypto;

create table if not exists public.users (
  id bigint generated always as identity primary key,
  user_id text default gen_random_uuid()::text,
  username text unique,
  email text unique,
  password_hash text,
  password_salt text,
  plan text default 'free',
  plan_id text default 'free',
  expire_at timestamptz,
  daily_limit integer default 20,
  token_limit integer default 50000,
  monthly_limit integer default 300,
  monthly_token_limit integer default 1000000,
  referral_code text unique,
  invited_by text,
  is_admin boolean default false,
  disabled boolean default false,
  created_at timestamptz default now()
);

alter table public.users add column if not exists user_id text default gen_random_uuid()::text;
alter table public.users add column if not exists username text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists password_hash text;
alter table public.users add column if not exists password_salt text;
alter table public.users add column if not exists plan text default 'free';
alter table public.users add column if not exists plan_id text default 'free';
alter table public.users add column if not exists expire_at timestamptz;
alter table public.users add column if not exists daily_limit integer default 20;
alter table public.users add column if not exists token_limit integer default 50000;
alter table public.users add column if not exists monthly_limit integer default 300;
alter table public.users add column if not exists monthly_token_limit integer default 1000000;
alter table public.users add column if not exists referral_code text;
alter table public.users add column if not exists invited_by text;
alter table public.users add column if not exists is_admin boolean default false;
alter table public.users add column if not exists disabled boolean default false;
alter table public.users add column if not exists created_at timestamptz default now();
update public.users set user_id = gen_random_uuid()::text where user_id is null;
create unique index if not exists users_user_id_unique on public.users (user_id);
create unique index if not exists users_username_unique on public.users (username);
create unique index if not exists users_email_unique on public.users (email);
create unique index if not exists users_referral_code_unique on public.users (referral_code);
create index if not exists users_created_at_idx on public.users (created_at desc);

create table if not exists public.plans (
  id bigint generated always as identity primary key,
  plan_id text unique not null,
  name text not null,
  price numeric(10, 2) default 0,
  billing_cycle text default 'free',
  daily_limit integer default 20,
  token_limit integer default 50000,
  monthly_limit integer default 300,
  monthly_token_limit integer default 1000000,
  description text,
  created_at timestamptz default now()
);
alter table public.plans add column if not exists plan_id text;
alter table public.plans add column if not exists price numeric(10, 2) default 0;
alter table public.plans add column if not exists billing_cycle text default 'free';
alter table public.plans add column if not exists daily_limit integer default 20;
alter table public.plans add column if not exists token_limit integer default 50000;
alter table public.plans add column if not exists monthly_limit integer default 300;
alter table public.plans add column if not exists monthly_token_limit integer default 1000000;
alter table public.plans add column if not exists description text;
alter table public.plans add column if not exists created_at timestamptz default now();
create unique index if not exists plans_plan_id_unique on public.plans (plan_id);

insert into public.plans (plan_id, name, price, billing_cycle, daily_limit, token_limit, monthly_limit, monthly_token_limit, description) values
  ('free', '免费版', 0, 'free', 20, 50000, 300, 1000000, '适合试用，含基础聊天、图片分析、图片生成和语音工具。'),
  ('monthly', '月付版', 29, 'monthly', 300, 1000000, 6000, 20000000, '适合日常高频使用，支持全部 AI 功能。'),
  ('yearly', '年付版', 299, 'yearly', 1200, 6000000, 50000, 200000000, '适合长期使用和商业场景，额度更高。')
on conflict (plan_id) do update set
  name = excluded.name,
  price = excluded.price,
  billing_cycle = excluded.billing_cycle,
  daily_limit = excluded.daily_limit,
  token_limit = excluded.token_limit,
  monthly_limit = excluded.monthly_limit,
  monthly_token_limit = excluded.monthly_token_limit,
  description = excluded.description;

create table if not exists public.conversations (
  id bigint generated always as identity primary key,
  user_id text not null,
  title text default '新对话',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists conversations_user_updated_idx on public.conversations (user_id, updated_at desc);

create table if not exists public.chat_history (
  id bigint generated always as identity primary key,
  user_id text not null,
  conversation_id bigint,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
alter table public.chat_history add column if not exists conversation_id bigint;
create index if not exists chat_history_user_conversation_idx on public.chat_history (user_id, conversation_id, id);
create index if not exists chat_history_created_at_role_idx on public.chat_history (created_at desc, role);

create table if not exists public.memories (
  id bigint generated always as identity primary key,
  user_id text not null,
  memory text not null,
  created_at timestamptz default now()
);
create index if not exists memories_user_id_idx on public.memories (user_id, id);

create table if not exists public.usage_logs (
  id bigint generated always as identity primary key,
  user_id text,
  model text,
  prompt_tokens integer default 0,
  completion_tokens integer default 0,
  total_tokens integer default 0,
  created_at timestamptz default now()
);
create index if not exists usage_logs_user_created_idx on public.usage_logs (user_id, created_at desc);
create index if not exists usage_logs_created_at_idx on public.usage_logs (created_at desc);

create table if not exists public.image_generations (
  id bigint generated always as identity primary key,
  user_id text not null,
  prompt text,
  model text,
  size text,
  image_url text,
  created_at timestamptz default now()
);
create index if not exists image_generations_user_created_idx on public.image_generations (user_id, created_at desc);

create table if not exists public.audio_logs (
  id bigint generated always as identity primary key,
  user_id text not null,
  type text,
  model text,
  text text,
  created_at timestamptz default now()
);
create index if not exists audio_logs_user_created_idx on public.audio_logs (user_id, created_at desc);

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  user_id text not null,
  plan_id text not null,
  amount numeric(10, 2) default 0,
  status text default 'pending',
  method text,
  screenshot_base64 text,
  provider_trade_no text,
  created_at timestamptz default now()
);
alter table public.payments add column if not exists method text;
alter table public.payments add column if not exists screenshot_base64 text;
alter table public.payments add column if not exists provider_trade_no text;
alter table public.payments add column if not exists status text default 'pending';
alter table public.payments add column if not exists created_at timestamptz default now();
create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);
create index if not exists payments_status_created_idx on public.payments (status, created_at desc);

create table if not exists public.email_codes (
  id bigint generated always as identity primary key,
  email text not null,
  purpose text not null,
  code_hash text not null,
  used boolean default false,
  expires_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists email_codes_email_purpose_idx on public.email_codes (email, purpose, used, created_at desc);

create table if not exists public.password_resets (
  id bigint generated always as identity primary key,
  email text not null,
  token_hash text not null,
  used boolean default false,
  expires_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists password_resets_email_idx on public.password_resets (email, used, created_at desc);

create table if not exists public.invite_codes (
  id bigint generated always as identity primary key,
  code text unique not null,
  max_uses integer default 1,
  used_count integer default 0,
  promoter_user_id text,
  disabled boolean default false,
  created_at timestamptz default now()
);
create index if not exists invite_codes_code_idx on public.invite_codes (code);

create table if not exists public.referrals (
  id bigint generated always as identity primary key,
  referrer_user_id text not null,
  referred_user_id text not null,
  invite_code text,
  created_at timestamptz default now()
);
create unique index if not exists referrals_referred_unique on public.referrals (referred_user_id);
create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id);

create table if not exists public.commissions (
  id bigint generated always as identity primary key,
  payment_id bigint,
  referrer_user_id text not null,
  referred_user_id text not null,
  amount numeric(10, 2) default 0,
  status text default 'pending',
  created_at timestamptz default now()
);
create index if not exists commissions_referrer_idx on public.commissions (referrer_user_id, status, created_at desc);
create index if not exists commissions_payment_idx on public.commissions (payment_id);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

alter table public.users disable row level security;
alter table public.plans disable row level security;
alter table public.conversations disable row level security;
alter table public.chat_history disable row level security;
alter table public.memories disable row level security;
alter table public.usage_logs disable row level security;
alter table public.image_generations disable row level security;
alter table public.audio_logs disable row level security;
alter table public.payments disable row level security;
alter table public.email_codes disable row level security;
alter table public.password_resets disable row level security;
alter table public.invite_codes disable row level security;
alter table public.referrals disable row level security;
alter table public.commissions disable row level security;

notify pgrst, 'reload schema';
