const res = await fetch('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        product: 'Курс по SMM',
        audience: 'Начинающие маркетологи',
        text: 'Обучение SMM с нуля',
        mode: 'preview'
    })
});
console.log('Status:', res.status);
const json = await res.json();
console.log('Result:', JSON.stringify(json, null, 2));