import base64
import re
from urllib.parse import quote

import requests
import streamlit as st
from openai import OpenAI


USER_ID = "maomao"
MODEL_OPTIONS = ["gpt-5", "gpt-5-mini", "gpt-5-nano"]


def get_secret(name, default=None):
    try:
        return st.secrets.get(name, default)
    except Exception:
        return default


def require_secret(name):
    value = get_secret(name)
    if not value:
        st.error(f"缺少 Streamlit Secret：{name}")
        st.stop()
    return value


def get_supabase_headers(include_content_type=False):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    if include_content_type:
        headers["Content-Type"] = "application/json"
    return headers


def supabase_url(table, query=""):
    base_url = SUPABASE_URL.rstrip("/")
    return f"{base_url}/rest/v1/{table}{query}"


def build_system_prompt(memories):
    memory_text = "\n".join(f"- {memory}" for memory in memories) if memories else "暂无"
    return f"""
你是毛毛AI超级助手。

已知用户长期记忆：
{memory_text}

回答要简洁、实用、中文优先。
"""


def reset_system_message():
    system_message = {
        "role": "system",
        "content": build_system_prompt(st.session_state.get("memories", [])),
    }

    if "messages" not in st.session_state or not st.session_state.messages:
        st.session_state.messages = [system_message]
        return

    if st.session_state.messages[0].get("role") == "system":
        st.session_state.messages[0] = system_message
    else:
        st.session_state.messages.insert(0, system_message)


def load_memories(user_id):
    encoded_user_id = quote(user_id, safe="")
    url = supabase_url("memories", f"?user_id=eq.{encoded_user_id}&select=memory&order=id.asc")
    res = requests.get(url, headers=get_supabase_headers(), timeout=20)

    if res.status_code != 200:
        st.warning(f"读取长期记忆失败：{res.status_code}")
        return []

    return [row.get("memory", "") for row in res.json() if row.get("memory")]


def save_memory(user_id, memory):
    memory = memory.strip()
    if not memory:
        return False

    url = supabase_url("memories")
    headers = get_supabase_headers(include_content_type=True)
    headers["Prefer"] = "return=minimal"
    data = {"user_id": user_id, "memory": memory}
    res = requests.post(url, headers=headers, json=data, timeout=20)

    if res.status_code not in (200, 201, 204):
        st.warning(f"保存长期记忆失败：{res.status_code}")
        return False

    return True


def extract_memory(text):
    if not text:
        return ""

    match = re.match(r"^\s*(?:请)?记住[：:\s]*(.+?)\s*$", text)
    return match.group(1).strip() if match else ""


def save_message(user_id, role, content):
    url = supabase_url("chat_history")
    headers = get_supabase_headers(include_content_type=True)
    headers["Prefer"] = "return=minimal"
    data = {
        "user_id": user_id,
        "role": role,
        "content": str(content),
    }
    res = requests.post(url, headers=headers, json=data, timeout=20)

    if res.status_code not in (200, 201, 204):
        st.warning(f"保存聊天记录失败：{res.status_code}")


def load_messages(user_id):
    encoded_user_id = quote(user_id, safe="")
    query = f"?user_id=eq.{encoded_user_id}&select=role,content&order=id.asc"
    res = requests.get(supabase_url("chat_history", query), headers=get_supabase_headers(), timeout=20)

    if res.status_code != 200:
        st.warning(f"读取聊天记录失败：{res.status_code}")
        return []

    messages = []
    for row in res.json():
        role = row.get("role")
        content = row.get("content")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    return messages


def clear_messages(user_id):
    encoded_user_id = quote(user_id, safe="")
    url = supabase_url("chat_history", f"?user_id=eq.{encoded_user_id}")
    headers = get_supabase_headers()
    res = requests.delete(url, headers=headers, timeout=20)

    if res.status_code not in (200, 202, 204):
        st.warning(f"清空聊天记录失败：{res.status_code}")


def initialize_messages():
    if "memories" not in st.session_state:
        st.session_state.memories = load_memories(USER_ID)

    if "messages" not in st.session_state:
        st.session_state.messages = [{"role": "system", "content": build_system_prompt(st.session_state.memories)}]
        st.session_state.messages.extend(load_messages(USER_ID))
    else:
        reset_system_message()


def encode_uploaded_image(uploaded_file):
    image_base64 = base64.b64encode(uploaded_file.getvalue()).decode("utf-8")
    mime_type = uploaded_file.type or "image/jpeg"
    return f"data:{mime_type};base64,{image_base64}"


st.set_page_config(page_title="毛毛AI超级助手", page_icon="🤖")

PASSWORD = require_secret("APP_PASSWORD")

if "login" not in st.session_state:
    st.session_state.login = False

if not st.session_state.login:
    pwd = st.text_input("请输入访问密码", type="password")

    if st.button("登录"):
        if pwd == PASSWORD:
            st.session_state.login = True
            st.rerun()
        else:
            st.error("密码错误")

    st.stop()


OPENAI_API_KEY = require_secret("OPENAI_API_KEY")
SUPABASE_URL = require_secret("SUPABASE_URL")
SUPABASE_KEY = require_secret("SUPABASE_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)

initialize_messages()

st.title("🤖 毛毛AI超级助手")
st.caption("基于 GPT 构建的个人 AI 助手")

model_name = st.selectbox("选择 AI 模型", MODEL_OPTIONS, index=0)
st.success(f"当前模型：{model_name}")

uploaded_file = st.file_uploader("上传图片", type=["png", "jpg", "jpeg"], key="image_upload")
if uploaded_file:
    st.image(uploaded_file, caption="已上传图片", width=300)

if st.button("🗑️ 清空聊天记录"):
    clear_messages(USER_ID)
    st.session_state.messages = [{"role": "system", "content": build_system_prompt(st.session_state.memories)}]
    st.rerun()

for msg in st.session_state.messages:
    if msg["role"] == "system":
        continue
    st.chat_message(msg["role"]).write(msg["content"])

question = st.chat_input("请输入问题")

if question or uploaded_file:
    if not question:
        question = "请分析这张图片"

    memory = extract_memory(question)
    if memory and save_memory(USER_ID, memory):
        if memory not in st.session_state.memories:
            st.session_state.memories.append(memory)
        reset_system_message()
        st.toast("已保存到长期记忆")

    if uploaded_file:
        user_message = {
            "role": "user",
            "content": [
                {"type": "text", "text": question},
                {"type": "image_url", "image_url": {"url": encode_uploaded_image(uploaded_file)}},
            ],
        }
        save_content = f"{question}【已上传图片】"
    else:
        user_message = {"role": "user", "content": question}
        save_content = question

    st.session_state.messages.append(user_message)
    save_message(USER_ID, "user", save_content)
    st.chat_message("user").write(question)

    with st.chat_message("assistant"):
        with st.spinner("毛毛AI正在思考..."):
            response = client.chat.completions.create(
                model=model_name,
                messages=st.session_state.messages,
            )
            answer = response.choices[0].message.content or ""
            st.write(answer)

    st.session_state.messages.append({"role": "assistant", "content": answer})
    save_message(USER_ID, "assistant", answer)
