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
        
        console.log('=== Character analysis at position 220-230 ===');
        for (let i = 220; i < 235; i++) {
            let char = cleaned[i];
            let code = char ? char.charCodeAt(0) : 'N/A';
            console.log(`Position ${i}: char='${char}' code=${code} hex=${char ? char.charCodeAt(0).toString(16) : 'N/A'}`);
        }
        
        console.log('\n=== Looking for quotes around position 223 ===');
        console.log('Substring 210-240:', JSON.stringify(cleaned.substring(210, 240)));
        
        console.log('\n=== Double check: extract JSON between first { and last } ===');
        let start = cleaned.indexOf('{');
        let end = cleaned.lastIndexOf('}');
        let extracted = cleaned.substring(start, end + 1);
        
        for (let i = 220; i < 235; i++) {
            let char = extracted[i];
            let code = char ? char.charCodeAt(0) : 'N/A';
            console.log(`Position ${i}: char='${char}' code=${code}`);
        }
        
        console.log('\n=== Try parse again ===');
        try {
            JSON.parse(extracted);
            console.log('SUCCESS!');
        } catch(e) {
            console.log('FAILED:', e.message);
            
            let lines = extracted.split('\n');
            console.log('\n=== Lines ===');
            for (let i = 0; i < lines.length; i++) {
                console.log(`Line ${i}:`, lines[i].substring(0, 100));
            }
        }
    })
    .catch(err => console.error('ERROR:', err.message));