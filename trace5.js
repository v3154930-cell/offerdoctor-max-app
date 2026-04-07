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
        console.log('\n=== Cleaned (without code fences) ===');
        let cleaned = response.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();
        console.log(cleaned);
        
        console.log('\n=== Find where JSON starts and ends ===');
        let start = cleaned.indexOf('{');
        let end = cleaned.lastIndexOf('}');
        console.log('Start at:', start, ', End at:', end);
        
        console.log('\n=== Show content between first { and last } ===');
        let extracted = cleaned.substring(start, end + 1);
        
        let inString = false;
        let escapeNext = false;
        let prevChar = '';
        
        for (let i = 0; i < extracted.length; i++) {
            let char = extracted[i];
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
            }
            if (!inString && (char === ',' || char === '}') && prevChar === '"') {
                console.log(`Position ${i}: ${char} (string ended)`);
            }
            prevChar = char;
        }
        
        console.log('\n=== Try simple extraction: find balanced braces ===');
        let depth = 0;
        let lastComma = -1;
        for (let i = 0; i < extracted.length; i++) {
            if (extracted[i] === '{') depth++;
            if (extracted[i] === '}') depth--;
            if (extracted[i] === ',' && depth === 1) lastComma = i;
        }
        console.log('Last comma at depth 1:', lastComma);
        
        let firstProp = extracted.substring(0, lastComma + 1) + '}';
        console.log('First property:', firstProp.substring(0, 100));
        
        try {
            let p1 = JSON.parse(firstProp);
            console.log('First property parse: SUCCESS');
        } catch(e) {
            console.log('First property parse: FAILED -', e.message);
        }
    })
    .catch(err => console.error('ERROR:', err.message));