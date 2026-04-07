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
        
        console.log('=== CLEANED TEXT ===');
        console.log(cleaned);
        
        console.log('\n=== REGEX MATCHES ===');
        let ppMatch = cleaned.match(/"previewProblem"\s*:\s*"([^"]+)"/);
        let phMatch = cleaned.match(/"previewHint"\s*:\s*"([^"]+)"/);
        let ctaMatch = cleaned.match(/"cta"\s*:\s*"([^"]+)"/);
        
        console.log('ppMatch:', ppMatch);
        console.log('phMatch:', phMatch);
        console.log('ctaMatch:', ctaMatch);
        
        // Try without + (zero or more)
        console.log('\n=== REGEX WITH * ===');
        ppMatch = cleaned.match(/"previewProblem"\s*:\s*"([^"]*)"/);
        phMatch = cleaned.match(/"previewHint"\s*:\s*"([^"]*)"/);
        ctaMatch = cleaned.match(/"cta"\s*:\s*"([^"]*)"/);
        
        console.log('ppMatch:', ppMatch);
        console.log('phMatch:', phMatch);
        console.log('ctaMatch:', ctaMatch);
        
        // Check if key exists
        console.log('\n=== CHECK IF KEY EXISTS ===');
        console.log('Has previewProblem:', cleaned.includes('previewProblem'));
        console.log('Has previewHint:', cleaned.includes('previewHint'));
        console.log('Has cta:', cleaned.includes('"cta"'));
        
        // Try matching just the key
        let simple = cleaned.match(/"previewProblem":\s*"/);
        console.log('Simple previewProblem match:', simple);
    })
    .catch(err => console.error('ERROR:', err.message));