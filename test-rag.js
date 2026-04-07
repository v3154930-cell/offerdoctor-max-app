/**
 * RAG Test Script
 * Диагностика: RAG vs no-RAG запросы
 * Запускать: node test-rag.js
 */

require('dotenv').config({ path: './backend/.env' });

const TEST_PAYLOAD = {
    product: "Курс по SMM",
    audience: "Начинающие маркетологи",
    scenario: "avito",
    platform: "avito",
    text: "Обучение SMM с нуля за 2 недели",
    mode: "preview"
};

const BASE_URL = 'http://localhost:3000';

async function makeRequest(payload, label) {
    console.log(`\n[${label}] START`);
    console.log(`[${label}] Payload:`, JSON.stringify(payload));
    const start = Date.now();
    
    try {
        const response = await fetch(`${BASE_URL}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000)
        });
        
        const duration = Date.now() - start;
        console.log(`[${label}] END (${duration}ms), status: ${response.status}`);
        
        if (!response.ok) {
            const error = await response.text();
            console.log(`[${label}] Error:`, error);
            return { error: error, duration };
        }
        
        const result = await response.json();
        console.log(`[${label}] Response keys:`, Object.keys(result));
        return { result, duration };
    } catch (err) {
        const duration = Date.now() - start;
        console.log(`[${label}] FAILED (${duration}ms):`, err.message);
        return { error: err.message, duration };
    }
}

async function main() {
    console.log('=== RAG DIAGNOSTIC TEST ===');
    console.log('BASE_URL:', BASE_URL);
    console.log('ENABLE_RAG:', process.env.ENABLE_RAG);
    console.log('KNOWLEDGE_ENGINE_URL:', process.env.KNOWLEDGE_ENGINE_URL);
    console.log('KNOWLEDGE_PROJECT_ID:', process.env.KNOWLEDGE_PROJECT_ID ? 'SET' : 'NOT SET');
    
    // Test 1: no-RAG (по умолчанию, без enable)
    console.log('\n=== TEST 1: NO-RAG ===');
    await makeRequest(TEST_PAYLOAD, 'NO_RAG');
    
    // Test 2: включить RAG
    console.log('\n=== TEST 2: WITH RAG ===');
    process.env.ENABLE_RAG = 'true';
    
    // Перезапустить knowledge client с новым env
    delete require.cache[require.resolve('./api/knowledge')];
    const knowledge = require('./api/knowledge');
    console.log('Knowledge isEnabled:', knowledge.isEnabled());
    
    await makeRequest(TEST_PAYLOAD, 'WITH_RAG');
    
    console.log('\n=== DONE ===');
}

main().catch(console.error);