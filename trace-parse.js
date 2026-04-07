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
        console.log('=== RAW RESPONSE ===');
        console.log('Length:', response.length);
        console.log('Bytes:', Buffer.from(response).toString('hex').substring(0, 100));
        
        console.log('\n=== STEP BY STEP PARSE ===');
        let text = response;
        
        console.log('1. Original length:', text.length);
        text = text.trim();
        console.log('2. After trim length:', text.length);
        
        try {
            let parsed = JSON.parse(text);
            console.log('3. Direct parse: SUCCESS');
            console.log('Keys:', Object.keys(parsed));
            return;
        } catch(e) {
            console.log('3. Direct parse: FAILED -', e.message);
        }
        
        let cleaned = text.replace(/^```json\s*/i, '');
        console.log('4. After replace ```json:', cleaned.length);
        
        cleaned = cleaned.replace(/^```\s*/i, '');
        console.log('5. After replace ```:', cleaned.length);
        
        cleaned = cleaned.replace(/\s*```\s*$/, '');
        console.log('6. After replace trailing ```:', cleaned.length);
        
        cleaned = cleaned.trim();
        console.log('7. After final trim:', cleaned.length);
        
        try {
            let parsed = JSON.parse(cleaned);
            console.log('8. Final parse: SUCCESS');
            console.log('Keys:', Object.keys(parsed));
        } catch(e) {
            console.log('8. Final parse: FAILED -', e.message);
        }
    })
    .catch(err => console.error('ERROR:', err.message));