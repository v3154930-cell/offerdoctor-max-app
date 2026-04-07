require('dotenv').config({ path: './backend/.env' });

const cleaned = '{"previewProblem":"Отсутствие уникального торгового предложения (УТП), которое выделило бы курс среди конкурентов. \\"Обучение SMM с нуля\\" звучит шаблонно и не привлекает внимание начинающих маркетологов.","previewHint":"Добавьте конкретное преимущество курса, например: \\"Пошаговый план запуска вашей первой SMM-кампании за 7 дней\\" или \\"Готовые шаблоны постов и сторис, которые увеличат ваши продажи уже через месяц\\".","cta":"Получить полный разбор"}';

console.log('=== Original cleaned ===');
console.log(cleaned);

console.log('\n=== Simple regex match ===');
let ppMatch = cleaned.match(/"previewProblem"\s*:\s*"([^"]+)"/);
console.log('ppMatch:', ppMatch ? ppMatch[1] : 'null');

// Try simpler approach
console.log('\n=== Try indexOf approach ===');
let start = cleaned.indexOf('"previewProblem"');
if (start !== -1) {
    start = cleaned.indexOf('"', start + '"previewProblem"'.length + 1);
    let end = cleaned.indexOf('"', start + 1);
    console.log('Value:', cleaned.substring(start + 1, end));
}