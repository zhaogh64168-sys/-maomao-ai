# 毛毛AI Vercel 生产版

毛毛AI 已从 `Streamlit + Supabase + OpenAI` 迁移为 `Next.js 15 + TypeScript + TailwindCSS + Next.js API Routes + Supabase + OpenAI` 架构，适合部署到 Vercel。

## 功能

- 用户注册/登录、邮箱验证码、找回密码
- GPT 聊天、Markdown/代码块、图片上传分析
- 图片生成、语音识别、语音朗读播放
- 多会话历史、会话重命名、删除、新建聊天
- 长期记忆 `memories`
- Token 和次数统计 `usage_logs`
- 免费/月付/年付套餐系统
- 管理后台：用户、订单、套餐、邀请码、返佣、数据统计
- 邀请码、推广码、推广返佣
- 支付宝/微信二维码支付，保留官方支付 API 接入口
- 深色模式、移动端适配、ChatGPT 风格布局

不会显示 ChatGPT 名称、Logo 或 OpenAI 商标。

## 技术栈

- Next.js 15 App Router
- TypeScript
- TailwindCSS
- Next.js API Routes
- Supabase Postgres
- OpenAI Node SDK
- Vercel

## 文件结构

```text
app/
  api/[[...path]]/route.ts   # 所有后端 API
  globals.css
  layout.tsx
  page.tsx
src/components/MaomaoApp.tsx # 主前端界面
supabase.sql                 # 完整数据库初始化 SQL
.env.example                 # Vercel 环境变量示例
vercel.json                  # Vercel 配置
```

## 环境变量

在 Vercel Project Settings -> Environment Variables 中配置：

```bash
OPENAI_API_KEY="sk-..."
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_SCHEMA="public"
APP_SECRET="please-use-a-long-random-secret"

APP_URL="https://your-domain.vercel.app"
ALIPAY_QR_IMAGE_URL="https://example.com/alipay-qr.png"
WECHAT_QR_IMAGE_URL="https://example.com/wechat-qr.png"

CHAT_MODEL="gpt-5"
IMAGE_MODEL="gpt-image-1"
TTS_MODEL="gpt-4o-mini-tts"
STT_MODEL="whisper-1"

RESEND_API_KEY=""
EMAIL_FROM=""

ALIPAY_APP_ID=""
ALIPAY_PRIVATE_KEY=""
ALIPAY_PUBLIC_KEY=""
WECHAT_PAY_APP_ID=""
WECHAT_PAY_MCH_ID=""
WECHAT_PAY_API_V3_KEY=""
```

安全要求：

- `SUPABASE_SERVICE_ROLE_KEY` 只在 Vercel 服务端环境变量中配置
- 不要把任何 API Key 写进前端代码
- `APP_SECRET` 必须是长随机字符串，用于签名登录 Cookie 和验证码
- 支付宝/微信官方密钥暂未启用，只预留字段和后端接入口

## Supabase 初始化

在 Supabase SQL Editor 执行：

```sql
-- 直接执行仓库根目录 supabase.sql 的完整内容
```

或者复制 `supabase.sql` 中的全部 SQL。

## 首个管理员

先在网站注册普通账号，然后执行：

```sql
update public.users
set is_admin = true
where email = '你的邮箱@example.com';
```

重新登录后可进入管理后台。

## 本地开发

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开：

```text
http://localhost:3000
```

## Vercel 部署

1. 将仓库导入 Vercel
2. Framework Preset 选择 `Next.js`
3. 添加环境变量
4. 在 Supabase 执行 `supabase.sql`
5. 部署
6. 注册账号，设置首个管理员
7. 测试聊天、图片分析、图片生成、语音识别、朗读、会员订单和后台审核

## 支付说明

当前版本支持二维码收款：

1. 用户选择套餐
2. 系统创建 `payments` 订单，状态为 `pending`
3. 页面展示支付宝/微信二维码
4. 用户上传付款截图
5. 管理员审核通过
6. 系统开通会员并生成返佣记录

支付宝官方支付和微信支付 API 已在环境变量和后端结构中预留，后续可把 `payments.status` 的更新改为支付回调自动完成。

## API 路由

- `POST /api/auth/send-code`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/reset-password`
- `GET /api/auth/me`
- `GET/POST/PATCH/DELETE /api/conversations`
- `GET /api/messages`
- `GET/POST/DELETE /api/memories`
- `POST /api/chat`
- `POST /api/images`
- `POST /api/audio/transcribe`
- `POST /api/audio/tts`
- `GET /api/plans`
- `GET/POST/PATCH /api/payments`
- `GET/POST /api/admin`

## 部署前检查

1. `npm run typecheck`
2. `npm run build`
3. Supabase SQL 执行成功
4. Vercel 环境变量完整
5. 注册/登录正常
6. 邮箱验证码未配置 Resend 时页面显示测试验证码
7. 聊天、图片分析、图片生成、语音识别、朗读正常
8. `usage_logs` 正常写入
9. 管理员可审核订单、封禁用户、调整额度
