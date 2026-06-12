const fs = require('fs');

const lines = fs.readFileSync('C:\\Users\\Joshan\\.gemini\\antigravity-ide\\brain\\cd228e72-a0f7-44b1-9390-416bf97600e9\\.system_generated\\logs\\transcript.jsonl', 'utf-8').split('\n').filter(Boolean);

let recoveredLines = new Map();

for (const line of lines) {
    try {
        const obj = JSON.parse(line);
        if (obj.content && obj.content.includes('File Path: `file:///C:/jpm_app/app/chat.tsx`')) {
            const contentLines = obj.content.split('\n');
            for (const cl of contentLines) {
                const match = cl.match(/^(\d+):([\s\S]*)$/);
                if (match) {
                    let text = match[2];
                    if (text.startsWith(' ')) text = text.substring(1);
                    text = text.replace(/\r$/, '');
                    recoveredLines.set(parseInt(match[1]), text);
                }
            }
        }
    } catch(e) {}
}

let out = '';
let maxLine = Math.max(...Array.from(recoveredLines.keys()), 0);
console.log('Max line:', maxLine, 'Recovered count:', recoveredLines.size);
for (let i = 1; i <= maxLine; i++) {
    if (recoveredLines.has(i)) {
        out += recoveredLines.get(i) + '\n';
    } else {
        out += `// MISSING LINE ${i}\n`;
    }
}
fs.writeFileSync('C:\\jpm_app\\app\\chat.tsx.partial', out);
