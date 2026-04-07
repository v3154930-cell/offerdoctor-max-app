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
        let cleaned = response.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();
        
        console.log('=== Direct JSON.parse test ===');
        console.log('Cleaned text:');
        console.log(cleaned);
        console.log('\n--- Parsing ---');
        
        try {
            let result = JSON.parse(cleaned);
            console.log('SUCCESS!');
            console.log('Keys:', Object.keys(result));
            console.log('Values:');
            for (let key in result) {
                console.log('  ' + key + ':', result[key].substring(0, 50));
            }
        } catch(e) {
            console.log('FAILED:', e.message);
        }
    })
    .catch(err => console.error('ERROR:', err.message));