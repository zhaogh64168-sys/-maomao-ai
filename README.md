# 毛毛AI Streamlit 助手

一个基于 Streamlit、OpenAI 和 Supabase 的多用户 AI 助手，支持账号注册登录、聊天记录、长期记忆、图片分析、模型切换、会员套餐、使用统计和管理后台。代码中不保存任何 API Key，所有密钥都从 Streamlit Secrets 读取。

## 功能

- 用户注册 / 登录：用户名、邮箱、密码
- 密码哈希保存：不会明文保存用户密码
- 多用户隔离：每个用户独立拥有 `chat_history`、`memories`、`usage_logs`
- OpenAI 聊天
- 图片上传分析
- GPT-5 / GPT-5-mini / GPT-5-nano 模型切换
- Supabase 保存、读取、清空聊天记录
- Supabase 保存、读取、删除、清空长期记忆
- 输入 `记住xxx` 自动保存长期记忆
- 输入 `忘记xxx` 自动删除相关长期记忆
- 联网搜索开关：已预留 Tavily / SerpAPI / Bing Search 接口
- 会员套餐：免费版、月付版、年付版
- 免费版每日使用次数限制
- 付费版每日次数和 token 限额更高
- 支付接口预留：Stripe、支付宝、微信支付
- 管理后台：查看用户、使用次数、套餐，修改套餐，禁用用户，清空聊天记录

## Streamlit Secrets

在 Streamlit Cloud 的 Secrets 中配置：

```toml
OPENAI_API_KEY = "你的 OpenAI API Key"
SUPABASE_URL = "https://你的项目.supabase.co"
SUPABASE_KEY = "你的 Supabase anon key 或 service role key"
SUPABASE_SCHEMA = "public"

# 可选：支付接口占位配置，当前不会发起真实扣款
PAYMENT_PROVIDER = "placeholder"
STRIPE_SECRET_KEY = ""
ALIPAY_APP_ID = ""
WECHAT_PAY_MCH_ID = ""
```

安全要求：

- 不要把任何 API Key 写进代码
- 不要把完整密钥显示在页面上
- Streamlit Secrets 只在服务端读取
- `SUPABASE_URL` 推荐填写项目根地址，例如 `https://xxxx.supabase.co`，不要填写 `https://xxxx.supabase.co/rest/v1`
- 如果你填写了带 `/rest/v1` 的地址，当前代码会自动纠正
- 这个项目使用自建账号系统，推荐 `SUPABASE_KEY` 使用 `service_role key`，只放在 Streamlit Secrets，不要放到前端页面或公开仓库
- 如果启用 RLS，请确保策略和你的 Supabase Key 匹配；使用 `service_role key` 时通常可以直接绕过 RLS

## 首个管理员

先在页面注册一个普通账号，然后在 Supabase SQL Editor 中把它设为管理员：

```sql
update public.users
set is_admin = true
where email = '你的邮箱@example.com';
```

重新登录后会看到“管理后台”页面。

## Supabase 数据库 SQL

在 Supabase SQL Editor 中执行以下 SQL：

```sql
create table if not exists public.users (
  id bigint generated always as identity primary key,
  user_id text not null unique,
  username text not null unique,
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  plan text not null default 'free',
  expire_at timestamptz,
  daily_limit integer not null default 20,
  token_limit integer not null default 50000,
  is_admin boolean not null default false,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists users_email_idx
  on public.users (email);

create index if not exists users_username_idx
  on public.users (username);

create table if not exists public.plans (
  plan_id text primary key,
  name text not null,
  price numeric(10, 2) not null default 0,
  billing_cycle text not null default 'free',
  daily_limit integer not null default 20,
  token_limit integer not null default 50000,
  description text,
  created_at timestamptz not null default now()
);

insert into public.plans (plan_id, name, price, billing_cycle, daily_limit, token_limit, description)
values
  ('free', '免费版', 0, 'free', 20, 50000, '适合试用，每天有限次数和 token。'),
  ('monthly', '月付版', 29, 'monthly', 300, 1000000, '适合日常高频使用，按月开通。'),
  ('yearly', '年付版', 299, 'yearly', 1000, 5000000, '适合长期使用，额度更高。')
on conflict (plan_id) do update
set
  name = excluded.name,
  price = excluded.price,
  billing_cycle = excluded.billing_cycle,
  daily_limit = excluded.daily_limit,
  token_limit = excluded.token_limit,
  description = excluded.description;

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  payment_id text unique,
  user_id text not null,
  plan text not null,
  provider text not null,
  amount numeric(10, 2) not null default 0,
  currency text not null default 'CNY',
  status text not null default 'pending',
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_created_at_idx
  on public.payments (user_id, created_at desc);

create table if not exists public.chat_history (
  id bigint generated always as identity primary key,
  user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_history_user_id_id_idx
  on public.chat_history (user_id, id);

create table if not exists public.memories (
  id bigint generated always as identity primary key,
  user_id text not null,
  memory text not null,
  created_at timestamptz not null default now()
);

create index if not exists memories_user_id_id_idx
  on public.memories (user_id, id);

create table if not exists public.usage_logs (
  id bigint generated always as identity primary key,
  user_id text,
  model text,
  prompt_tokens integer default 0,
  completion_tokens integer default 0,
  total_tokens integer default 0,
  created_at timestamptz default now()
);

create index if not exists usage_logs_user_id_created_at_idx
  on public.usage_logs (user_id, created_at desc);

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

grant select, insert, update, delete on public.users to service_role;
grant select, insert, update, delete on public.plans to service_role;
grant select, insert, update, delete on public.payments to service_role;
grant select, insert, update, delete on public.chat_history to service_role;
grant select, insert, update, delete on public.memories to service_role;
grant select, insert, update, delete on public.usage_logs to service_role;

notify pgrst, 'reload schema';
```

