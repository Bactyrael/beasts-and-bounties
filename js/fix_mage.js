const fs = require('fs');
let data = fs.readFileSync('js/data.js', 'utf8');
data = data.replace(/class:\s*"Mage",/g, 'class: "Mage",\n      type: "Magic",');
fs.writeFileSync('js/data.js', data);
console.log('Fixed Mage spells');
