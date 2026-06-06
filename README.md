# 毛毛AI Streamlit 助手

毛毛AI 是一个基于 Streamlit、OpenAI 和 Supabase 的多用户 AI 助手，支持注册登录、长期记忆、图片分析、套餐额度、Token 统计、支付接口预留和管理后台。

## 核心功能

- 用户注册 / 登录：用户名、邮箱、密码
- 密码哈希加密保存：不保存明文密码
- 每个用户独立 `user_id`
- 每个用户独立 `chat_history`、`memories`、`usage_logs`
- 模型选择：`gpt-5` / `gpt-5.5` / `gpt-5-mini`
- 图片上传后自动分析
- 输入 `记住xxx` 自动写入长期记忆
- 输入 `忘记xxx` 自动删除相关长期记忆
- 套餐系统：免费版、普通版、高级版
- 每日 / 每月使用次数限制
- 每日 / 每月 Token 限制
- `usage_logs` 记录每次 GPT 调用的 token 消耗
- 支付接口预留：支付宝、微信支付按钮占位
- 管理后台：查看用户、修改套餐和额度、禁用用户、清空聊天记录

## Streamlit Secrets

在 Streamlit Cloud 的 Secrets 中配置：

```toml
APP_SECRET = "请填写一个随机长字符串"
OPENAI_API_KEY = "你的 OpenAI API Key"
SUPABASE_URL = "https://你的项目.supabase.co"
SUPABASE_KEY = "你的 Supabase service_role key"
SUPABASE_SCHEMA = "public"

# 可选：未来接入真实支付网关时替换
PAYMENT_GATEWAY_URL = "https://example.com/pay"
ALIPAY_APP_ID = ""
WECHAT_PAY_MCH_ID = ""
```

安全要求：

- `SUPABASE_KEY` 必须使用 `service_role key`，不要使用 anon key
- `service_role key` 只放在 Streamlit Secrets，不要写进 GitHub
- `SUPABASE_URL` 填项目根地址，例如 `https://xxxx.supabase.co`
- 不要在页面上显示完整密钥

## Supabase SQL

在 Supabase SQL Editor 中执行下面脚本。它可以重复执行，会自动补齐旧表缺失字段。

