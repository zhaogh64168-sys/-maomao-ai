"use client";

import type { ButtonHTMLAttributes, FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AnyRow = Record<string, any>;
type View = "chat" | "image" | "audio" | "member" | "admin" | "account";

const models = ["gpt-5", "gpt-5.5", "gpt-5-mini"];
const ratios = ["1:1", "16:9", "9:16"];
const styles = ["写实摄影", "电商海报", "头像", "插画", "室内设计"];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...(init?.headers || {}) }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "请求失败" }));
    throw new Error(data.error || "请求失败");
  }
  if (res.headers.get("content-type")?.includes("audio")) return (await res.blob()) as T;
  return res.json();
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ""}`}
    />
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 ${props.className || ""}`} />;
}

function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 ${props.className || ""}`} />;
}

export default function MaomaoApp() {
  const [user, setUser] = useState<AnyRow | null>(null);
  const [limits, setLimits] = useState<AnyRow | null>(null);
  const [usage, setUsage] = useState<AnyRow | null>(null);
  const [view, setView] = useState<View>("chat");
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [conversations, setConversations] = useState<AnyRow[]>([]);
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [messages, setMessages] = useState<AnyRow[]>([]);
  const [memories, setMemories] = useState<AnyRow[]>([]);
  const [plans, setPlans] = useState<AnyRow[]>([]);
  const [payments, setPayments] = useState<AnyRow[]>([]);
  const [qr, setQr] = useState({ alipayQr: "", wechatQr: "" });
  const [admin, setAdmin] = useState<AnyRow | null>(null);

  const [chatDraft, setChatDraft] = useState("");
  const [model, setModel] = useState(models[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">("login");
  const [authForm, setAuthForm] = useState({ login: "", username: "", email: "", password: "", code: "", inviteCode: "" });
  const [devCode, setDevCode] = useState("");

  const [imagePrompt, setImagePrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [style, setStyle] = useState("写实摄影");
  const [generatedImage, setGeneratedImage] = useState("");

  const [ttsText, setTtsText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const activeTitle = useMemo(() => conversations.find((c) => Number(c.id) === activeConversation)?.title || "新对话", [conversations, activeConversation]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMe() {
    setLoading(true);
    try {
      const data = await api<{ user: AnyRow | null; limits?: AnyRow; today?: AnyRow }>("/api/auth/me");
      setUser(data.user);
      setLimits(data.limits || null);
      setUsage(data.today || null);
      if (data.user) await loadWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkspace() {
    const [conv, mem, plan, pay] = await Promise.all([
      api<{ conversations: AnyRow[] }>("/api/conversations"),
      api<{ memories: AnyRow[] }>("/api/memories"),
      api<{ plans: AnyRow[] }>("/api/plans"),
      api<{ payments: AnyRow[]; alipayQr?: string; wechatQr?: string }>("/api/payments")
    ]);
    setConversations(conv.conversations);
    setMemories(mem.memories);
    setPlans(plan.plans);
    setPayments(pay.payments);
    setQr({ alipayQr: pay.alipayQr || "", wechatQr: pay.wechatQr || "" });
    const first = conv.conversations[0]?.id;
    if (first) {
      setActiveConversation(Number(first));
      await loadMessages(Number(first));
    } else {
      await createConversation();
    }
  }

  async function loadMessages(conversationId: number) {
    const data = await api<{ messages: AnyRow[] }>(`/api/messages?conversation_id=${conversationId}`);
    setMessages(data.messages);
  }

  async function createConversation() {
    const data = await api<{ conversation: AnyRow }>("/api/conversations", { method: "POST", body: JSON.stringify({ title: "新对话" }) });
    setConversations((rows) => [data.conversation, ...rows]);
    setActiveConversation(Number(data.conversation.id));
    setMessages([]);
    return Number(data.conversation.id);
  }

  async function renameConversation(id: number, title: string) {
    await api("/api/conversations", { method: "PATCH", body: JSON.stringify({ id, title }) });
    setConversations((rows) => rows.map((row) => (Number(row.id) === id ? { ...row, title } : row)));
  }

  async function deleteConversation(id?: number) {
    await api(`/api/conversations${id ? `?id=${id}` : ""}`, { method: "DELETE" });
    setConversations((rows) => (id ? rows.filter((row) => Number(row.id) !== id) : []));
    setMessages([]);
    setActiveConversation(null);
  }

  async function sendCode(purpose: "register" | "reset") {
    try {
      const data = await api<{ message: string; devCode?: string }>("/api/auth/send-code", {
        method: "POST",
        body: JSON.stringify({ email: authForm.email, purpose })
      });
      setDevCode(data.devCode || "");
      setError(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (authMode === "login") {
        await api("/api/auth/login", { method: "POST", body: JSON.stringify({ login: authForm.login, password: authForm.password }) });
      } else if (authMode === "register") {
        await api("/api/auth/register", { method: "POST", body: JSON.stringify(authForm) });
      } else {
        await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email: authForm.email, code: authForm.code, password: authForm.password }) });
        setAuthMode("login");
        setError("密码已重置，请登录");
        return;
      }
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMessages([]);
    setConversations([]);
  }

  async function sendChat() {
    if (!chatDraft.trim() && !imageFile) return;
    const conversationId = activeConversation || (await createConversation());
    const text = chatDraft.trim() || "请分析这张图片";
    setSending(true);
    setMessages((rows) => [...rows, { role: "user", content: text }]);
    setChatDraft("");
    try {
      const payload: AnyRow = { conversationId, message: text, model };
      if (imageFile) {
        payload.imageBase64 = await fileToBase64(imageFile);
        payload.imageMime = imageFile.type;
      }
      const data = await api<{ answer: string }>("/api/chat", { method: "POST", body: JSON.stringify(payload) });
      setMessages((rows) => [...rows, { role: "assistant", content: data.answer }]);
      setTtsText(data.answer);
      setImageFile(null);
      await Promise.all([loadMessages(conversationId), loadMe()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  async function generateImage() {
    try {
      const data = await api<{ imageUrl: string }>("/api/images", {
        method: "POST",
        body: JSON.stringify({ prompt: imagePrompt, ratio, style })
      });
      setGeneratedImage(data.imageUrl);
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "图片生成失败");
    }
  }

  async function transcribe(file: File) {
    const form = new FormData();
    form.append("file", file);
    try {
      const data = await api<{ text: string }>("/api/audio/transcribe", { method: "POST", body: form });
      setChatDraft(data.text);
      setView("chat");
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "语音识别失败");
    }
  }

  async function speak(text = ttsText) {
    try {
      const blob = await api<Blob>("/api/audio/tts", { method: "POST", body: JSON.stringify({ text }) });
      setAudioUrl(URL.createObjectURL(blob));
      await loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "语音生成失败");
    }
  }

  async function buyPlan(planId: string) {
    try {
      const data = await api<{ payment: AnyRow; alipayQr: string; wechatQr: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({ planId })
      });
      setPayments((rows) => [data.payment, ...rows]);
      setQr({ alipayQr: data.alipayQr, wechatQr: data.wechatQr });
      setError("订单已创建，请付款后联系管理员审核开通。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建订单失败");
    }
  }

  async function uploadPaymentShot(paymentId: number, file: File) {
    await api("/api/payments", { method: "PATCH", body: JSON.stringify({ id: paymentId, screenshot_base64: await fileToBase64(file) }) });
    setError("付款截图已提交");
  }

  async function loadAdmin() {
    if (!user?.is_admin) return;
    const data = await api<AnyRow>("/api/admin");
    setAdmin(data);
  }

  async function adminAction(body: AnyRow) {
    await api("/api/admin", { method: "POST", body: JSON.stringify(body) });
    await loadAdmin();
    await loadMe();
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-500">毛毛AI 正在启动...</div>;
  if (!user) return renderAuth();

  return (
    <main className="flex h-screen overflow-hidden bg-maomao-bg text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">毛毛AI</div>
            <div className="text-xs text-slate-500">{user.username || user.email}</div>
          </div>
          <Button className="bg-slate-100 dark:bg-slate-800" onClick={() => setDark(!dark)}>{dark ? "浅色" : "深色"}</Button>
        </div>
        <Button className="mb-3 bg-slate-950 text-white dark:bg-white dark:text-slate-950" onClick={createConversation}>+ 新建聊天</Button>
        <nav className="mb-3 grid grid-cols-2 gap-2 text-sm">
          {(["chat", "image", "audio", "member"] as Array<"chat" | "image" | "audio" | "member">).map((item) => (
            <Button key={item} onClick={() => setView(item)} className={view === item ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800"}>
              {{ chat: "聊天", image: "图片生成", audio: "语音工具", member: "会员" }[item]}
            </Button>
          ))}
          <Button onClick={() => setView(user.is_admin ? "admin" : "account")} className={view === "admin" || view === "account" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800"}>
            {user.is_admin ? "后台" : "账号"}
          </Button>
        </nav>
        <div className="flex-1 overflow-y-auto">
          <div className="mb-2 text-xs text-slate-500">历史会话</div>
          {conversations.map((conv) => (
            <div key={conv.id} className={`group mb-1 rounded-xl p-2 text-sm ${Number(conv.id) === activeConversation ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}>
              <button className="w-full truncate text-left" onClick={() => { setActiveConversation(Number(conv.id)); loadMessages(Number(conv.id)); setView("chat"); }}>{conv.title || "未命名对话"}</button>
              <div className="mt-2 hidden gap-1 group-hover:flex">
                <Button className="bg-slate-200 py-1 dark:bg-slate-700" onClick={() => renameConversation(Number(conv.id), prompt("新标题", conv.title) || conv.title)}>重命名</Button>
                <Button className="bg-red-50 py-1 text-red-600 dark:bg-red-950" onClick={() => deleteConversation(Number(conv.id))}>删除</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
          <div>套餐：{limits?.plan?.name || user.plan_id}</div>
          <div>今日：{usage?.calls || 0}/{limits?.dailyLimit || user.daily_limit} 次</div>
          <div>Token：{usage?.tokens || 0}/{limits?.tokenLimit || user.token_limit}</div>
          <Button className="w-full bg-slate-100 dark:bg-slate-800" onClick={logout}>退出登录</Button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:px-6">
          <div>
            <div className="font-semibold">{view === "chat" ? activeTitle : { image: "图片生成", audio: "语音工具", member: "会员中心", admin: "管理后台", account: "账号信息" }[view]}</div>
            <div className="text-xs text-slate-500">Next.js 15 + Supabase + OpenAI</div>
          </div>
          <select value={model} onChange={(event) => setModel(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            {models.map((item) => <option key={item}>{item}</option>)}
          </select>
        </header>
        <div className="grid grid-cols-5 gap-1 border-b border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900 md:hidden">
          {([
            ["chat", "聊天"],
            ["image", "图片"],
            ["audio", "语音"],
            ["member", "会员"],
            [user.is_admin ? "admin" : "account", user.is_admin ? "后台" : "账号"]
          ] as Array<[View, string]>).map(([key, label]) => (
            <Button key={key} className={view === key ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 dark:bg-slate-800"} onClick={() => setView(key)}>{label}</Button>
          ))}
        </div>
        {error && <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</div>}
        {view === "chat" && renderChat()}
        {view === "image" && renderImage()}
        {view === "audio" && renderAudio()}
        {view === "member" && renderMember()}
        {view === "admin" && renderAdmin()}
        {view === "account" && renderAccount()}
      </section>
    </main>
  );

  function renderAuth() {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-100">
        <form onSubmit={submitAuth} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <h1 className="text-2xl font-semibold">毛毛AI</h1>
          <p className="mt-1 text-sm text-slate-300">登录后使用聊天、图片、语音、会员和后台功能。</p>
          <div className="my-5 grid grid-cols-3 gap-2">
            {(["login", "register", "reset"] as const).map((mode) => (
              <Button type="button" key={mode} className={authMode === mode ? "bg-white text-slate-950" : "bg-white/10"} onClick={() => setAuthMode(mode)}>
                {{ login: "登录", register: "注册", reset: "找回" }[mode]}
              </Button>
            ))}
          </div>
          <div className="space-y-3">
            {authMode === "login" ? <Input placeholder="用户名或邮箱" value={authForm.login} onChange={(e) => setAuthForm({ ...authForm, login: e.target.value })} /> : null}
            {authMode === "register" ? <Input placeholder="用户名" value={authForm.username} onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })} /> : null}
            {authMode !== "login" ? <Input placeholder="邮箱" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} /> : null}
            {authMode !== "login" ? (
              <div className="flex gap-2">
                <Input placeholder="验证码" value={authForm.code} onChange={(e) => setAuthForm({ ...authForm, code: e.target.value })} />
                <Button type="button" className="shrink-0 bg-white text-slate-950" onClick={() => sendCode(authMode === "register" ? "register" : "reset")}>发验证码</Button>
              </div>
            ) : null}
            {authMode === "register" ? <Input placeholder="邀请码/推广码（可选）" value={authForm.inviteCode} onChange={(e) => setAuthForm({ ...authForm, inviteCode: e.target.value })} /> : null}
            <Input type="password" placeholder={authMode === "reset" ? "新密码，至少 8 位" : "密码"} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
          </div>
          {devCode ? <div className="mt-3 rounded-xl bg-amber-200 px-3 py-2 text-sm text-amber-950">测试验证码：{devCode}</div> : null}
          {error ? <div className="mt-3 text-sm text-amber-200">{error}</div> : null}
          <Button className="mt-5 w-full bg-white text-slate-950" type="submit">{authMode === "login" ? "登录" : authMode === "register" ? "注册" : "重置密码"}</Button>
        </form>
      </main>
    );
  }

  function renderChat() {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-12">
          {!messages.length ? (
            <div className="mx-auto mt-16 max-w-3xl text-center">
              <h1 className="text-3xl font-semibold">今天想让毛毛AI帮你做什么？</h1>
              <p className="mt-3 text-slate-500">可以聊天、分析图片、写代码、整理资料，也可以输入“记住xxx”保存长期记忆。</p>
              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {["帮我总结一段文字", "帮我写一份推广文案", "帮我分析这张图片"].map((item) => (
                  <Button key={item} className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" onClick={() => setChatDraft(item)}>{item}</Button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`prose-chat max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-7 ${message.role === "user" ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-white shadow-sm dark:bg-slate-900"}`}>
                  {message.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown> : <div className="whitespace-pre-wrap">{message.content}</div>}
                  {message.role === "assistant" ? (
                    <div className="mt-3 flex gap-2">
                      <Button className="bg-slate-100 py-1 dark:bg-slate-800" onClick={() => navigator.clipboard.writeText(message.content)}>复制</Button>
                      <Button className="bg-slate-100 py-1 dark:bg-slate-800" onClick={() => speak(message.content)}>朗读回答</Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:p-5">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
            <label className="cursor-pointer rounded-2xl bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-800">
              图片
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
            </label>
            <Textarea rows={1} placeholder={imageFile ? `已选择：${imageFile.name}` : "给毛毛AI发送消息"} value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} className="min-h-12 flex-1 resize-none border-0 bg-transparent" />
            <Button className="bg-slate-950 text-white dark:bg-white dark:text-slate-950" disabled={sending} onClick={sendChat}>{sending ? "发送中" : "发送"}</Button>
          </div>
        </div>
      </div>
    );
  }

  function renderImage() {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <Textarea rows={4} placeholder="描述你想生成的图片" value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} />
          <div className="grid gap-3 md:grid-cols-3">
            <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">{ratios.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">{styles.map((item) => <option key={item}>{item}</option>)}</select>
            <Button className="bg-slate-950 text-white dark:bg-white dark:text-slate-950" onClick={generateImage}>生成图片</Button>
          </div>
          {generatedImage ? (
            <div className="rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={generatedImage} alt="生成结果" className="w-full rounded-2xl" />
              <a className="mt-3 inline-block rounded-xl bg-slate-950 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-950" href={generatedImage} download="maomao-image.png">下载图片</a>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderAudio() {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="text-lg font-semibold">语音输入</h2>
            <p className="mt-1 text-sm text-slate-500">上传 mp3、wav、m4a，识别结果会填入聊天输入框。</p>
            <input className="mt-5 w-full rounded-xl border border-slate-200 p-3 dark:border-slate-700" type="file" accept=".mp3,.wav,.m4a,audio/*" onChange={(event) => event.target.files?.[0] && transcribe(event.target.files[0])} />
          </section>
          <section className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="text-lg font-semibold">语音朗读</h2>
            <Textarea rows={7} className="mt-4" value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder="输入要朗读的文字，或在聊天回答中点“朗读回答”" />
            <Button className="mt-3 bg-slate-950 text-white dark:bg-white dark:text-slate-950" onClick={() => speak()}>生成语音</Button>
            {audioUrl ? <audio className="mt-4 w-full" src={audioUrl} controls /> : null}
          </section>
        </div>
      </div>
    );
  }

  function renderMember() {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.plan_id} className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                <div className="mt-4 text-3xl font-semibold">¥{Number(plan.price || 0).toFixed(2)}</div>
                <div className="mt-3 text-sm text-slate-500">每日 {plan.daily_limit} 次 / {plan.token_limit} Tokens</div>
                <Button className="mt-5 w-full bg-slate-950 text-white dark:bg-white dark:text-slate-950" onClick={() => buyPlan(plan.plan_id)}>购买套餐</Button>
              </div>
            ))}
          </div>
          <h3 className="mt-8 text-lg font-semibold">我的订单</h3>
          {(qr.alipayQr || qr.wechatQr) ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {qr.alipayQr ? <div className="rounded-3xl bg-white p-4 dark:bg-slate-900"><div className="mb-2 font-medium">支付宝收款码</div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={qr.alipayQr} alt="支付宝收款码" className="max-h-64 rounded-2xl" /></div> : null}
              {qr.wechatQr ? <div className="rounded-3xl bg-white p-4 dark:bg-slate-900"><div className="mb-2 font-medium">微信收款码</div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={qr.wechatQr} alt="微信收款码" className="max-h-64 rounded-2xl" /></div> : null}
            </div>
          ) : null}
          <div className="mt-3 space-y-3">
            {payments.map((pay) => (
              <div key={pay.id} className="rounded-2xl bg-white p-4 text-sm shadow-sm dark:bg-slate-900">
                <div>订单 #{pay.id} / {pay.plan_id} / ¥{pay.amount} / {pay.status}</div>
                {pay.status === "pending" ? <input className="mt-3" type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && uploadPaymentShot(pay.id, event.target.files[0])} /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderAdmin() {
    if (!user?.is_admin) return <div className="p-8">当前账号没有管理员权限</div>;
    if (!admin) return <div className="p-8"><Button className="bg-slate-950 text-white dark:bg-white dark:text-slate-950" onClick={loadAdmin}>加载管理后台</Button></div>;
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">今日用户：{admin.stats.todayUsers}</div>
          <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">今日聊天：{admin.stats.todayChats}</div>
          <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">今日 Token：{admin.stats.todayTokens}</div>
          <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">总收入：¥{Number(admin.stats.totalRevenue).toFixed(2)}</div>
        </div>
        <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="text-lg font-semibold">用户管理</h2>
          <div className="mt-3 space-y-2">
            {admin.users.map((item: AnyRow) => (
              <div key={item.user_id} className="grid gap-2 rounded-2xl border border-slate-100 p-3 text-sm dark:border-slate-800 md:grid-cols-6">
                <div className="md:col-span-2">{item.username}<br /><span className="text-slate-500">{item.email}</span></div>
                <Input defaultValue={item.plan_id} onBlur={(e) => adminAction({ action: "updateUser", userId: item.user_id, patch: { plan_id: e.target.value, plan: e.target.value } })} />
                <Input type="number" defaultValue={item.daily_limit} onBlur={(e) => adminAction({ action: "updateUser", userId: item.user_id, patch: { daily_limit: Number(e.target.value) } })} />
                <Input type="number" defaultValue={item.token_limit} onBlur={(e) => adminAction({ action: "updateUser", userId: item.user_id, patch: { token_limit: Number(e.target.value) } })} />
                <div className="flex gap-2">
                  <Button className="bg-slate-100 dark:bg-slate-800" onClick={() => adminAction({ action: "updateUser", userId: item.user_id, patch: { disabled: !item.disabled } })}>{item.disabled ? "解封" : "封禁"}</Button>
                  <Button className="bg-red-50 text-red-600 dark:bg-red-950" onClick={() => adminAction({ action: "clearChat", userId: item.user_id })}>清聊天</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="text-lg font-semibold">订单管理</h2>
          {admin.payments.map((pay: AnyRow) => (
            <div key={pay.id} className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-3 text-sm dark:border-slate-800">
              <span>#{pay.id}</span><span>{pay.user_id}</span><span>{pay.plan_id}</span><span>¥{pay.amount}</span><span>{pay.status}</span>
              <Button className="bg-emerald-600 text-white" onClick={() => adminAction({ action: "approvePayment", paymentId: pay.id })}>审核通过</Button>
              <Button className="bg-slate-100 dark:bg-slate-800" onClick={() => adminAction({ action: "cancelPayment", paymentId: pay.id })}>取消</Button>
            </div>
          ))}
        </section>
      </div>
    );
  }

  function renderAccount() {
    return (
      <div className="p-8">
        <div className="max-w-xl rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
          <h2 className="text-xl font-semibold">账号信息</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div>用户名：{user.username}</div>
            <div>邮箱：{user.email}</div>
            <div>套餐：{limits?.plan?.name || user.plan_id}</div>
            <div>推广码：{user.referral_code}</div>
          </div>
          <h3 className="mt-6 font-semibold">长期记忆</h3>
          <div className="mt-3 space-y-2">
            {memories.length ? memories.map((memory) => (
              <div key={memory.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                <span>{memory.memory}</span>
                <Button className="bg-red-50 py-1 text-red-600 dark:bg-red-950" onClick={async () => { await api(`/api/memories?id=${memory.id}`, { method: "DELETE" }); setMemories((rows) => rows.filter((row) => row.id !== memory.id)); }}>删除</Button>
              </div>
            )) : <div className="text-sm text-slate-500">暂无长期记忆</div>}
          </div>
        </div>
      </div>
    );
  }
}
