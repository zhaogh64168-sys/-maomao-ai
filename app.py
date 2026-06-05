import streamlit as st
import requests
import base64
from openai import OpenAI

PASSWORD = st.secrets["APP_PASSWORD"]

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

client = OpenAI(
    api_key=st.secrets["OPENAI_API_KEY"]
)

SUPABASE_URL = st.secrets["SUPABASE_URL"]
SUPABASE_KEY = st.secrets["SUPABASE_KEY"]

user_id = "maomao"

memories = load_memories(user_id)

def save_message(user_id, role, content):
    url = f"{SUPABASE_URL}/rest/v1/chat_history"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }

    data = {
        "user_id": user_id,
        "role": role,
        "content": str(content)
    }

    r = requests.post(url, headers=headers, json=data)
    
    if r.status_code not in [200, 201]:
        st.error(f"Supabase保存失败：{r.status_code}")
        st.write(r.text)

def save_memory(user_id, memory):
    url = f"{SUPABASE_URL}/rest/v1/memories"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "user_id": user_id,
        "memory": memory
    }

    requests.post(url, headers=headers, json=data)


def load_memories(user_id):
    url = f"{SUPABASE_URL}/rest/v1/memories?user_id=eq.{user_id}"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }

    res = requests.get(url, headers=headers)

    if res.status_code == 200:
        return [x["memory"] for x in res.json()]

    return []

def load_messages(user_id):
    url = f"{SUPABASE_URL}/rest/v1/chat_history?user_id=eq.{user_id}&order=id.asc"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }

    res = requests.get(url, headers=headers)

    if res.status_code != 200:
        return []

    rows = res.json()

    return [
        {
            "role": row["role"],
            "content": row["content"]
        }
        for row in rows
    ]


def clear_messages(user_id):
    url = f"{SUPABASE_URL}/rest/v1/chat_history?user_id=eq.{user_id}"

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }

    requests.delete(url, headers=headers)


st.title("🤖毛毛AI超级助手")
st.caption("基于GPT构建的个人AI助手")

uploaded_file = st.file_uploader(
    "上传图片",
    type=["png", "jpg", "jpeg"],
    key="image_upload"
)

if uploaded_file:
    st.image(uploaded_file, caption="已上传图片", width=300)

model_name = st.selectbox(
    "选择AI模型",
    [
        "gpt-5.5",
        "gpt-5.4",
        "gpt-5.4-mini",
        "gpt-5.4-nano",
    ],
    index=0
)

st.success(f"当前模型：{model_name}")

if "messages" not in st.session_state:

    history = load_messages(user_id)

    if history:
        st.session_state.messages = [
           {
    "role": "system",
    "content": f"""
你是毛毛AI超级助手。

已知用户长期记忆：
{chr(10).join(memories)}

回答要简洁、实用、中文优先。
"""
}
        ] + history

    else:
        st.session_state.messages = [
         {
    "role": "system",
    "content": f"""
你是毛毛AI超级助手。

已知用户长期记忆：
{chr(10).join(memories)}

回答要简洁、实用、中文优先。
"""
}
        ]

if st.button("🗑️清空聊天记录"):
    clear_messages(user_id)
    st.session_state.messages = [
      {
    "role": "system",
    "content": f"""
你是毛毛AI超级助手。

已知用户长期记忆：
{chr(10).join(memories)}

回答要简洁、实用、中文优先。
"""
}
    ]
    st.rerun()

for msg in st.session_state.messages:
    if msg["role"] == "system":
        continue
    st.chat_message(msg["role"]).write(msg["content"])

question = st.chat_input("请输入问题")

if question or uploaded_file:
    if not question:
        question = "请分析这张图片"

    if uploaded_file:
        image_base64 = base64.b64encode(uploaded_file.getvalue()).decode("utf-8")

        user_message = {
            "role": "user",
            "content": [
                {"type": "text", "text": question},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
                    }
                }
            ]
        }

        save_content = question + "【已上传图片】"

    else:
        user_message = {
            "role": "user",
            "content": question
        }

        save_content = question

    st.session_state.messages.append(user_message)
    save_message(user_id, "user", save_content)

    st.chat_message("user").write(question)
    
    response = client.chat.completions.create(
        model=model_name,
        messages=st.session_state.messages
    )

    answer = response.choices[0].message.content

    st.session_state.messages.append(
        {"role": "assistant", "content": answer}
    )

    save_message(user_id, "assistant", answer)

    st.chat_message("assistant").write(answer)
