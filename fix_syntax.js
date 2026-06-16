const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace the literal string "`n" with an actual newline
    content = content.replace(/`n/g, '\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
}

fixFile(path.join(__dirname, 'js', 'compendium.js'));
fixFile(path.join(__dirname, 'js', 'character-sheet.js'));
