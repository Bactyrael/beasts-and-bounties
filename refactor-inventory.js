const fs = require('fs');
const file = 'C:/Users/rcmil/.gemini/antigravity/scratch/beasts-and-bounties/js/character-sheet.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the Inventory tab button
content = content.replace(/<button class="sheet-tab-btn \$\{activeTab === "inventory" \? "active" : ""\}" data-tab="inventory">Inventory<\/button>\s*/, '');

// 2. Extract the gridHtml logic and the inventory tab else if block
const inventoryMatch = content.match(/else if \(activeTab === "inventory"\) \{([\s\S]*?)\}\s*else if \(activeTab === "notes"\)/);
if (!inventoryMatch) {
  console.log('Failed to match inventory tab');
  process.exit(1);
}

// 3. Remove the else if (activeTab === "inventory") block entirely
content = content.replace(inventoryMatch[0], 'else if (activeTab === "notes")');

// 4. Extract the gridHtml logic specifically
const gridHtmlLogicMatch = inventoryMatch[1].match(/try \{([\s\S]*?)let gridHtml = char\.inventorySlots\.map\(\(itemName, i\) => \{[\s\S]*?\}\)\.join\(""\);/);
if (!gridHtmlLogicMatch) {
  console.log('Failed to match grid logic');
  process.exit(1);
}
const gridHtmlLogic = gridHtmlLogicMatch[0];

// 5. Build the new burden box HTML
const burdenBoxHtml = `
              <!-- Burden -->
              <div class="card burden-card glass" style="padding:10px 15px; border-radius:8px; margin-top:20px;">
                <h4 style="margin-top:0; margin-bottom:10px; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Burden</h4>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <div class="mini-stat" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
                    <strong>Encumbrance:</strong>
                    <span><input type="number" class="inline-hp-input" style="width:40px; margin-right:4px; text-align:right; font-size:0.75rem;" id="encumb-val" value="\${char.encumbrance}" readonly> / \${(char.equipment && char.equipment.armor === 'Heartcord' && (char._effectiveCon || char.stats.Con) < 18 ? 18 : (char._effectiveCon || char.stats.Con)) * 10} lbs</span>
                  </div>
                  <div class="mini-stat" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
                    <strong>Carry Capacity:</strong>
                    <span>\${(char._effectiveStr || char.stats.Str) * 10} lbs</span>
                  </div>
                  <div class="mini-stat" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
                    <strong>Push/Drag/Lift:</strong>
                    <span>\${(char._effectiveStr || char.stats.Str) * (char.equipment && char.equipment.hands === 'Goliath Grippers' ? 40 : 20)} lbs</span>
                  </div>
                </div>
              </div>`;

// 6. Build the new inventory UI HTML
const inventoryUIHtml = `
          <!-- Inventory Section -->
          <div class="inventory-section glass" style="margin-top:20px; padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
              <div style="flex:1;">
                <h2 style="margin-top:0; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Inventory</h2>
                <div style="position:relative; margin-top:10px;">
                  <input type="text" id="inventory-search" placeholder="Search compendium to add item..." style="width:100%; padding:8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light);">
                  <div id="inventory-search-results" style="position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:#1a1a1a; border:1px solid rgba(255,255,255,0.2); border-radius:4px; z-index:100; display:none; flex-direction:column; box-shadow:0 4px 8px rgba(0,0,0,0.5);"></div>
                </div>
                <div id="inventory-trash-zone" style="margin-top:10px; width:100%; height:50px; background:rgba(255,0,0,0.1); border:1px dashed rgba(255,0,0,0.4); border-radius:4px; display:flex; align-items:center; justify-content:center; color:rgba(255,0,0,0.7); font-size:0.9rem; transition:background 0.2s;">
                  Drag item here to discard
                </div>
              </div>
            </div>
            <div class="inventory-grid" style="display:flex; flex-direction:column; gap:4px; margin-top:10px; padding-bottom:20px; max-height: 500px; overflow-y: auto; padding-right: 8px;">
              \${gridHtml}
            </div>
          </div>`;

// 7. Inject grid logic and burden box into equipment tab
content = content.replace(/else if \(activeTab === "equipment"\) \{/, 'else if (activeTab === "equipment") {\n      ' + gridHtmlLogic.trim() + '\n');
content = content.replace(/<div class="coin-row crystal">[\s\S]*?<\/div>\s*<\/div>/, (match) => {
  return match + '\n' + burdenBoxHtml;
});

// 8. Inject inventory UI into equipment tab (before the return template string closing tags)
content = content.replace(/<\/div>\s*<\/div>\s*<\/div>\s*\`;\s*\}/, (match) => {
  // It replaces the closing of equipment-grid and equipment-tab-view
  return '  </div>\n' + inventoryUIHtml + '\n        </div>\n      `;\n      } catch (err) {\n        return `<div style="padding:20px; color:red; background:rgba(255,0,0,0.1); border:1px solid red; border-radius:8px;"><h3>Inventory Render Error</h3><p>\\${err.message}</p></div>`;\n      }\n    }';
});

fs.writeFileSync(file, content);
console.log('Successfully refactored inventory into equipment.');
