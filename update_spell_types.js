const fs = require('fs');
let content = fs.readFileSync('js/data.js', 'utf8');

// First, clean up the duplicate 'type:' entries we accidentally added.
// We look for 'type: "Spell",\n      type:' or 'type: "Ability",\n      type:' and remove the first one.
content = content.replace(/type:\s*"(?:Spell|Ability)",\s*\n\s*type:/g, 'type:');

// Also clean up any that were added but didn't have a duplicate type: right after them, just in case.
// Wait, my previous script only added it if it matched the class regex. Let's just remove ALL type: "Spell" and type: "Ability".
content = content.replace(/type:\s*"Spell",\s*\n/g, '');
content = content.replace(/type:\s*"Ability",\s*\n/g, '');

const spellClasses = ['Archon', 'Invoker', 'Justicar', 'Mage', 'Occultist', 'Warden'];
const abilityClasses = ['Berserker', 'Disciple', 'Herald', 'Prowler', 'Tracker', 'Vanguard', 'beserker'];

let spellRegex = /(name:\s*"[^"]+",\s*\n\s*class:\s*"([^"]+)",)/g;
content = content.replace(spellRegex, (match, p1, p2) => {
    let actionType = spellClasses.some(c => p2.toLowerCase() === c.toLowerCase()) ? 'Spell' :
                     abilityClasses.some(c => p2.toLowerCase() === c.toLowerCase()) ? 'Ability' : null;
    if (actionType) {
        return p1 + '\n      actionType: "' + actionType + '",';
    }
    return match;
});

fs.writeFileSync('js/data.js', content);
console.log('Fixed data.js with actionType.');
