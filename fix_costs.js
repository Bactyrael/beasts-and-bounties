const fs = require('fs');
const path = './js/data.js';

let content = fs.readFileSync(path, 'utf8');

// We need to replace "Gold Pieces (GP)" with "Crystal Pieces (CP)"
// for any item block that has slot: "Head", "Hands", "Feet", "Waist", "Neck", "Finger", "Body" etc.
// Basically, if type is not a Weapon, Implement, or Shield.
// Let's iterate through each item object.

// Actually, let's just do a regex replace using a callback that matches the whole item block.
// Each item in data.js seems to be an object enclosed in { ... } or spanning multiple lines.
// Wait, the items that got changed were in the `ITEMS` array, `MAGIC_ITEMS` array, etc.
// The easiest way is to match `{ ... cost: "X Gold Pieces (GP)" ... slot: "Y" ... }` 
// and if Y is one of the target slots, replace it.

const regex = /(\{\s*name:.*?)cost:\s*"(\d+)\s+Gold\s+Pieces\s+\(GP\)"(.*?type:\s*"([^"]+)"(.*?)slot:\s*"([^"]+)"(.*?)\})/gs;

content = content.replace(regex, (match, p1, costAmt, p3, typeStr, p5, slotStr, p7) => {
    // Check if type or slot indicates it's a weapon, implement, or shield
    const isWeaponOrShieldOrImplement = 
        typeStr.includes("Weapon") || 
        typeStr.includes("Implement") || 
        typeStr.includes("Shield") ||
        slotStr.includes("Main Hand") || 
        slotStr.includes("Off Hand") ||
        slotStr.includes("Two Hands");

    // Tools and instruments had GP originally, so we don't want to change them to CP unless they were originally CP.
    // Wait, the user specifically mentioned:
    // "Items in the head, hands, feet, waist, neck, finger, slots that were priced in crystal pieces should be in crystal pieces."
    // Let's check the slot exactly.
    const targetSlots = ["Head", "Hands", "Feet", "Waist", "Neck", "Finger", "Body"];
    
    // Also "Crystal Pieces" were for armor / magic items mostly? 
    // Let's just check if the slot is one of the target slots, and if so, change to CP.
    if (targetSlots.some(s => slotStr.includes(s))) {
        return `${p1}cost: "${costAmt} Crystal Pieces (CP)"${p3}type: "${typeStr}"${p5}slot: "${slotStr}"${p7}`;
    }

    return match; // Leave as GP
});

// Also match the other order: slot then type
const regex2 = /(\{\s*name:.*?)cost:\s*"(\d+)\s+Gold\s+Pieces\s+\(GP\)"(.*?slot:\s*"([^"]+)"(.*?)type:\s*"([^"]+)"(.*?)\})/gs;
content = content.replace(regex2, (match, p1, costAmt, p3, slotStr, p5, typeStr, p7) => {
    const targetSlots = ["Head", "Hands", "Feet", "Waist", "Neck", "Finger", "Body"];
    if (targetSlots.some(s => slotStr.includes(s))) {
        return `${p1}cost: "${costAmt} Crystal Pieces (CP)"${p3}slot: "${slotStr}"${p5}type: "${typeStr}"${p7}`;
    }
    return match;
});

// One more case: Some items might have cost after type/slot
const regex3 = /(\{\s*name:.*?type:\s*"([^"]+)".*?slot:\s*"([^"]+)".*?)cost:\s*"(\d+)\s+Gold\s+Pieces\s+\(GP\)"(.*?)\}/gs;
content = content.replace(regex3, (match, p1, typeStr, slotStr, costAmt, p5) => {
    const targetSlots = ["Head", "Hands", "Feet", "Waist", "Neck", "Finger", "Body"];
    if (targetSlots.some(s => slotStr.includes(s))) {
        return `${p1}cost: "${costAmt} Crystal Pieces (CP)"${p5}`;
    }
    return match;
});

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
