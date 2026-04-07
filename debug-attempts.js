require('dotenv').config({ path: './backend/.env' });

const prompts = require('./api/prompts');
const gigachat = require('./api/gigachat');

const data = {
    product: "Курс по SMM",
    audience: "Начинающие маркетологи",
    text: "Обучение SMM с нуля",
    mode: "preview",
    scenario: "avito",
    platform: "avito"
};

const prompt = prompts.buildPreviewPrompt(data, null);

gigachat.requestGigachatWithRetry(prompt)
    .then(response => {
        console.log('=== Test each attempt manually ===');
        
        let text = response.trim();
        
        console.log('\n1. Direct JSON.parse:');
        try {
            let r = JSON.parse(text);
            console.log('   SUCCESS:', r);
        } catch(e) {
            console.log('   FAILED:', e.message.substring(0, 50));
        }
        
        let cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();
        console.log('\n2. Cleaned text:');
        console.log('   ', cleaned.substring(0, 100));
        
        console.log('\n3. JSON.parse on cleaned:');
        try {
            let r = JSON.parse(cleaned);
            console.log('   SUCCESS:', r);
        } catch(e) {
            console.log('   FAILED:', e.message.substring(0, 50));
        }
        
        console.log('\n4. Extract between { and }:');
        let startIdx = cleaned.indexOf('{');
        let endIdx = cleaned.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            let extracted = cleaned.substring(startIdx, endIdx + 1);
            console.log('   Extracted:', extracted.substring(0, 100));
            try {
                let r = JSON.parse(extracted);
                console.log('   SUCCESS:', r);
            } catch(e) {
                console.log('   FAILED:', e.message.substring(0, 50));
            }
        }
    })
    .catch(err => console.error('ERROR:', err.message));