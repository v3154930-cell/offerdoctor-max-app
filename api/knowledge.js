/**
 * Knowledge Engine client
 * Интеграция с RAG-системой для получения контекста из базы знаний
 */

require('dotenv').config({ quiet: true });

const KNOWLEDGE_ENGINE_URL = process.env.KNOWLEDGE_ENGINE_URL || '';
const KNOWLEDGE_PROJECT_ID = process.env.KNOWLEDGE_PROJECT_ID || '';
const ENABLE_RAG = process.env.ENABLE_RAG === 'true';
const RAG_TOP_K = parseInt(process.env.RAG_TOP_K || '5', 10);

function isEnabled() {
    return ENABLE_RAG && KNOWLEDGE_ENGINE_URL && KNOWLEDGE_PROJECT_ID;
}

function buildQuery(data) {
    const parts = [
        data.product,
        data.audience,
        data.scenario,
        data.platform,
        data.text,
        data.link,
        data.pain
    ].filter(Boolean);
    return parts.join(' ');
}

function getKnowledgeContext(data) {
    return new Promise((resolve) => {
        if (!isEnabled()) {
            console.log('[Knowledge] RAG отключён (ENABLE_RAG != true или не настроен URL/PROJECT_ID)');
            return resolve(null);
        }

        const query = buildQuery(data);
        console.log('[DEBUG knowledge.js] buildQuery result:', query);
        
        if (!query.trim()) {
            console.log('[Knowledge] Нет данных для поиска');
            return resolve(null);
        }

        const url = `${KNOWLEDGE_ENGINE_URL}/projects/${KNOWLEDGE_PROJECT_ID}/search?query=${encodeURIComponent(query)}&top_k=${RAG_TOP_K}`;
        
        console.log('[DEBUG knowledge.js] URL query param:', encodeURIComponent(query));
        console.log('[Knowledge] Поиск по базе знаний, query:', query.substring(0, 100));
        
        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(10000)
        };

        fetch(url, fetchOptions)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.json();
            })
            .then((results) => {
                if (!Array.isArray(results) || results.length === 0) {
                    console.log('[Knowledge] Нет результатов поиска');
                    return resolve(null);
                }

                // Filter, deduplicate and limit context parts
                const seen = new Set();
                const contextParts = results
                    .filter((r) => r.text && r.text.trim())
                    .map((r) => r.text.trim())
                    .filter((text) => {
                        // Simple deduplication by first 50 chars as key
                        const key = text.substring(0, 50);
                        if (seen.has(key)) {
                            return false;
                        }
                        seen.add(key);
                        return true;
                    })
                    .slice(0, RAG_TOP_K);

                if (contextParts.length === 0) {
                    console.log('[Knowledge] Нет текста в результатах');
                    return resolve(null);
                }

                console.log('[Knowledge] Дедиплицировано контекста:', contextParts.length, 'блоков (из', results.length, 'результатов)');
                const knowledgeContext = contextParts.join('\n\n');
                resolve(knowledgeContext);
            })
            .catch((err) => {
                console.error('[Knowledge] Ошибка при запросе к knowledge-engine:', err.message);
                resolve(null);
            });
    });
}

module.exports = {
    getKnowledgeContext,
    isEnabled
};