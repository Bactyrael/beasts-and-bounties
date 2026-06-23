const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/data.js');
let content = fs.readFileSync(filePath, 'utf8');

const spellsToInsert = `    },
    {
      id: "abyssal_blast",
      name: "Abyssal Blast",
      class: "Occultist",
      actionType: "Ability",
      type: "Magic",
      attunement: 0,
      cost: "Free",
      actTime: "Action",
      range: "60 ft",
      components: "None",
      duration: "Instant",
      description: "You unleash the raw darkness that binds to your soul. The target must make a Constitution saving throw. On a failed save, the target takes 1d10 plus your Wisdom modifier Dark damage. On a successful save, it takes half damage."
    },
    {
      id: "dark_bargain",
      name: "Dark Bargain",
      class: "Occultist",
      actionType: "Ability",
      type: "Magic",
      attunement: 0,
      cost: "HP equal to Occultist Level",
      actTime: "Free Action",
      range: "Self",
      components: "None",
      duration: "Instant",
      description: "You sacrifice a portion of your own vitality to replenish your magical reserves. You lose hit points equal to your Occultist level and regain Mana Points equal to the same amount. If you do not have enough hit points to pay this cost, you may instead reduce your current hit points to 1 and gain Mana Points equal to the amount lost."
    },
    {
      id: "abyssal_manifestation",
      name: "Abyssal Manifestation",
      class: "Occultist",
      actionType: "Ability",
      type: "Magic",
      attunement: 0,
      cost: "Free",
      actTime: "Reaction",
      range: "60 ft",
      components: "None",
      duration: "Instant",
      description: "When your familiar is within 60 feet of you, you may use your Reaction to do one of the following:\\n• Swap: You and your familiar instantly exchange positions.\\n• Blink to Familiar: You teleport to an unoccupied space within 5 feet of your familiar.\\n• Familiar Blink: Your familiar teleports to an unoccupied space within 5 feet of you.\\nThese movements do not provoke opportunity attacks if they would move you or your familiar out of a creature's reach."
    }
],
  ITEMS: [`;

// Find the end of the spells array
content = content.replace(/    \}\r?\n\],\r?\n  ITEMS: \[/g, spellsToInsert);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Spells appended successfully.');
