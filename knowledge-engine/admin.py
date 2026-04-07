import streamlit as st
import requests
import json

st.set_page_config(page_title="Knowledge Engine Chat", layout="wide")
st.title("🧠 Knowledge Engine - Чат с Gemma")

API_URL = "http://localhost:8000"

if "messages" not in st.session_state:
    st.session_state.messages = []
if "project_id" not in st.session_state:
    st.session_state.project_id = None
if "step" not in st.session_state:
    st.session_state.step = "project_name"

with st.sidebar:
    st.header("📁 Проекты")
    
    try:
        projects = requests.get(f"{API_URL}/projects", timeout=5).json()
        for p in projects:
            if st.button(f"{p['name']} (id:{p['id']})", key=f"proj_{p['id']}"):
                st.session_state.project_id = p['id']
                st.session_state.project_name = p['name']
                st.session_state.messages = []
                st.session_state.step = "chat"
                st.rerun()
    except:
        st.info("Нет проектов или сервер не запущен")
    
    st.divider()
    
    if st.button("🆕 Новый проект"):
        st.session_state.project_id = None
        st.session_state.messages = []
        st.session_state.step = "project_name"
        st.rerun()

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

if st.session_state.step == "project_name":
    with st.chat_message("assistant"):
        st.write("Привет! Я помогу настроить базу знаний для вашего бота. Как назовем проект?")
        st.session_state.messages.append({"role": "assistant", "content": "Привет! Я помогу настроить базу знаний для вашего бота. Как назовем проект?"})
    
    user_input = st.chat_input("Введите название проекта...")
    if user_input:
        st.session_state.project_name = user_input
        st.session_state.messages.append({"role": "user", "content": user_input})
        st.session_state.step = "description"
        st.rerun()

elif st.session_state.step == "description":
    with st.chat_message("assistant"):
        st.write(f"Отлично! Проект '{st.session_state.project_name}'. Расскажите, что делает ваш бот? Какую базу знаний ему нужно собрать?")
        st.session_state.messages.append({"role": "assistant", "content": f"Отлично! Проект '{st.session_state.project_name}'. Расскажите, что делает ваш бот?"})
    
    user_input = st.chat_input("Опишите задачи бота...")
    if user_input:
        st.session_state.project_description = user_input
        st.session_state.messages.append({"role": "user", "content": user_input})
        st.session_state.step = "analyzing"
        
        with st.chat_message("assistant"):
            st.write("Анализирую...")
            try:
                response = requests.post(f"{API_URL}/api/setup/analyze", params={"description": user_input}, timeout=30)
                if response.status_code == 200:
                    analysis = response.json()
                    st.session_state.analysis = analysis
                    st.write("## 📋 Анализ проекта")
                    st.write(f"**Домен:** {analysis.get('domain', 'не определен')}")
                    st.write(f"**Предлагаемые источники:**")
                    for src in analysis.get('suggested_sources', [])[:5]:
                        st.write(f"- {src.get('title', src.get('url', 'Источник'))}")
                    st.write(f"**Предлагаемые теги:** {', '.join(analysis.get('suggested_tags', [])[:10])}")
                    st.session_state.messages.append({"role": "assistant", "content": f"Проанализировал. Домен: {analysis.get('domain', 'не определен')}"})
                    st.session_state.step = "confirm"
                else:
                    st.error(f"Ошибка: {response.text}")
                    st.session_state.step = "description"
            except Exception as e:
                st.error(f"Ошибка: {e}")
                st.session_state.step = "description"
        st.rerun()

