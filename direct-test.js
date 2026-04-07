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
console.log('=== PROMPT ===');
console.log(prompt);
console.log('\n=== CALLING GIGACHAT ===');

gigachat.requestGigachatWithRetry(prompt)
    .then(response => {
        console.log('\n=== RAW RESPONSE ===');
        console.log('Length:', response.length);
        console.log('Content:', response);
        
        console.log('\n=== PARSING ===');
        const parsed = gigachat.safeParseJsonFromModel(response);
        console.log('Parsed:', parsed ? 'SUCCESS' : 'FAILED');
        if (parsed) {
            console.log('JSON:', parsed);
            console.log('previewProblem:', parsed.previewProblem ? 'EXISTS' : 'MISSING');
            console.log('previewHint:', parsed.previewHint ? 'EXISTS' : 'MISSING');
        }
    })
    .catch(err => {
        console.error('ERROR:', err.message);
    });