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
        console.log('=== RAW RESPONSE HEX ===');
        let hex = Buffer.from(response).toString('hex');
        console.log(hex);
        
        console.log('\n=== RAW RESPONSE ===');
        console.log(response);
        
        let cleaned = response.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();
        
        console.log('\n=== CLEANED HEX ===');
        let cleanedHex = Buffer.from(cleaned).toString('hex');
        console.log(cleanedHex);
        
        console.log('\n=== Checking for newlines in response ===');
        console.log('Has newlines:', cleaned.includes('\n'));
        console.log('Lines:', cleaned.split('\n').length);
        
        console.log('\n=== Check raw response bytes at problematic area ===');
        let bytes = Buffer.from(response);
        console.log('Byte at position 180:', bytes[180]);
        console.log('Byte at position 181:', bytes[181]);
        console.log('Byte at position 182:', bytes[182]);
        console.log('Byte at position 183:', bytes[183]);
        
        console.log('\n=== Try decode as different encodings ===');
        try {
            console.log('UTF-8:', cleaned);
        } catch(e) {
            console.log('UTF-8 failed:', e.message);
        }
        
        try {
            console.log('Latin1:', Buffer.from(cleaned, 'latin1').toString('utf8'));
        } catch(e) {
            console.log('Latin1 failed:', e.message);
        }
    })
    .catch(err => console.error('ERROR:', err.message));