import streamlit as st
from openai import OpenAI
import base64
client = OpenAI(
    api_key=st.secrets["OPENAI_API_KEY"]
)
st.title("🤖毛毛AI超级助手")
st.caption("基于GPT构建的个人AI助手")

st.write("测试：下面应该出现上传按钮")
uploaded_file = st.file_uploader("上传图片", type=["png", "jpg", "jpeg"], key="image_upload")

if uploaded_file:
    st.image(uploaded_file, caption="已上传图片", width=300)

model_name = st.selectbox(

    "选择AI模型",
    [
        "gpt-5.5",
        "gpt-5.4",
        "gpt-5.4-mini"
    ]
)

st.success(f"当前模型：{model_name}")

if st.button("🗑️清空聊天记录"):
    st.session_state.messages = []
    st.rerun()

if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "system",
            "content": "你是毛毛AI超级助手，回答要简洁、实用、中文优先。"
        }
    ]

for msg in st.session_state.messages:  
    if msg["role"] == "system":
        continue
    st.chat_message(msg["role"]).write(msg["content"])

    uploaded_file = st.file_uploader("上传图片", type=["png", "jpg", "jpeg"])

question = st.chat_input("请输入问题")

if question or uploaded_file:
     
     if not question:
      question = "请分析这张图片"

     if uploaded_file:
        import base64

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
else:
        user_message = {
            "role": "user",
            "content": question
        }
st.session_state.messages.append(
        {"role": "user", "content": question}
    )

st.chat_message("user").write(question)

safe_messages = [
    msg for msg in st.session_state.messages
    if msg.get("content") is not None
]

response = client.chat.completions.create(
    model=model_name,
    messages=safe_messages
)

answer = response.choices[0].message.content

st.session_state.messages.append(
        {"role": "assistant", "content": answer}
    )

st.chat_message("assistant").write(answer)