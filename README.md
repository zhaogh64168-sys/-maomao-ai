# 毛毛AI 最终商业版

毛毛AI 是一个基于 Streamlit、OpenAI 和 Supabase 的个人 AI 商业化项目。当前版本包含 ChatGPT 式首页、多会话、邮箱验证码注册、找回密码、会员套餐、邀请码、推广返佣、二维码支付、长期记忆、图片分析、Token 统计和管理员后台。

## 功能

- GPT 聊天，支持 Markdown 和代码块
- 图片上传分析，并可在后续问题中继续带上最近图片
- 左侧会话栏：新建对话、历史会话、重命名、删除、清空
- 多用户注册/登录，密码哈希存储
- 邮箱验证码注册，找回密码/重置密码
- 长期记忆 `memories`
- 聊天记录 `chat_history`
- 会话表 `conversations`
- 会员套餐：免费版、月付版、年付版
- Token 和次数限制
- 二维码收款：支付宝 / 微信
- 用户上传付款截图
- 管理员审核订单后一键开通会员
- 邀请码和推广码
- 推广返佣，佣金状态：`pending` / `paid` / `cancelled`
- 管理后台：用户、订单、邀请码、返佣、套餐、统计

不会显示 ChatGPT 名称、Logo 或 OpenAI 商标。

## Streamlit Secrets

在 Streamlit Cloud 的 Secrets 中配置：

```toml
OPENAI_API_KEY = "你的 OpenAI API Key"
SUPABASE_URL = "https://你的项目.supabase.co"
SUPABASE_KEY = "你的 Supabase service_role key"
SUPABASE_SCHEMA = "public"
APP_SECRET = "请填写随机长字符串"
APP_PASSWORD = "可选，兼容旧部署"

ALIPAY_QR_IMAGE_URL = "https://example.com/alipay-qr.png"
WECHAT_QR_IMAGE_URL = "https://example.com/wechat-qr.png"

# 可选：接入 Resend 后用于发送邮箱验证码
RESEND_API_KEY = ""
EMAIL_FROM = ""
```

安全要求：

- `SUPABASE_KEY` 必须使用 `service_role key`，不要使用 anon key
- 所有密钥只放在 Streamlit Secrets，不要写进代码
- 页面不会显示完整密钥
- 如果 `RESEND_API_KEY` 或 `EMAIL_FROM` 未配置，注册/找回密码会显示“邮箱接口暂未接入”的占位提示，并在页面显示临时验证码，方便测试

## Supabase SQL

在 Supabase SQL Editor 执行下面 SQL。脚本可重复执行，会补齐旧表字段。

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
  referral_code text,
  invited_by text,
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
alter table public.users add column if not exists referral_code text;
alter table public.users add column if not exists invited_by text;
alter table public.users add column if not exists is_admin boolean default false;
alter table public.users add column if not exists disabled boolean default false;
alter table public.users add column if not exists created_at timestamptz default now();

update public.users set user_id = gen_random_uuid()::text where user_id is null;
update public.users set plan_id = coalesce(nullif(plan_id, ''), nullif(plan, ''), 'free');
update public.users set plan = coalesce(nullif(plan, ''), plan_id, 'free');
update public.users set referral_code = lower(substr(regexp_replace(coalesce(username, 'user'), '[^a-zA-Z0-9]', '', 'g'), 1, 8) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)) where referral_code is null;
update public.users set daily_limit = coalesce(daily_limit, 20);
update public.users set token_limit = coalesce(token_limit, 50000);
update public.users set monthly_limit = coalesce(monthly_limit, 300);
update public.users set monthly_token_limit = coalesce(monthly_token_limit, 1000000);
update public.users set is_admin = coalesce(is_admin, false);
update public.users set disabled = coalesce(disabled, false);

create unique index if not exists users_user_id_unique on public.users (user_id);
create unique index if not exists users_username_unique on public.users (username);
create unique index if not exists users_email_unique on public.users (email);
create unique index if not exists users_referral_code_unique on public.users (referral_code);
create index if not exists users_created_at_idx on public.users (created_at desc);

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
create unique index if not exists plans_plan_id_unique on public.plans (plan_id);

insert into public.plans (
  plan_id, name, price, billing_cycle,
  daily_limit, token_limit, monthly_limit, monthly_token_limit, description
) values
  ('free', '免费版', 0, 'free', 20, 50000, 300, 1000000, '适合试用，含基础聊天、图片分析和长期记忆。'),
  ('monthly', '月付版', 29, 'monthly', 300, 1000000, 6000, 20000000, '适合日常高频使用，人工审核开通。'),
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

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  user_id text not null,
  plan_id text not null,
  amount numeric(10, 2) default 0,
  status text default 'pending',
  screenshot_base64 text,
  created_at timestamptz default now()
);
alter table public.payments add column if not exists screenshot_base64 text;
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
alter table public.payments disable row level security;
alter table public.conversations disable row level security;
alter table public.chat_history disable row level security;
alter table public.memories disable row level security;
alter table public.usage_logs disable row level security;
alter table public.email_codes disable row level security;
alter table public.password_resets disable row level security;
alter table public.invite_codes disable row level security;
alter table public.referrals disable row level security;
alter table public.commissions disable row level security;

notify pgrst, 'reload schema';
```

## 首个管理员

先注册一个普通账号，然后执行：

```sql
update public.users
set is_admin = true
where email = '你的邮箱@example.com';
```

重新登录后会看到“管理后台”。

## 支付流程

1. 用户进入“会员/支付”
2. 选择免费版、月付版或年付版
3. 系统写入 `payments`，状态为 `pending`
4. 页面展示支付宝和微信二维码
5. 用户上传付款截图
6. 管理员在后台审核通过
7. 系统自动开通会员，并按推广关系生成 `commissions`

后续接入支付宝官方 API 或微信支付 API 时，可以用真实支付回调更新 `payments.status = 'paid'`，然后调用同样的开通会员逻辑。

## 邮箱验证

如果配置了：

- `RESEND_API_KEY`
- `EMAIL_FROM`

系统会通过 Resend 发送邮箱验证码。未配置时，页面会显示占位提示和临时验证码，仅用于测试。

## 部署检查

1. 执行 Supabase SQL
2. 配置 Streamlit Secrets
3. 重启 Streamlit Cloud
4. 注册新用户，验证邮箱验证码
5. 创建会话并发送消息
6. 输入 `记住我喜欢简洁回答`，确认长期记忆写入
7. 上传图片并追问
8. 购买套餐，上传付款截图
9. 管理员审核订单并开通会员
10. 测试邀请码和推广返佣

## 常见问题

- `SUPABASE_KEY 当前是 anon key`：请改为 service_role key。
- `读取 users 失败：404`：确认表在 public schema，并执行 `notify pgrst, 'reload schema';`。
- 邮箱收不到验证码：确认 `RESEND_API_KEY` 和 `EMAIL_FROM`，或先使用占位验证码测试。
- 支付不会自动到账：当前是二维码人工审核版，真实支付 API 接入位置已保留。
