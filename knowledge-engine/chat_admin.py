import streamlit as st
import requests
import json

st.set_page_config(page_title="Knowledge Engine Admin", layout="wide")
st.title("🧠 Knowledge Engine - Полная веб-админка")

API_URL = "http://localhost:8000"

if "project_id" not in st.session_state:
    st.session_state.project_id = None
if "messages" not in st.session_state:
    st.session_state.messages = []

with st.sidebar:
    st.header("📁 Управление")
    
    with st.expander("➕ Новый проект"):
        proj_name = st.text_input("Название")
        proj_desc = st.text_area("Описание")
        if st.button("Создать"):
            resp = requests.post(f"{API_URL}/projects", json={"name": proj_name, "description": proj_desc})
            if resp.status_code == 200:
                st.success(f"Проект {proj_name} создан!")
                st.rerun()
    
    st.subheader("📋 Проекты")
    try:
        resp = requests.get(f"{API_URL}/projects")
        if resp.status_code == 200:
            for p in resp.json():
                col1, col2 = st.columns([3, 1])
                with col1:
                    if st.button(f"{p['name']}", key=f"proj_{p['id']}"):
                        st.session_state.project_id = p['id']
                        st.rerun()
                with col2:
                    st.caption(f"id: {p['id']}")
    except:
        st.error("Сервер не запущен")
    
    st.divider()
    if st.session_state.project_id:
        st.success(f"Активный проект: {st.session_state.project_id}")

tab1, tab2, tab3, tab4 = st.tabs(["💬 Чат с Gemma", "🔍 Поиск", "📄 Источники", "⚙️ Статус"])

with tab1:
    st.header("Чат с Gemma")
    
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
    
    if prompt := st.chat_input("Задайте вопрос или опишите проект..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.write(prompt)
        
        with st.chat_message("assistant"):
            if st.session_state.project_id:
                resp = requests.post(f"{API_URL}/projects/{st.session_state.project_id}/search", 
                                    json={"query": prompt, "top_k": 3})
                if resp.status_code == 200:
                    results = resp.json()
                    if results:
                        st.write("📄 **Найденные документы:**")
                        for r in results[:3]:
                            st.write(f"- {r.get('text', '')[:200]}...")
                
                try:
                    ollama_resp = requests.post("http://localhost:11434/api/generate",
                                               json={"model": "gemma3:270m", "prompt": prompt, "stream": False})
                    if ollama_resp.status_code == 200:
                        answer = ollama_resp.json().get("response", "Нет ответа")
                        st.write(answer)
                    else:
                        st.write("Gemma не отвечает. Проверьте Ollama.")
                except:
                    st.write("Ошибка подключения к Ollama")
            else:
                st.write("Сначала выберите проект в боковой панели")
        
        st.session_state.messages.append({"role": "assistant", "content": "Ответ"})
        st.rerun()

with tab2:
    st.header("🔍 Поиск по базе знаний")
    
    if st.session_state.project_id:
        query = st.text_area("Введите запрос")
        top_k = st.slider("Количество результатов", 1, 10, 5)
        
        if st.button("Искать"):
            resp = requests.post(f"{API_URL}/projects/{st.session_state.project_id}/search",
                                json={"query": query, "top_k": top_k})
            if resp.status_code == 200:
                results = resp.json()
                for i, r in enumerate(results):
                    with st.expander(f"Результат {i+1} (score: {r.get('score', 0):.3f})"):
                        st.write(r.get('text', 'Нет текста'))
            else:
                st.error(f"Ошибка: {resp.text}")
    else:
        st.warning("Выберите проект")

with tab3:
    st.header("📄 Управление источниками")
    
    if st.session_state.project_id:
        resp = requests.get(f"{API_URL}/projects/{st.session_state.project_id}/sources")
        if resp.status_code == 200:
            sources = resp.json()
            for s in sources:
                st.write(f"**{s.get('title', 'Без названия')}** (id: {s.get('id')})")
                st.caption(s.get('url', 'Нет URL'))
                st.divider()
        
        with st.expander("➕ Добавить источник"):
            url = st.text_input("URL")
            title = st.text_input("Название")
            if st.button("Добавить"):
                resp = requests.post(f"{API_URL}/projects/{st.session_state.project_id}/sources",
                                    json={"url": url, "title": title})
                if resp.status_code == 200:
                    st.success("Источник добавлен!")
                    st.rerun()
    else:
        st.warning("Выберите проект")

with tab4:
    st.header("⚙️ Статус системы")
    
    try:
        resp = requests.get(f"{API_URL}/api/health")
        if resp.status_code == 200:
            st.success("✅ Сервер работает")
            st.json(resp.json())
        else:
            st.error("❌ Сервер не отвечает")
    except:
        st.error("❌ Сервер не запущен")
    
    try:
        resp = requests.get("http://localhost:11434/api/tags")
        if resp.status_code == 200:
            st.success("✅ Ollama работает")
            models = resp.json().get("models", [])
            for m in models:
                st.write(f"- {m.get('name')}")
        else:
            st.error("❌ Ollama не отвечает")
    except:
        st.error("❌ Ollama не запущен")