elif st.session_state.step == "confirm":
    with st.chat_message("assistant"):
        st.write("Утверждаете предложенную конфигурацию? (да/нет)")
        st.session_state.messages.append({"role": "assistant", "content": "Утверждаете конфигурацию?"})
    
    user_input = st.chat_input("Ваш ответ...")
    if user_input:
        st.session_state.messages.append({"role": "user", "content": user_input})
        
        if user_input.lower() in ["да", "yes", "ок", "утверждаю"]:
            try:
                response = requests.post(f"{API_URL}/projects", json={"name": st.session_state.project_name, "description": st.session_state.project_description}, timeout=30)
                if response.status_code == 200:
                    project = response.json()
                    st.session_state.project_id = project.get("id")
                    with st.chat_message("assistant"):
                        st.write(f"✅ Проект '{st.session_state.project_name}' создан! ID: {st.session_state.project_id}")
                        st.session_state.messages.append({"role": "assistant", "content": "✅ Проект создан!"})
                    st.session_state.step = "chat"
                else:
                    st.error(f"Ошибка: {response.text}")
            except Exception as e:
                st.error(f"Ошибка: {e}")
        else:
            with st.chat_message("assistant"):
                st.write("Хорошо. Опишите, какие источники добавить вручную?")
                st.session_state.step = "manual_sources"
            st.session_state.messages.append({"role": "assistant", "content": "Опишите источники"})
        st.rerun()

elif st.session_state.step == "manual_sources":
    with st.chat_message("assistant"):
        st.write("Перечислите источники (URL или описание)")
        st.session_state.messages.append({"role": "assistant", "content": "Перечислите источники"})
    
    user_input = st.chat_input("Источники...")
    if user_input:
        st.session_state.messages.append({"role": "user", "content": user_input})
        try:
            response = requests.post(f"{API_URL}/projects", json={"name": st.session_state.project_name, "description": st.session_state.project_description}, timeout=30)
            if response.status_code == 200:
                project = response.json()
                st.session_state.project_id = project.get("id")
                with st.chat_message("assistant"):
                    st.write(f"✅ Проект '{st.session_state.project_name}' создан! Добавьте источники через боковое меню.")
                    st.session_state.messages.append({"role": "assistant", "content": "Проект создан, добавьте источники"})
                st.session_state.step = "chat"
        except Exception as e:
            st.error(f"Ошибка: {e}")
        st.rerun()

elif st.session_state.step == "chat":
    user_input = st.chat_input("Задайте вопрос или добавьте источник...")
    if user_input:
        st.session_state.messages.append({"role": "user", "content": user_input})
        
        with st.chat_message("assistant"):
            if user_input.startswith("http") or "добавь" in user_input.lower():
                st.write("Добавляю источник...")
                if st.session_state.project_id:
                    try:
                        resp = requests.post(f"{API_URL}/projects/{st.session_state.project_id}/sources", json={"title": "Добавленный", "source_type": "web", "url": user_input if user_input.startswith("http") else None, "manual_text": user_input}, timeout=30)
                        if resp.status_code == 200:
                            st.write("✅ Источник добавлен")
                        else:
                            st.write(f"Ошибка: {resp.text}")
                    except Exception as e:
                        st.write(f"Ошибка: {e}")
                else:
                    st.write("Сначала выберите проект")
            else:
                if st.session_state.project_id:
                    try:
                        search_resp = requests.post(f"{API_URL}/projects/{st.session_state.project_id}/search", json={"query": user_input, "top_k": 3}, timeout=30)
                        docs = search_resp.json() if search_resp.status_code == 200 else []
                        
                        if docs:
                            st.write("📄 **Найденные документы:**")
                            for doc in docs:
                                st.write(f"- {doc.get('text', '')[:200]}...")
                        
                        context = "\n".join([d.get('text', '') for d in docs]) if docs else "Нет документов"
                        prompt = f"Контекст: {context}\nВопрос: {user_input}\nОтветь на основе контекста."
                        
                        try:
                            ollama_resp = requests.post("http://localhost:11434/api/generate", json={"model": "gemma3:270m", "prompt": prompt, "stream": False}, timeout=60)
                            if ollama_resp.status_code == 200:
                                answer = ollama_resp.json().get("response", "Нет ответа")
                                st.write(answer)
                            else:
                                st.write("Gemma недоступна. Проверьте Ollama.")
                        except:
                            st.write("Контекст найден, но Gemma недоступна")
                    except Exception as e:
                        st.write(f"Ошибка: {e}")
                else:
                    st.write("Создайте или выберите проект слева")
        st.rerun()

with st.sidebar:
    st.divider()
    if st.session_state.get("project_id"):
        st.success(f"✅ Проект: {st.session_state.get('project_name', '')}")
    else:
        st.warning("⚠️ Проект не выбран")