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
        
        console.log('=== Check for malformed JSON: missing closing quote ===');
        console.log('Full cleaned text:');
        console.log(cleaned);
        
        console.log('\n=== Check each property boundary ===');
        // Find where each property starts and ends
        let prop1Start = cleaned.indexOf('"previewProblem"');
        let prop1Colon = cleaned.indexOf(':', prop1Start);
        let prop1ValueStart = cleaned.indexOf('"', prop1Colon + 1);
        
        // Find the closing of previewProblem value - look for "," or "}"
        let prop1ValueEnd = -1;
        let searchStart = prop1ValueStart + 1;
        let inString = true;
        let escapeNext = false;
        
        for (let i = searchStart; i < cleaned.length; i++) {
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
                // End of string found
                prop1ValueEnd = i;
                break;
            }
        }
        
        console.log('prop1 starts at:', prop1Start);
        console.log('prop1 value starts at:', prop1ValueStart);
        console.log('prop1 value ends at:', prop1ValueEnd);
        
        if (prop1ValueEnd !== -1) {
            console.log('prop1 value:', cleaned.substring(prop1ValueStart, prop1ValueEnd + 1));
        }
        
        console.log('\n=== What comes after prop1 value ===');
        console.log('After prop1 value:', cleaned.substring(prop1ValueEnd, prop1ValueEnd + 20));
        
        console.log('\n=== Is it valid JSON? ===');
        console.log('Has .\\":', cleaned.includes('\\"'));
        
        // Try fixing: escape all unescaped quotes
        let fixed = '';
        let inQuote = false;
        for (let i = 0; i < cleaned.length; i++) {
            let char = cleaned[i];
            if (char === '\\' && i + 1 < cleaned.length && cleaned[i+1] === '"') {
                fixed += char + cleaned[i+1];
                i++;
                continue;
            }
            if (char === '"' && !inQuote) {
                inQuote = true;
                fixed += char;
            } else if (char === '"' && inQuote) {
                // Check if next char is : or , or } - if so, this is end of string
                let next = cleaned[i+1];
                if (next === ':' || next === ',' || next === '}' || next === ' ' || next === '\n') {
                    inQuote = false;
                    fixed += char;
                } else {
                    // This is an unescaped quote inside string - escape it
                    fixed += '\\"';
                }
            } else {
                fixed += char;
            }
        }
        
        console.log('\n=== Try parse fixed ===');
        try {
            let result = JSON.parse(fixed);
            console.log('SUCCESS!');
            console.log('Keys:', Object.keys(result));
        } catch(e) {
            console.log('FAILED:', e.message);
        }
    })
    .catch(err => console.error('ERROR:', err.message));