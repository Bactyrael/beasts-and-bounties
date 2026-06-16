const fs = require('fs');
let content = fs.readFileSync('js/data.js', 'utf8');
let count = 0;
content = content.replace(/type:\s*"(Focus|Martial|Great)",\s*rarity:\s*"([^"]+)"/g, (match, p1, p2) => {
  count++;
  return `type: "${p1}",\n      rarity: "Uncommon"`;
});
fs.writeFileSync('js/data.js', content);
console.log('Replaced', count, 'instances');
