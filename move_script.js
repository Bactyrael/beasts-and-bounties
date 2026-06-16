const fs = require('fs');

let lines = fs.readFileSync('js/character-sheet.js', 'utf8').split('\n');

let start_idx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("<!-- Right side: Combat Stats -->")) {
        start_idx = i;
        break;
    }
}

if (start_idx === -1) {
    console.error("Could not find start_idx");
    process.exit(1);
}

let div_count = 0;
let end_idx = -1;
for (let i = start_idx; i < lines.length; i++) {
    let line = lines[i];
    let opens = (line.match(/<div/g) || []).length;
    let closes = (line.match(/<\/div/g) || []).length;
    div_count += opens - closes;
    if (div_count === 0 && opens > 0) {
        end_idx = i;
        break;
    }
}

if (end_idx === -1) {
    console.error("Could not find end_idx");
    process.exit(1);
}

let moved_lines = lines.slice(start_idx, end_idx + 1);
lines.splice(start_idx, (end_idx - start_idx + 1));

let spells_return_idx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('return `') && lines[i+1] && lines[i+1].includes('class="spells-tab-view"')) {
        spells_return_idx = i;
        break;
    }
}

if (spells_return_idx === -1) {
    console.error("Could not find spells_return_idx");
    process.exit(1);
}

let spells_end_idx = -1;
for (let i = spells_return_idx; i < lines.length; i++) {
    if (lines[i].includes('`;') && lines[i+2] && lines[i+2].includes('else if (activeTab === "talents")')) {
        spells_end_idx = i;
        break;
    }
}

if (spells_end_idx === -1) {
    console.error("Could not find spells_end_idx");
    process.exit(1);
}

lines[spells_return_idx] = '      return `\n        <div style="display:flex; gap:20px; justify-content:center; align-items:flex-start;">\n          <div style="flex:1; max-width:500px;">';

let insert_idx = spells_end_idx;
lines.splice(insert_idx, 0, '          </div>');
insert_idx++;

for (let i = 0; i < moved_lines.length; i++) {
    lines.splice(insert_idx, 0, moved_lines[i]);
    insert_idx++;
}

lines.splice(insert_idx, 0, '        </div>');

fs.writeFileSync('js/character-sheet.js', lines.join('\n'));
console.log("Success");
