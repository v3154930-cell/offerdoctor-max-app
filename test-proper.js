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
        
        console.log('=== Testing proper extraction ===');
        
        // Method: Manual parsing - find key, then find value between quotes
        function extractJsonValue(text, key) {
            let keyPos = text.indexOf('"' + key + '"');
            if (keyPos === -1) return null;
            
            let colonPos = text.indexOf(':', keyPos);
            if (colonPos === -1) return null;
            
            let firstQuote = text.indexOf('"', colonPos + 1);
            if (firstQuote === -1) return null;
            
            // Find closing quote, respecting escapes
            let i = firstQuote + 1;
            let result = '';
            while (i < text.length) {
                if (text[i] === '\\' && i + 1 < text.length) {
                    result += text[i] + text[i + 1];
                    i += 2;
                    continue;
                }
                if (text[i] === '"') {
                    return result;
                }
                result += text[i];
                i++;
            }
            return null;
        }
        
        let previewProblem = extractJsonValue(cleaned, 'previewProblem');
        let previewHint = extractJsonValue(cleaned, 'previewHint');
        let cta = extractJsonValue(cleaned, 'cta');
        
        console.log('previewProblem:', previewProblem ? 'EXISTS' : 'NULL');
        console.log('previewHint:', previewHint ? 'EXISTS' : 'NULL');
        console.log('cta:', cta ? 'EXISTS' : 'NULL');
        
        if (previewProblem && previewHint) {
            console.log('\n=== SUCCESS ===');
            console.log({ previewProblem, previewHint, cta });
        }
    })
    .catch(err => console.error('ERROR:', err.message));