```sql
create extension if not exists pgcrypto;

create table if not exists public.users (
  id bigint generated always as identity primary key,
  user_id text,
  username text,
  email text,
  password_hash text,
  password_salt text,
  plan text default 'free',
  plan_id text default 'free',
  expire_at timestamptz,
  daily_limit integer default 20,
  token_limit integer default 50000,
  monthly_limit integer default 300,
  monthly_token_limit integer default 1000000,
  is_admin boolean default false,
  disabled boolean default false,
  created_at timestamptz default now()
);

alter table public.users add column if not exists user_id text;
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
alter table public.users add column if not exists is_admin boolean default false;
alter table public.users add column if not exists disabled boolean default false;
alter table public.users add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'password'
  ) then
    alter table public.users alter column password drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'plan_id' and data_type <> 'text'
  ) then
    alter table public.users alter column plan_id type text using plan_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'plan' and data_type <> 'text'
  ) then
    alter table public.users alter column plan type text using plan::text;
  end if;
end $$;

update public.users set user_id = gen_random_uuid()::text where user_id is null;
update public.users set plan_id = coalesce(nullif(plan_id, ''), nullif(plan, ''), 'free');
update public.users set plan = coalesce(nullif(plan, ''), plan_id, 'free');
update public.users set daily_limit = coalesce(daily_limit, 20);
update public.users set token_limit = coalesce(token_limit, 50000);
update public.users set monthly_limit = coalesce(monthly_limit, 300);
update public.users set monthly_token_limit = coalesce(monthly_token_limit, 1000000);
update public.users set is_admin = coalesce(is_admin, false);
update public.users set disabled = coalesce(disabled, false);

create unique index if not exists users_user_id_unique on public.users (user_id);
create unique index if not exists users_username_unique on public.users (username);
create unique index if not exists users_email_unique on public.users (email);

create table if not exists public.plans (
  id bigint generated always as identity primary key,
  plan_id text,
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

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plans' and column_name = 'plan_id' and data_type <> 'text'
  ) then
    alter table public.plans alter column plan_id type text using plan_id::text;
  end if;
end $$;

create unique index if not exists plans_plan_id_unique on public.plans (plan_id);

insert into public.plans (
  plan_id, name, price, billing_cycle,
  daily_limit, token_limit, monthly_limit, monthly_token_limit, description
)
values
  ('free', '免费版', 0, 'free', 20, 50000, 300, 1000000, '适合试用，每日和每月额度较低。'),
  ('basic', '普通版', 29, 'monthly', 300, 1000000, 6000, 20000000, '适合日常高频使用。'),
  ('pro', '高级版', 99, 'monthly', 1000, 5000000, 30000, 100000000, '适合重度使用和商业场景。')
on conflict (plan_id) do update set
  name = excluded.name,
  price = excluded.price,
  billing_cycle = excluded.billing_cycle,
  daily_limit = excluded.daily_limit,
  token_limit = excluded.token_limit,
  monthly_limit = excluded.monthly_limit,
  monthly_token_limit = excluded.monthly_token_limit,
  description = excluded.description;

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  user_id text not null,
  plan_id text not null,
  amount numeric(10, 2) default 0,
  status text default 'pending',
  method text default 'placeholder',
  created_at timestamptz default now()
);

alter table public.payments add column if not exists user_id text;
alter table public.payments add column if not exists plan_id text;
alter table public.payments add column if not exists amount numeric(10, 2) default 0;
alter table public.payments add column if not exists status text default 'pending';
alter table public.payments add column if not exists method text default 'placeholder';
alter table public.payments add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'plan_id' and data_type <> 'text'
  ) then
    alter table public.payments alter column plan_id type text using plan_id::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'plan'
  ) then
    alter table public.payments alter column plan drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments' and column_name = 'provider'
  ) then
    alter table public.payments alter column provider drop not null;
  end if;
end $$;

create table if not exists public.chat_history (
  id bigint generated always as identity primary key,
  user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists public.memories (
  id bigint generated always as identity primary key,
  user_id text not null,
  memory text not null,
  created_at timestamptz default now()
);

create table if not exists public.usage_logs (
  id bigint generated always as identity primary key,
  user_id text,
  model text,
  prompt_tokens integer default 0,
  completion_tokens integer default 0,
  total_tokens integer default 0,
  created_at timestamptz default now()
);

create index if not exists chat_history_user_id_id_idx on public.chat_history (user_id, id);
create index if not exists memories_user_id_id_idx on public.memories (user_id, id);
create index if not exists usage_logs_user_id_created_at_idx on public.usage_logs (user_id, created_at desc);
create index if not exists payments_user_id_created_at_idx on public.payments (user_id, created_at desc);

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

alter table public.users disable row level security;
alter table public.plans disable row level security;
alter table public.payments disable row level security;
alter table public.chat_history disable row level security;
alter table public.memories disable row level security;
alter table public.usage_logs disable row level security;

notify pgrst, 'reload schema';
```

## 首个管理员

先注册一个普通账号，然后在 Supabase SQL Editor 中执行：

```sql
update public.users
set is_admin = true
where email = '你的邮箱@example.com';
```

重新登录后会看到“管理后台”。

## 支付接口预留

当前 `app.py` 会在点击“支付宝开通”或“微信支付开通”时向 `payments` 表写入一条 `pending` 记录：

- `user_id`
- `plan_id`
- `amount`
- `status`
- `method`
- `created_at`

未来接入真实支付时，把 `PAYMENT_GATEWAY_URL` 替换为真实网关地址，并在支付回调中把 `payments.status` 更新为 `paid`，再更新用户的 `plan_id`、`daily_limit`、`token_limit`、`monthly_limit`、`monthly_token_limit`。

## 部署前测试步骤

1. 在 Supabase SQL Editor 执行上面的完整 SQL。
2. 在 Streamlit Secrets 配置 `APP_SECRET`、`OPENAI_API_KEY`、`SUPABASE_URL`、`SUPABASE_KEY`、`SUPABASE_SCHEMA`。
3. 确认 `SUPABASE_KEY` 是 `service_role key`，不是 anon key。
4. 重启 Streamlit Cloud 应用。
5. 注册一个新用户，确认 `users` 表新增记录，且 `plan_id = 'free'`。
6. 登录该用户，发送一条聊天消息，确认 `chat_history` 和 `usage_logs` 写入。
7. 输入 `记住我喜欢简洁回答`，确认 `memories` 写入。
8. 刷新页面，确认聊天记录和长期记忆仍正常显示。
9. 上传一张图片，确认会自动触发图片分析。
10. 将该用户设置为管理员，重新登录后进入管理后台，测试修改套餐、额度、禁用用户、清空聊天记录。

## 常见问题

- `SUPABASE_KEY 当前是 anon key`：请在 Streamlit Secrets 改为 service_role key。
- `读取 users 失败：404`：确认表在 `public` schema 下，并执行 `notify pgrst, 'reload schema';`。
- 支付按钮只写入 pending 记录：这是预留接口，当前不会真实扣款。
