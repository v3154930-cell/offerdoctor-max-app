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
        
        console.log('=== Char codes around position 197-205 ===');
        for (let i = 195; i < 210; i++) {
            console.log(i + ':', cleaned.charCodeAt(i), '=', JSON.stringify(cleaned[i]));
        }
        
        console.log('\n=== Substring around error ===');
        console.log('195-210:', cleaned.substring(195, 210));
        
        console.log('\n=== Try replacing backslash-quote with proper escape ===');
        let fixed = cleaned.replace(/\\"/g, '\\\\"');
        console.log('Fixed:', fixed.substring(195, 210));
        
        console.log('\n=== Try parsing fixed ===');
        try {
            let result = JSON.parse(fixed);
            console.log('SUCCESS!');
        } catch(e) {
            console.log('FAILED:', e.message);
            
            console.log('\n=== Try stripping inner quotes ===');
            // Simple approach - find all "..." patterns and escape them properly inside values
            let resultObj = {};
            let lines = cleaned.split(',');
            for (let line of lines) {
                let colonIdx = line.indexOf(':');
                if (colonIdx === -1) continue;
                let key = line.substring(1, colonIdx-1).trim();
                let value = line.substring(colonIdx+1).trim();
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.substring(1, value.length-1);
                }
                resultObj[key] = value;
            }
            console.log('Extracted:', resultObj);
        }
    })
    .catch(err => console.error('ERROR:', err.message));