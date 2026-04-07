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
        
        console.log('\n=== PROPOSED FIX: Smart quote handler ===');
        
        function fixJson(text) {
            let result = '';
            let inString = false;
            let i = 0;
            
            while (i < text.length) {
                let char = text[i];
                
                if (char === '\\' && i + 1 < text.length) {
                    result += char + text[i + 1];
                    i += 2;
                    continue;
                }
                
                if (char === '"') {
                    if (!inString) {
                        inString = true;
                        result += char;
                    } else {
                        let nextChar = text[i + 1];
                        if (nextChar === '"') {
                            result += '\\"';
                            i += 2;
                            continue;
                        } else if (nextChar === '\\') {
                            result += char;
                        } else {
                            inString = false;
                            result += char;
                        }
                    }
                } else {
                    result += char;
                }
                i++;
            }
            return result;
        }
        
        let fixed = fixJson(cleaned);
        console.log('Fixed:', fixed.substring(0, 300));
        
        try {
            let parsed = JSON.parse(fixed);
            console.log('\n=== FIX SUCCESS ===');
            console.log('Keys:', Object.keys(parsed));
        } catch(e) {
            console.log('\n=== FIX FAILED ===');
            console.log('Error:', e.message);
            
            console.log('\n=== Alternative: Manual field extraction ===');
            let previewProblem = cleaned.match(/"previewProblem"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/);
            let previewHint = cleaned.match(/"previewHint"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/);
            let cta = cleaned.match(/"cta"\s*:\s*"([^"]*)"/);
            
            console.log('previewProblem:', previewProblem ? previewProblem[1] : 'NOT FOUND');
            console.log('previewHint:', previewHint ? previewHint[1] : 'NOT FOUND');
            console.log('cta:', cta ? cta[1] : 'NOT FOUND');
            
            if (previewProblem && previewHint && cta) {
                console.log('\n=== MANUAL EXTRACTION SUCCESS ===');
            }
        }
    })
    .catch(err => console.error('ERROR:', err.message));