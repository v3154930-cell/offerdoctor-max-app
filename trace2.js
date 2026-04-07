require('dotenv').config({ path: './backend/.env' });

const text = '```json\n{"previewProblem":"Отсутствие уникального торгового предложения (УТП), которое выделило бы курс среди конкурентов. \"Обучение SMM с нуля\" звучит общо и не привлекает внимание начинающих маркетологов.\",\"previewHint\":\"Добавьте конкретное преимущество курса, например: \\\"Пошаговый план запуска вашей первой SMM-кампании за 7 дней\\\"\", \"cta\":\"Получить полный разбор\"}\n```';

console.log('=== Testing escape sequences ===');

let cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```\s*$/, '').trim();

console.log('Cleaned length:', cleaned.length);
console.log('Last 50 chars:', cleaned.substring(cleaned.length - 50));
console.log('Char codes at end:', cleaned.slice(-10).map(c => c.charCodeAt(0)));

try {
    let parsed = JSON.parse(cleaned);
    console.log('Parse SUCCESS');
} catch(e) {
    console.log('Parse FAILED:', e.message);
    
    let startIdx = cleaned.indexOf('{');
    let endIdx = cleaned.lastIndexOf('}');
    console.log('Start { at:', startIdx);
    console.log('Last } at:', endIdx);
    
    if (endIdx > startIdx) {
        let substring = cleaned.substring(startIdx, endIdx + 1);
        console.log('Substring length:', substring.length);
        console.log('Substring ends with:', substring.slice(-10));
        
        try {
            let parsed2 = JSON.parse(substring);
            console.log('Substring parse: SUCCESS');
        } catch(e2) {
            console.log('Substring parse FAILED:', e2.message);
            console.log('Trying to find where it breaks...');
            
            for (let i = 200; i < 250; i++) {
                try {
                    JSON.parse(substring.substring(0, i));
                } catch(e3) {
                    console.log('Break at position', i, ':', substring.substring(i-10, i+10));
                    break;
                }
            }
        }
    }
}