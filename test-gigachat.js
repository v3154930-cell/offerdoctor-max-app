/**
 * Direct GigaChat test
 */

require('dotenv').config({ path: './backend/.env' });

const gigachat = require('./api/gigachat');

const TEST_PROMPT = 'Ты — эксперт по маркетингу. Проанализируй кратко предложение: Курс по SMM для начинающих маркетологов. Верни ответ СТРОГО в формате JSON: {"previewProblem":"текст","previewHint":"текст","cta":"текст"}. Только JSON.';

console.log('=== Direct GigaChat Test ===');
console.log('AUTH_KEY present:', !!process.env.GIGACHAT_AUTH_KEY);

gigachat.requestGigachatWithRetry(TEST_PROMPT)
    .then(response => {
        console.log('\n=== RAW RESPONSE ===');
        console.log('Length:', response.length);
        console.log('First 500:', response.substring(0, 500));
        console.log('Last 300:', response.substring(Math.max(0, response.length - 300)));
        
        console.log('\n=== PARSE TEST ===');
        const parsed = gigachat.safeParseJsonFromModel(response);
        if (parsed) {
            console.log('PARSED:', JSON.stringify(parsed, null, 2));
        } else {
            console.log('PARSING FAILED');
        }
    })
    .catch(err => {
        console.error('ERROR:', err.message);
    });