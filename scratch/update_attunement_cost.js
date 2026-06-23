const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/character-sheet.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace occurrences of spell.attunement and spellData.attunement
// We only want to replace them where we have access to `char`. 
// Fortunately `char` is globally accessible in `render()` and the event listeners in character-sheet.js.

// 1. spell.attunement => window.BB_STATE.getSpellAttunementCost(char, spell)
content = content.replace(/usedAttunement \+= spell\.attunement;/g, 'usedAttunement += window.BB_STATE.getSpellAttunementCost(char, spell);');
content = content.replace(/\$\{spell\.attunement \|\| 0\}/g, '${window.BB_STATE.getSpellAttunementCost(char, spell)}');
content = content.replace(/let req = spell\.attunement \|\| 0;/g, 'let req = window.BB_STATE.getSpellAttunementCost(char, spell);');
content = content.replace(/spell\.attunement !== 1/g, 'window.BB_STATE.getSpellAttunementCost(char, spell) !== 1');
content = content.replace(/!spell\.attunement/g, '!window.BB_STATE.getSpellAttunementCost(char, spell)');

// 2. spellData.attunement => window.BB_STATE.getSpellAttunementCost(char, spellData)
content = content.replace(/spellData\.attunement/g, 'window.BB_STATE.getSpellAttunementCost(char, spellData)');

// 3. item.attunement => window.BB_STATE.getSpellAttunementCost(char, item)
// Only in the context of meta for spells
content = content.replace(/Attunement: \$\{item\.attunement\}/g, 'Attunement: ${window.BB_STATE.getSpellAttunementCost(char, item)}');


fs.writeFileSync(filePath, content, 'utf8');
console.log('Attunement costs updated successfully.');