如果这是一个由 Streamlit 后端统一访问 Supabase 的项目，可以先关闭 RLS：

```sql
alter table public.users disable row level security;
alter table public.plans disable row level security;
alter table public.payments disable row level security;
alter table public.chat_history disable row level security;
alter table public.memories disable row level security;
alter table public.usage_logs disable row level security;
```

如果你要开启 RLS，并且 `SUPABASE_KEY` 使用的是 `service_role key`，可以使用下面的策略。`service_role` 仍然只应该放在 Streamlit Secrets 中：

```sql
alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.payments enable row level security;
alter table public.chat_history enable row level security;
alter table public.memories enable row level security;
alter table public.usage_logs enable row level security;

drop policy if exists "service_role_all_users" on public.users;
create policy "service_role_all_users"
on public.users
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_all_plans" on public.plans;
create policy "service_role_all_plans"
on public.plans
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_all_payments" on public.payments;
create policy "service_role_all_payments"
on public.payments
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_all_chat_history" on public.chat_history;
create policy "service_role_all_chat_history"
on public.chat_history
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_all_memories" on public.memories;
create policy "service_role_all_memories"
on public.memories
for all
to service_role
using (true)
with check (true);

drop policy if exists "service_role_all_usage_logs" on public.usage_logs;
create policy "service_role_all_usage_logs"
on public.usage_logs
for all
to service_role
using (true)
with check (true);

notify pgrst, 'reload schema';
```

注意：这个项目的普通用户账号不是 Supabase Auth 用户，而是保存在 `public.users` 的自建账号。因此不要给 `anon` 写宽松的“全表读写”RLS 策略，否则普通用户可能通过 API 访问别人的数据。生产部署建议只让 Streamlit 服务端用 `service_role key` 访问 Supabase，应用代码用 `user_id` 做数据隔离。

## 如果注册时报 404

如果你已经执行 SQL 但页面仍显示：

- `读取 users 失败：404`
- `读取 plans 失败：404`
- `写入 users 失败：404`

请在 Supabase SQL Editor 再执行：

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('users', 'plans', 'payments', 'chat_history', 'memories', 'usage_logs')
order by table_name;

notify pgrst, 'reload schema';
```

你应该看到 6 张表都在 `public` schema 下：

- `users`
- `plans`
- `payments`
- `chat_history`
- `memories`
- `usage_logs`

如果查不到这些表，说明表没有建在 `public` schema，需要重新执行上面的完整建表 SQL。

## 表说明

### `users`

保存注册用户、会员套餐和权限状态。

- `user_id`：每个用户独立 ID
- `username`：用户名
- `email`：邮箱
- `password_hash`：密码哈希
- `password_salt`：密码盐
- `plan`：当前套餐
- `expire_at`：套餐过期时间
- `daily_limit`：每日请求次数上限
- `token_limit`：每日 token 上限
- `is_admin`：是否管理员
- `disabled`：是否禁用

### `plans`

保存会员套餐。

- `plan_id`：`free`、`monthly`、`yearly`
- `name`：套餐名称
- `price`：价格
- `billing_cycle`：计费周期
- `daily_limit`：每日请求次数上限
- `token_limit`：每日 token 上限
- `description`：套餐说明

### `payments`

支付记录预留表，后续接入 Stripe、支付宝或微信支付时使用。

### `chat_history`

保存每个用户的聊天记录。

### `memories`

保存每个用户的长期记忆。

### `usage_logs`

保存每次 OpenAI 请求后的 token 使用情况。

应用写入 `usage_logs` 时只写以下字段：

- `user_id`
- `model`
- `prompt_tokens`
- `completion_tokens`
- `total_tokens`

`created_at` 由数据库默认值自动生成。

## 联网搜索预留

页面里已经有“启用联网搜索”开关。目前代码中的 `get_search_context()` 是预留接口，后续可以在这里接入：

- Tavily
- SerpAPI
- Bing Search API

接入后，把搜索结果整理成简短上下文返回，应用会把它加入 system prompt。
