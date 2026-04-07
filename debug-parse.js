require('dotenv').config({ path: './backend/.env' });

const text = '```json\n{"previewProblem":"test","previewHint":"hint","cta":"cta"}\n```';

console.log('=== Original ===');
console.log(text);

console.log('\n=== Step 1: replace ^```json\\s* ===');
let cleaned = text.replace(/^```json\s*/i, '');
console.log(cleaned);

console.log('\n=== Step 2: replace ^```\\s* ===');
cleaned = cleaned.replace(/^```\s*/i, '');
console.log(cleaned);

console.log('\n=== Step 3: replace \\s*```\\s*$ ===');
cleaned = cleaned.replace(/\s*```\s*$/, '');
console.log(cleaned);

console.log('\n=== Step 4: trim ===');
cleaned = cleaned.trim();
console.log(cleaned);

console.log('\n=== JSON.parse ===');
try {
    const parsed = JSON.parse(cleaned);
    console.log('SUCCESS:', parsed);
} catch(e) {
    console.log('FAILED:', e.message);
}