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
        console.log('=== Response char codes at start ===');
        for (let i = 0; i < 20; i++) {
            console.log(i, response.charCodeAt(i), response[i]);
        }
        
        console.log('\n=== Try different replacements ===');
        console.log('replace with regex literal backtick:');
        let t1 = response.replace(/^```json\s*/i, '');
        console.log('Result:', t1.substring(0, 50));
        
        console.log('\nreplace with escaped backtick:');
        let t2 = response.replace(/^\x60\x60\x60json\s*/i, '');
        console.log('Result:', t2.substring(0, 50));
        
        console.log('\nreplace with string replace:');
        let t3 = response.substring(response.indexOf('{'));
        console.log('Result:', t3.substring(0, 50));
        
        console.log('\n=== Try parsing t3 ===');
        try {
            JSON.parse(t3);
            console.log('SUCCESS');
        } catch(e) {
            console.log('FAILED:', e.message);
        }
    })
    .catch(err => console.error('ERROR:', err.message));