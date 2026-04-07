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
        console.log('\n=== Hex dump around error position 217 ===');
        console.log(Buffer.from(response).toString('hex').substring(200, 300));
        
        let cleaned = response.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();
        
        let startIdx = cleaned.indexOf('{');
        let endIdx = cleaned.lastIndexOf('}');
        let substring = cleaned.substring(startIdx, endIdx + 1);
        
        console.log('\n=== Extracted JSON ===');
        console.log(substring);
        console.log('\n=== Trying to parse ===');
        
        try {
            let parsed = JSON.parse(substring);
            console.log('SUCCESS:', Object.keys(parsed));
        } catch(e) {
            console.log('FAILED:', e.message);
            console.log('Trying different extraction...');
            
            let jsonMatch = substring.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    let parsed2 = JSON.parse(jsonMatch[0]);
                    console.log('Match extraction SUCCESS:', Object.keys(parsed2));
                } catch(e2) {
                    console.log('Match extraction FAILED:', e2.message);
                }
            }
        }
    })
    .catch(err => console.error('ERROR:', err.message));