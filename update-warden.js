const fs = require('fs');
let data = fs.readFileSync('js/data.js', 'utf8');

let count = 0;
// We'll use a regex replacement to add type: 'Nature' right after class: 'Warden' if it's not already there
let newData = data.replace(/class:\s*['"]Warden['"],(\s*)(?!type:)/g, (match, p1) => {
    count++;
    return match + 'type: "Nature",' + p1;
});

fs.writeFileSync('js/data.js', newData);
console.log('Added type: "Nature" to ' + count + ' Warden spells.');
