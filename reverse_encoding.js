const fs = require('fs');

let content = fs.readFileSync('js/character-sheet.js', 'utf8');

// The file currently has UTF-8 encoded versions of ANSI-decoded UTF-8 bytes.
// So if we take the string, encode it to latin1, we get the original UTF-8 bytes back.
try {
    let originalBuffer = Buffer.from(content, 'latin1');
    let restoredString = originalBuffer.toString('utf8');
    
    // Check if restored string contains the lock emoji
    if (restoredString.includes('🔒')) {
        console.log("Success! Reversal worked.");
        fs.writeFileSync('js/character-sheet.js', restoredString, 'utf8');
    } else {
        console.log("Reversal didn't produce the lock emoji. It might have failed or used a different encoding.");
        // Let's print a snippet to see what we got
        console.log("Snippet:", restoredString.substring(2840, 2880));
    }
} catch (e) {
    console.error("Error:", e);
}
