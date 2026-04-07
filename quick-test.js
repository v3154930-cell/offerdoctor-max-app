/**
 * Simple test
 */

const response = await fetch('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        product: "Курс по SMM",
        audience: "Начинающие маркетологи",
        scenario: "avito",
        platform: "avito",
        text: "Обучение SMM с нуля за 2 недели",
        mode: "preview"
    }),
    signal: AbortSignal.timeout(30000)
});

console.log('Status:', response.status);
const json = await response.json();
console.log('Result:', JSON.stringify(json, null, 2));