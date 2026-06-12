const fs = require('fs');
const path = 'C:/jpm_app/app/inventory/index.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("'🚀 Promote Product',", "'Promote Product',");
content = content.replace("'Product promoted successfully! 🚀'", "'Product promoted successfully!'");

fs.writeFileSync(path, content, 'utf8');
console.log("Removed emojis from inventory.");
