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
        console.log(response);
        
        let cleaned = response.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();
        
        console.log('\n=== Find unescaped quotes inside strings ===');
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < cleaned.length; i++) {
            let char = cleaned[i];
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            if (char === '"') {
                if (!inString) {
                    inString = true;
                } else {
                    inString = false;
                }
            }
            if (inString && char === '"' && !escapeNext) {
                console.log(`Found unescaped quote at position ${i}: ...${cleaned.substring(Math.max(0, i-30), i+30)}...`);
            }
        }
        
        console.log('\n=== Try fix: escape unescaped quotes inside strings ===');
        let fixed = '';
        inString = false;
        escapeNext = false;
        
        for (let i = 0; i < cleaned.length; i++) {
            let char = cleaned[i];
            if (escapeNext) {
                fixed += char;
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                fixed += char;
                escapeNext = true;
                continue;
            }
            if (char === '"') {
                if (!inString) {
                    inString = true;
                    fixed += char;
                } else {
                    let nextChar = cleaned[i+1];
                    if (nextChar === '"' || nextChar === ',' || nextChar === '}' || nextChar === ' ' || nextChar === '\n') {
                        inString = false;
                        fixed += '\\"';
                        continue;
                    } else {
                        fixed += '\\"';
                        continue;
                    }
                }
            } else {
                fixed += char;
            }
        }
        
        console.log('Fixed version:', fixed.substring(0, 200));
        
        try {
            let parsed = JSON.parse(fixed);
            console.log('\n=== FIXED PARSE: SUCCESS ===');
            console.log('Keys:', Object.keys(parsed));
        } catch(e) {
            console.log('\n=== FIXED PARSE: FAILED ===');
            console.log('Error:', e.message);
        }
    })
    .catch(err => console.error('ERROR:', err.message));