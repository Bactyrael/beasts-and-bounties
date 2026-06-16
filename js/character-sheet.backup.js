// B&B Interactive Character Sheet Viewer
window.BB_CHARACTER_SHEET = (() => {
  let activeTab = "skills";

  function init() {
    render();
    
    // Subscribe to state updates to re-render when character state changes
    window.BB_STATE.subscribe("active_character_changed", () => {
      render();
    });
  }

  function render() {
    const container = document.getElementById("main-view-container");
    if (!container) return;

    const char = window.BB_STATE.getActiveCharacter();
    const allChars = window.BB_STATE.getSavedCharacters();

    if (!char) {
      container.innerHTML = `
        <div class="empty-sheet-view glass">
          <h2>No Hunter Selected</h2>
          <p>Forge a new hunter to start tracking bounties in the Borderlands.</p>
          <a href="#/builder" class="btn btn-primary">Go to Character Forge</a>
        </div>
      `;
      return;
    }

    // Calculate dynamic attunement values
    let totalAttunementSlots = char.level;
    if (char.talents && char.talents.includes("Attuned")) {
      totalAttunementSlots += 1;
    }
    if (char.equipment && Object.values(char.equipment).includes("Elephant's Amulet")) {
      totalAttunementSlots += 1;
    }
    let usedAttunement = 0;
    if (char.spells && window.BB_DATABASE && window.BB_DATABASE.SPELLS) {
      char.spells.forEach(spellId => {
        const spell = window.BB_DATABASE.SPELLS.find(s => s.id === spellId);
        if (spell && spell.attunement) {
          usedAttunement += spell.attunement;
        }
      });
    }
    char.attunement = { used: usedAttunement, total: totalAttunementSlots };

    // Helper for equip bonuses
    const getEquipStatBonus = (charObj, statKey) => {
      if (!charObj.equipment || !window.BB_DATABASE || !window.BB_DATABASE.ITEMS) return 0;
      let bonus = 0;
      const statMap = { "Str": "Strength", "Dex": "Dexterity", "Con": "Constitution", "Int": "Intelligence", "Wis": "Wisdom", "Lck": "Luck" };
      const fullStat = statMap[statKey] || statKey;
      Object.values(charObj.equipment).forEach(itemName => {
        if (!itemName || typeof itemName !== 'string') return;
        const item = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
        if (item) {
          if (item.description) {
            const match1 = item.description.match(new RegExp(`\\+([0-9]+) to ${fullStat}`, 'i'));
            if (match1) bonus += parseInt(match1[1]);
          }
          if (item.affix) {
            const match2 = item.affix.match(new RegExp(`Your ${fullStat} score increases by \\+([0-9]+)`, 'i'));
            if (match2) bonus += parseInt(match2[1]);
          }
        }
      });
      return bonus;
    };

    // Dynamic HP, MP, SP, and Encumbrance Max Calculations
    let effectiveCon = char.stats.Con + getEquipStatBonus(char, "Con");
    if (char.equipment && char.equipment.armor === "Heartcord" && effectiveCon < 18) effectiveCon = 18;
    const conMod = window.BB_STATE.getModifier(effectiveCon);
    
    let effectiveInt = char.stats.Int + getEquipStatBonus(char, "Int");
    if (char.equipment && char.equipment.head === "Starveil" && effectiveInt < 18) effectiveInt = 18;
    const intMod = window.BB_STATE.getModifier(effectiveInt);
    
    let effectiveDex = char.stats.Dex + getEquipStatBonus(char, "Dex");
    if (char.equipment && char.equipment.feet === "Dragon Riders" && effectiveDex < 18) effectiveDex = 18;
    const dexMod = window.BB_STATE.getModifier(effectiveDex);
    
    let effectiveStr = char.stats.Str + getEquipStatBonus(char, "Str");
    if (char.equipment && char.equipment.waist === "String of Ears" && effectiveStr < 18) effectiveStr = 18;
    
    char._effectiveStr = effectiveStr;
    char._effectiveCon = effectiveCon;

    char.hp.total = (effectiveCon + conMod) * 5;
    if (char.talents && char.talents.includes("Vitality")) char.hp.total += (effectiveCon + conMod);
    if (char.equipment && Object.values(char.equipment).includes("Bull's Amulet")) char.hp.total += 5;
    
    char.mp.total = effectiveInt + intMod;
    if (char.talents && char.talents.includes("Acuity")) char.mp.total += (effectiveInt + intMod);
    if (char.equipment && Object.values(char.equipment).includes("Lizard's Amulet")) char.mp.total += 5;
    
    char.sp.total = effectiveDex + dexMod;
    if (char.talents && char.talents.includes("Vigor")) char.sp.total += (effectiveDex + dexMod);
    if (char.equipment && Object.values(char.equipment).includes("Rabbit's Amulet")) char.sp.total += 5;

    char.critBonus = 0;
    if (char.equipment && Object.values(char.equipment).includes("Fox's Amulet")) char.critBonus += 1;

    let inventoryWeight = 0;
    if (Array.isArray(char.inventorySlots)) {
      char.inventorySlots.forEach(itemName => {
        if (itemName) {
          const item = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
          if (item && item.weight) {
            inventoryWeight += parseFloat(item.weight) || 0;
          }
        }
      });
    }
    char.encumbrance = inventoryWeight;
    const encumbMax = effectiveCon * 10;

    let defBreakdown = [];
    let resBreakdown = [];
    let speedBreakdown = [];

    // Calculate Defense and Resilience dynamically based on equipment
    let hasArmor = false;
    let hasShield = false;
    if (char.equipment && char.equipment.armor) {
      const armorItem = window.BB_DATABASE.ITEMS.find(i => i.name === char.equipment.armor);
      if (armorItem && armorItem.type !== "Clothing") {
        hasArmor = true;
      }
    }
    
    let baseDefStat = (char.equipment && !!char.equipment.armor) ? "Str" : null;
    let baseResStat = (char.equipment && !!char.equipment.armor) ? "Wis" : null;
    let defBonus = 0;
    let resBonus = 0;

    if (char.class === "Disciple" && !hasArmor) {
      baseDefStat = "Str";
      baseResStat = "Wis";
      defBonus += 3;
      resBonus += 3;
      defBreakdown.push(`+3 (Disciple Class)`);
      resBreakdown.push(`+3 (Disciple Class)`);
    }

    let hasUntrainedArmor = false;
    const classData = window.BB_DATABASE.CLASSES.find(c => c.name === char.class);
    let trainingStr = classData && classData.armorTraining ? classData.armorTraining[0] : "";
    if (char.talents && char.talents.includes("Aegis")) trainingStr += " Shields";
    if (char.talents && char.talents.includes("Veiled")) trainingStr += " Ethereal";
    if (char.talents && char.talents.includes("Mercurial")) trainingStr += " Light";
    if (char.talents && char.talents.includes("Bulwark")) trainingStr += " Medium";
    if (char.talents && char.talents.includes("Juggernaut")) trainingStr += " Heavy";

    if (char.equipment) {
      Object.values(char.equipment).forEach(itemName => {
        if (itemName) {
          const itemData = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
          if (itemData) {
            if (itemData.slot === "Armor" || itemData.slot === "Shield" || itemData.name.includes("Shield")) {
               let tType = itemData.type || "";
               if (!tType && itemData.name.includes("Shield")) tType = "Shield";
               if (tType) {
                 if (tType === "Clothing") {
                   // Clothing requires no armor training
                 } else if (tType.includes("Shield") && !trainingStr.includes("Shield")) {
                   hasUntrainedArmor = true;
                 } else if (!tType.includes("Shield") && !trainingStr.includes(tType)) {
                   hasUntrainedArmor = true;
                 }
               }
             }
            if (itemData.defense !== undefined) {
              const text = itemData.defense.toString().toLowerCase();
              if (text.includes("dexterity")) baseDefStat = "Dex";
              else if (text.includes("constitution")) baseDefStat = "Con";
              else if (text.includes("intelligence")) baseDefStat = "Int";
              else if (text.includes("wisdom")) baseDefStat = "Wis";
              else if (text.includes("charisma")) baseDefStat = "Cha";
              else if (text.includes("strength")) baseDefStat = "Str";
              
              const match = text.match(/([+-]?\s*\d+)/);
              if (match) {
                const b = parseInt(match[1].replace(/\s/g, ''));
                defBonus += b;
                defBreakdown.push(`${b >= 0 ? '+' : ''}${b} (${itemData.name})`);
              }
            }
            if (itemData.resilience !== undefined) {
              const text = itemData.resilience.toString().toLowerCase();
              if (text.includes("dexterity")) baseResStat = "Dex";
              else if (text.includes("constitution")) baseResStat = "Con";
              else if (text.includes("intelligence")) baseResStat = "Int";
              else if (text.includes("wisdom")) baseResStat = "Wis";
              else if (text.includes("charisma")) baseResStat = "Cha";
              else if (text.includes("strength")) baseResStat = "Str";
              
              const match = text.match(/([+-]?\s*\d+)/);
              if (match) {
                const b = parseInt(match[1].replace(/\s/g, ''));
                resBonus += b;
                resBreakdown.push(`${b >= 0 ? '+' : ''}${b} (${itemData.name})`);
              }
            }
          }
        }
      });
    }
    
    char.hasUntrainedArmor = hasUntrainedArmor;

    const finalDefStatBonus = baseDefStat ? window.BB_STATE.getModifier(char.stats[baseDefStat]) : 0;
    if (baseDefStat) defBreakdown.push(`${finalDefStatBonus >= 0 ? '+' : ''}${finalDefStatBonus} (${baseDefStat} Modifier)`);
    char.defBreakdownStr = defBreakdown.join("&#10;");

    const finalResStatBonus = baseResStat ? window.BB_STATE.getModifier(char.stats[baseResStat]) : 0;
    if (baseResStat) resBreakdown.push(`${finalResStatBonus >= 0 ? '+' : ''}${finalResStatBonus} (${baseResStat} Modifier)`);
    char.resBreakdownStr = resBreakdown.join("&#10;");

    char.defense = defBonus + finalDefStatBonus;
    char.resilience = resBonus + finalResStatBonus;

    // Calculate Movement Speed
    let baseMovement = 30; // Standard base speed
    speedBreakdown.push(`Base: 30`);
    let movementBonus = 0;

    if (char.class === "Disciple") {
      movementBonus += 15; // Transcendental feature
      speedBreakdown.push(`+15 (Disciple Class)`);
    }

    if (char.equipment && char.equipment.feet === "Boots of Swiftness") {
      movementBonus += 5;
      speedBreakdown.push(`+5 (Boots of Swiftness)`);
    }

    if (char.equipment) {
      Object.values(char.equipment).forEach(itemName => {
        if (itemName) {
          const itemData = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
          if (itemData && itemData.movementPenalty) {
             const penText = itemData.movementPenalty.toString();
             const match = penText.match(/([+-]\s*\d+)/);
             if (match) {
                const b = parseInt(match[1].replace(/\s/g, ''));
                movementBonus += b;
                speedBreakdown.push(`${b >= 0 ? '+' : ''}${b} (${itemData.name})`);
             } else {
               const parsed = parseInt(penText);
               if (!isNaN(parsed)) movementBonus += parsed;
             }
          }
        }
      });
    }
    char.movement = baseMovement + movementBonus;

    // Encumbrance Penalties
    if (char.encumbrance >= encumbMax * 2) {
      char.movement = 0; // Burdened
      speedBreakdown.push(`Burdened (0 Speed)`);
    } else if (char.encumbrance > encumbMax) {
      char.movement -= 10; // Over-encumbered
      speedBreakdown.push(`-10 (Over-encumbered)`);
    }
    
    if (char.movement < 0) char.movement = 0;

    char.speedBreakdownStr = speedBreakdown.join("&#10;");

    // Calculate Rest Dice
    const maxRestDice = char.level;
    if (!char.restDice) char.restDice = { used: 0 };
    const availableRestDice = maxRestDice - char.restDice.used;

    let restDieSize = 4;
    if (char.level >= 2) restDieSize = 6;
    if (char.level >= 4) restDieSize = 8;
    if (char.level >= 6) restDieSize = 10;
    if (char.level >= 8) restDieSize = 12;
    if (char.level >= 10) restDieSize = 20;

    // Calculate XP
    if (char.xp === undefined) char.xp = 0;
    const xpThresholds = [0, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000];
    let nextXp = char.level < 10 ? xpThresholds[char.level] : "Max";

    // Build character selector dropdown options
    let selectOptions = "";
    allChars.forEach(c => {
      selectOptions += `<option value="${c.id}" ${c.id === char.id ? "selected" : ""}>${c.name} (Lvl ${c.level} ${c.race} ${c.class})</option>`;
    });

    container.innerHTML = `
      <div class="sheet-page">
        <!-- Sheet Top Header Bar -->
        <div class="sheet-header-bar glass" style="position:relative; z-index:9999;">
          <div class="hunter-meta-left" style="display:flex; flex-direction:column; align-items:flex-start; gap:12px; position:relative; z-index:1000; flex:1;">
            <div class="char-dropdown-wrapper" style="display:flex; align-items:center; gap:8px;">
              <label for="active-char-selector" style="margin:0; font-size:0.85rem; color:#fff;">Active Profile:</label>
              <select id="active-char-selector" class="char-select-dropdown">
                ${selectOptions}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <button class="btn btn-brown btn-sm" id="long-rest-btn">Long Rest</button>
              <div style="position:relative;">
                <button class="btn btn-accent btn-sm" id="short-rest-toggle-btn" ${availableRestDice <= 0 ? "disabled" : ""}>Short Rest</button>
                <div id="short-rest-panel" style="display:none; position:absolute; top:110%; left:0; width:150px; flex-direction:column; gap:6px; padding:8px; border:1px solid var(--amber); border-radius:6px; background:var(--bg-dark); z-index:10000; box-shadow:0 4px 10px rgba(0,0,0,0.8);">
                  <span style="font-size:0.75rem; color:#fff; text-align:center;">Spend 1 Rest Die:</span>
                  <button class="btn btn-xs btn-primary short-rest-option" data-pool="hp">+ Hit Points</button>
                  <button class="btn btn-xs btn-primary short-rest-option" data-pool="mp">+ Mana Points</button>
                  <button class="btn btn-xs btn-primary short-rest-option" data-pool="sp">+ Stamina Points</button>
                </div>
              </div>
              <button class="btn btn-primary btn-sm info-tooltip-trigger" id="fortune-roll-btn" data-html="<h4>Fortune Roll</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>Roll a d100 + your Luck modifier to discover what you find!</p>">Fortune</button>
            </div>
          </div>
          
          <div class="hunter-meta-center" style="display:flex; flex-direction:column; gap:6px; align-items:center; justify-content:center; flex:1; margin: 0 10px;">
            <div class="hunter-title-row" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
              <h1 class="hunter-name" style="margin:0;">${char.name}</h1>
              <div style="display:flex; flex-direction:row; align-items:center; gap:12px;">
                <span class="hunter-tag">Level ${char.level} ${char.race} ${char.class}</span>
                <span style="font-size:0.8rem; color:#fff; display:flex; align-items:center; gap:6px;">
                  XP: 
                  <input type="number" id="char-xp-input" value="${char.xp}" style="width:70px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:2px 4px; border-radius:3px; text-align:right;"> 
                  / ${nextXp}
                </span>
              </div>
            </div>
          </div>

          <div class="hunter-meta-right" style="display:flex; flex-direction:column; align-items:flex-end; gap:6px; justify-content:center; flex:1;">
          </div>
        </div>

        <!-- Sheet Three-Column Grid -->
        <div class="sheet-grid">
          
          <!-- COLUMN 1: Vital Stats, Resources, Attributes -->
          <div class="sheet-col col-vitals">
            
            <!-- Resource Pools -->
            <div class="card resources-card glass">
              <h3 class="card-header-sm">Resource Pools</h3>
              
              <!-- HP Pool -->
              <div class="resource-row hp-pool">
                <div class="res-label">
                  <strong>Hit Points</strong>
                  <span class="temp-label">Temp HP: <input type="number" class="inline-hp-input" id="hp-temp" value="${char.hp.temp || 0}"></span>
                </div>
                <div class="res-tracker">
                  <input type="number" class="res-val-input" id="hp-current" value="${char.hp.current}">
                  <span class="divider">/</span>
                  <input type="number" class="res-val-input" id="hp-total" value="${char.hp.total}" readonly title="Maximum Hit Points are calculated automatically based on your Constitution score and talents.">
                </div>
              </div>
              
              <!-- MP Pool -->
              <div class="resource-row mp-pool">
                <div class="res-label">
                  <strong>Mana Points</strong>
                  <span class="temp-label">Temp MP: <input type="number" class="inline-hp-input" id="mp-temp" value="${char.mp?.temp || 0}"></span>
                </div>
                <div class="res-tracker">
                  <input type="number" class="res-val-input" id="mp-current" value="${char.mp.current}">
                  <span class="divider">/</span>
                  <input type="number" class="res-val-input" id="mp-total" value="${char.mp.total}" readonly title="Maximum Mana Points are calculated automatically based on your Intelligence score and talents.">
                </div>
              </div>

              <!-- SP Pool -->
              <div class="resource-row sp-pool">
                <div class="res-label">
                  <strong>Stamina Points</strong>
                  <span class="temp-label">Temp SP: <input type="number" class="inline-hp-input" id="sp-temp" value="${char.sp?.temp || 0}"></span>
                </div>
                <div class="res-tracker">
                  <input type="number" class="res-val-input" id="sp-current" value="${char.sp.current}">
                  <span class="divider">/</span>
                  <input type="number" class="res-val-input" id="sp-total" value="${char.sp.total}" readonly title="Maximum Stamina Points are calculated automatically based on your Dexterity score and talents.">
                </div>
              </div>
              <!-- Bottom Row: Rest Dice & Death Saves -->
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
                
                <!-- Death Saves -->
                <div class="death-saves-section" style="display:flex; flex-direction:column;">
                  <div class="death-saves-label">
                    <strong class="roll-death-save-btn info-tooltip-trigger" style="cursor:pointer; border-bottom:1px dashed var(--amber); transition:color 0.2s;" onmouseover="this.style.color='var(--amber)'" onmouseout="this.style.color=''" data-html="<h4>Death Saving Throw</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When a creature starts its turn at 0 hit points, it must make a death saving throw to see if it clings to life or succumbs to death. This is a private roll, visible only to the player, and it is not tied to any ability score.</p>">Death Saves</strong>
                  </div>
                  <div class="death-saves-slots" style="margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:0.85rem;">
                    <div class="save-group successes" style="display:flex; align-items:center; gap:4px;">
                      <span style="width:65px;">Successes:</span>
                      <input type="checkbox" class="death-save-cb" data-type="successes" data-index="1" ${char.deathSaves.successes >= 1 ? "checked" : ""}>
                      <input type="checkbox" class="death-save-cb" data-type="successes" data-index="2" ${char.deathSaves.successes >= 2 ? "checked" : ""}>
                      <input type="checkbox" class="death-save-cb" data-type="successes" data-index="3" ${char.deathSaves.successes >= 3 ? "checked" : ""}>
                    </div>
                    <div class="save-group failures" style="display:flex; align-items:center; gap:4px;">
                      <span style="width:65px;">Failures:</span>
                      <input type="checkbox" class="death-save-cb" data-type="failures" data-index="1" ${char.deathSaves.failures >= 1 ? "checked" : ""}>
                      <input type="checkbox" class="death-save-cb" data-type="failures" data-index="2" ${char.deathSaves.failures >= 2 ? "checked" : ""}>
                      <input type="checkbox" class="death-save-cb" data-type="failures" data-index="3" ${char.deathSaves.failures >= 3 ? "checked" : ""}>
                    </div>
                  </div>
                </div>

                <!-- Rest Dice -->
                <div class="rest-dice-stat" style="display:flex; flex-direction:column; align-items:flex-end;">
                  <div class="death-saves-label"><strong>Rest Dice</strong></div>
                  <div style="font-size:1.1rem; margin-top:8px;">
                    ${availableRestDice} / ${maxRestDice} <span style="color:var(--amber); font-size:0.9rem;">(d${restDieSize})</span>
                  </div>
                </div>

              </div>
            </div>

            <!-- Attributes & Modifiers -->
            <div class="card attributes-card glass">
              <h3 class="card-header-sm" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Core Attributes</span>
                ${Math.max(0, (char.level - 1) - (char.spentStatPoints || 0)) > 0 ? `<span style="color:var(--amber); font-size:0.8rem;">(${Math.max(0, (char.level - 1) - (char.spentStatPoints || 0))} Points)</span>` : ''}
              </h3>
              <div class="attributes-vertical-list">
                ${renderAttributeRow(char, "Str", "Strength")}
                ${renderAttributeRow(char, "Dex", "Dexterity")}
                ${renderAttributeRow(char, "Con", "Constitution")}
                ${renderAttributeRow(char, "Int", "Intelligence")}
                ${renderAttributeRow(char, "Wis", "Wisdom")}
                ${renderAttributeRow(char, "Lck", "Luck")}
              </div>
            </div>
          </div>



          <!-- COLUMN 2: Tabs (Skills, Equipment, Spells, Notes) -->
          <div class="sheet-col col-details">
            <div class="details-tab-bar glass">
              <button class="sheet-tab-btn ${activeTab === "skills" ? "active" : ""}" data-tab="skills">Skills</button>
              <button class="sheet-tab-btn ${activeTab === "equipment" ? "active" : ""}" data-tab="equipment">Equipment</button>
              <button class="sheet-tab-btn ${activeTab === "inventory" ? "active" : ""}" data-tab="inventory">Inventory</button>
              <button class="sheet-tab-btn ${activeTab === "spells" ? "active" : ""}" data-tab="spells">Spells & Abilities</button>
              <button class="sheet-tab-btn ${activeTab === "talents" ? "active" : ""}" data-tab="talents">Feats & Talents</button>
              <button class="sheet-tab-btn ${activeTab === "features" ? "active" : ""}" data-tab="features">Class Features</button>
              <button class="sheet-tab-btn ${activeTab === "background" ? "active" : ""}" data-tab="background">Background</button>
              <button class="sheet-tab-btn ${activeTab === "notes" ? "active" : ""}" data-tab="notes">Notes</button>
            </div>

            <div class="tab-content-container glass">
              ${renderTabContent(char)}
            </div>
          </div>

          <!-- COLUMN 3: Right Side (Burden & Dice Log) -->
          <div class="sheet-col col-right" style="display:flex; flex-direction:column; gap:20px; padding:0; background:transparent; border:none; box-shadow:none;">
            <!-- Combat Stats Box -->
            <div class="card combat-stats-card glass" style="padding:15px; margin:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:8px;">
                <h3 class="card-header-sm" style="margin:0; border:none; padding:0;">Combat Stats</h3>
                <button class="btn btn-sm info-tooltip-trigger" id="btn-roll-initiative" data-type="ability" data-name="Initiative" data-html="<h4>Initiative</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When combat begins, each participant determines when they act by rolling Initiative. To do so, roll a d20 and add your Luck modifier to the result. The final number determines the order in which you take your turns during the clash.</p>" style="background:var(--mana-blue); color:white; border:none; font-weight:bold; padding:4px 12px; font-size:0.8rem; cursor:pointer;">Roll Initiative</button>
              </div>
              <div class="defenses-flex-row" style="margin-bottom:15px; justify-content:space-between; gap:10px; display:flex;">
                <div class="def-box info-tooltip-trigger" data-type="attribute" data-name="Defense" data-html="<h4>Defense</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>Defense reduces the amount of bludgeoning, piercing, and slashing damage that reaches your Hit Points, acting as the first barrier between you and harm. The stronger your physique and the sturdier your armor, the more punishment you can deflect before it wounds you.</p><div style='margin-top:10px; border-top:1px solid #444; padding-top:10px; font-size:0.85rem; color:var(--amber);'><strong>Calculation Breakdown:</strong><br>${(char.defBreakdownStr || 'Base').replace(/&#10;/g, '<br>')}</div>" style="flex:1;">
                  <span class="lbl">DEFENSE</span>
                  <input type="number" class="def-input" id="def-val" value="${char.defense}" readonly>
                </div>
                <div class="def-box info-tooltip-trigger" data-type="attribute" data-name="Resilience" data-html="<h4>Resilience</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>Resilience diminishes the amount of Elemental damage (Air, Earth, Fire, Ice, Lightning, Thunder, and Water) as well as Divine damage, such as (Dark, Holy, Magic, and Nature) that reaches your Hit Points, serving as your first line of protection against mystical harm. The sharper your focus and the more grounded your spirit, the more of this supernatural force you can endure before it pierces your armor.</p><div style='margin-top:10px; border-top:1px solid #444; padding-top:10px; font-size:0.85rem; color:var(--amber);'><strong>Calculation Breakdown:</strong><br>${(char.resBreakdownStr || 'Base').replace(/&#10;/g, '<br>')}</div>" style="flex:1;">
                  <span class="lbl">RESILIENCE</span>
                  <input type="number" class="def-input" id="res-val" value="${char.resilience}" readonly>
                </div>
                <div class="def-box info-tooltip-trigger" data-type="attribute" data-name="Speed" data-html="<h4>Speed</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>Every creature in the game, whether a player character or a monster, has a Speed value. This value represents the number of feet the creature can move during a single round of action. Speed reflects rapid, focused movement under pressure, such as sprinting, repositioning, or advancing during dangerous and demanding situations.</p><div style='margin-top:10px; border-top:1px solid #444; padding-top:10px; font-size:0.85rem; color:var(--amber);'><strong>Calculation Breakdown:</strong><br>${(char.speedBreakdownStr || 'Base').replace(/&#10;/g, '<br>')}</div>" style="flex:1;">
                  <span class="lbl">SPEED</span>
                  <input type="number" class="def-input" id="move-val" value="${char.movement}" readonly>
                </div>
              </div>
              <h4 style="margin:15px 0 10px 0; color:var(--amber); font-size:0.9rem; border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:4px;">Weapon Attacks</h4>
              <div class="attacks-list" style="display:flex; flex-direction:column; gap:8px;">
                ${(function() {
                  if (!char.equipment) return `<div style="font-size:0.85rem; color:#fff; text-align:center;">No weapons equipped.</div>`;
                  let attacksHtml = "";
                  for (const [slot, itemName] of Object.entries(char.equipment)) {
                    if (!itemName) continue;

                    if (slot === 'offHand' && char.equipment.mainHand) {
                        const mainHandItem = window.BB_DATABASE.ITEMS.find(i => i.name === char.equipment.mainHand);
                        if (mainHandItem && ["Double", "Colossal"].includes(mainHandItem.grip)) {
                            continue;
                        }
                    }

                    const item = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
                    if (item && item.damageDie) {
                      let modVal = 0;
                      let modStat = "";
                      let isImprovised = false;
                      
                      let charClass = window.BB_DATABASE.CLASSES.find(c => c.name === char.class);
                      const w = charClass ? (charClass.weaponTraining || []) : [];
                      if (char.talents && char.talents.includes("Martialist")) w.push("Martial");
                      if (char.talents && char.talents.includes("Colossus")) w.push("Great");
                      if (char.talents && char.talents.includes("Thaumic")) w.push("Focus");
                      
                      const hasTraining = item.type ? w.some(tw => tw.includes(item.type)) : true;

                      let useDamageBonus = item.damageBonus;
                      let count = 1; 
                      let type = 4;

                      if (!hasTraining) {
                        isImprovised = true;
                        count = 1;
                        type = 4;
                        useDamageBonus = "Strength";
                      } else {
                        const match = item.damageDie.match(/(\d+)d(\d+)/i);
                        if (match) { count = parseInt(match[1]); type = parseInt(match[2]); }
                      }

                      if (isImprovised && char.talents && char.talents.includes("Makeshift")) {
                        useDamageBonus = "Finesse";
                      }

                      if (useDamageBonus === "Strength") { modVal = window.BB_STATE.getModifier(char.stats.Str); modStat = "STR"; }
                      else if (useDamageBonus === "Dexterity") { modVal = window.BB_STATE.getModifier(char.stats.Dex); modStat = "DEX"; }
                      
                      let finesseSelect = "";
                      if (useDamageBonus === "Finesse") { 
                        if (!char.finesseOverrides) char.finesseOverrides = {};
                        let currentOverride = char.finesseOverrides[slot] || "Auto";
                        finesseSelect = `
                          <select class="finesse-override-select" data-slot="${slot}" style="background:var(--bg-dark); color:var(--text-light); border:1px solid rgba(255,255,255,0.2); border-radius:4px; font-size:0.65rem; padding:1px 2px; margin-left:4px; cursor:pointer;" title="Finesse Override">
                            <option value="Auto" ${currentOverride === "Auto" ? "selected" : ""}>Auto</option>
                            <option value="STR" ${currentOverride === "STR" ? "selected" : ""}>STR</option>
                            <option value="DEX" ${currentOverride === "DEX" ? "selected" : ""}>DEX</option>
                          </select>
                        `;
                        if (currentOverride === "STR") { modVal = window.BB_STATE.getModifier(char.stats.Str); modStat = "STR"; }
                        else if (currentOverride === "DEX") { modVal = window.BB_STATE.getModifier(char.stats.Dex); modStat = "DEX"; }
                        else {
                          const strMod = window.BB_STATE.getModifier(char.stats.Str);
                          const dexMod = window.BB_STATE.getModifier(char.stats.Dex);
                          if (strMod >= dexMod) { modVal = strMod; modStat = "STR"; }
                          else { modVal = dexMod; modStat = "DEX"; }
                        }
                      }
                      
                      if (item.grip === "Dual" && slot === "offHand") {
                        modVal = 0;
                        modStat = "None";
                      }
                      
                      if (item.grip === "Single") {
                        let hasOtherWeapon = false;
                        ['mainHand', 'offHand', 'sling'].forEach(s => {
                          if (s !== slot && char.equipment && char.equipment[s]) {
                            const otherItem = window.BB_DATABASE.ITEMS.find(i => i.name === char.equipment[s]);
                            if (otherItem && otherItem.slot === "Weapon" && !otherItem.type.includes("Shield") && !otherItem.type.includes("Implement") && !otherItem.type.includes("Focus")) {
                              hasOtherWeapon = true;
                            }
                          }
                        });
                        if (!hasOtherWeapon) {
                          modVal += 2;
                          modStat += " + Single Grip";
                        }
                      }
                      
                      let bowmensBonus = 0;
                      if (item.properties && item.properties.includes("Ranged") && char.equipment && char.equipment.hands === "Bowmen’s Bracers") {
                        bowmensBonus = 1;
                      }
                      
                      let maxCritCap = 0;
                      if (!isImprovised) {
                        if (item.grip === "Dual") maxCritCap = 1;
                        else if (item.grip === "Single") maxCritCap = 2;
                        else if (item.grip === "Double") maxCritCap = 3;
                        else if (item.grip === "Colossal") maxCritCap = 4;
                      }

                      let baseCritRange = 0;
                      let critBonus = char.critBonus || 0;
                      let totalCritRange = baseCritRange + critBonus;
                      
                      if (!isImprovised && item.grip === "Single" && char.talents && char.talents.includes("Unfettered")) {
                        if (!char.equipment.offHand) {
                          maxCritCap += 1;
                        }
                      }
                      
                      let finalCritRange = Math.min(totalCritRange, maxCritCap);
                      
                      let labelPrefix = isImprovised ? "Improvised " : "";
                      let titleStr = `Roll ${count}d${type} ${modVal >= 0 ? '+'+modVal : modVal} (Crit Range: ${finalCritRange})`;
                      
                      attacksHtml += `<button class="btn btn-secondary attack-roll-btn" data-slot="${slot}" data-grip="${isImprovised ? '' : (item.grip || '')}" data-label="Damage: ${labelPrefix}${item.name}" data-count="${count}" data-type="${type}" data-mod="${modVal}" data-crit="${finalCritRange}" data-bowmens="${bowmensBonus}" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer;" title="${titleStr}"><span>${labelPrefix}${item.name} <span style="color:#fff; font-size:0.75rem;">(${slot})</span></span><span style="color:var(--amber); display:flex; align-items:center;">${count}d${type} ${modVal >= 0 ? '+'+modVal : modVal} ${item.damageType || ""} <span style="font-size:0.7rem; color:#fff; margin-left:4px;">(${modStat})</span>${finesseSelect}</span></button>`;
                    }
                  }
                  return attacksHtml || `<div style="font-size:0.85rem; color:#fff; text-align:center;">No weapons equipped.</div>`;
                })()}
              </div>
            </div>

            <!-- Action Economy Tracker Card -->
            <div class="card action-economy-card glass" style="padding:15px; margin:0;">
              <h4 style="margin:0 0 10px 0; color:var(--amber); font-size:0.9rem; border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:4px; display:flex; justify-content:space-between; align-items:center;">
                Action Economy
                <div style="display:flex; align-items:center; gap:10px;">
                  <label style="font-size:0.75rem; color:var(--text-light); display:flex; align-items:center; gap:4px;" title="Current Critical Range Bonus (from talents, spells, or conditions)">Crit Bonus: <input type="number" id="char-crit-bonus-input" value="${char.critBonus || 0}" min="0" max="10" style="width:35px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:2px 4px; border-radius:3px; text-align:center; font-family:var(--font-mono); font-size:0.75rem;"></label>
                  <button class="btn btn-xs btn-secondary" id="reset-actions-btn" style="font-size:0.7rem; padding:2px 6px;">Reset Turn</button>
                </div>
              </h4>
              <div class="action-economy-row" style="display:flex; justify-content:space-between; gap:5px; font-size:0.8rem; color:var(--text-light); margin-bottom:12px;">
                <label class="action-cb-wrapper" style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="action-cb" data-action="action" ${char.combatState?.action ? "checked" : ""}><span class="action-cb-indicator"></span> Action</label>
                <label class="action-cb-wrapper" style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="action-cb" data-action="bonusAction" ${char.combatState?.bonusAction ? "checked" : ""}><span class="action-cb-indicator"></span> Bonus</label>
                <label class="action-cb-wrapper" style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="action-cb" data-action="reaction" ${char.combatState?.reaction ? "checked" : ""}><span class="action-cb-indicator"></span> Reaction</label>
                <label class="action-cb-wrapper" style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="action-cb" data-action="movement" ${char.combatState?.movement ? "checked" : ""}><span class="action-cb-indicator"></span> Move</label>
              </div>
              <div style="font-size:0.75rem; color:#fff; text-align:center; line-height:1.6;">
                ${(function() {
                  const getStyle = (actionName) => {
                    let consumesBonus = actionName === "Help" && char.talents && char.talents.includes("Accomplice");
                    let isConsumed = consumesBonus ? char.combatState?.bonusAction : char.combatState?.action;
                    return `cursor:${isConsumed ? 'not-allowed' : 'pointer'}; opacity:${isConsumed ? '0.4' : '1'}; border-bottom:1px dashed var(--text-muted); transition:all 0.2s;`;
                  };
                  return `
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Attack')}" data-action-name="Attack" data-type="ability" data-html="<h4>Attack</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>The most direct way to harm an opponent is to take the Attack action. Whether you are striking with a blade, loosing an arrow, hurling a weapon, or fighting with your bare hands, this action represents a deliberate attempt to injure or overpower a foe.</p>">Attack</span> &bull; 
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Dash')}" data-action-name="Dash" data-type="ability" data-html="<h4>Dash</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Dash action, you push yourself to move farther than usual during your turn. Until the end of your turn, you gain additional movement equal to your current Speed, after applying any bonuses or penalties.</p>">Dash</span> &bull; 
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Disengage')}" data-action-name="Disengage" data-type="ability" data-html="<h4>Disengage</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Disengage action, you move with deliberate caution, avoiding openings that enemies could exploit. For the rest of your turn, your movement does not provoke opportunity attacks.</p>">Disengage</span> &bull; 
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Dodge')}" data-action-name="Dodge" data-type="ability" data-html="<h4>Dodge</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Dodge action, you devote your full attention to defense, anticipating danger and shifting to avoid incoming harm. Until the start of your next turn, all attack rolls made against you are made with disadvantage dice, provided you can see the attacker. In addition, you make Dexterity saving throws with an advantage die during this time.</p>">Dodge</span> &bull; 
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Help')}" data-action-name="Help" data-type="ability" data-html="<h4>Help</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>You can use your action to assist another creature in completing a task. The creature gains an advantage die on rolls to accomplish that task, provided it makes the check before the start of your next turn. Alternatively, you can use Help to support an ally in combat to give them advantage dice on their next attack roll against a hostile creature within 5 feet of you.</p>">Help</span> &bull; 
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Hide')}" data-action-name="Hide" data-type="ability" data-html="<h4>Hide</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Hide action, you attempt to slip from sight or otherwise conceal your presence. Make a Dexterity (Sneak) check. If you succeed, you become hidden from creatures that failed to notice you. Creatures that cannot see you have a disadvantage die on attack rolls against you, and your attack rolls against them are made with an advantage die.</p>">Hide</span> &bull; 
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Ready')}" data-action-name="Ready" data-type="ability" data-html="<h4>Ready</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>The Ready action lets you prepare an action or movement that you can use later in the round, using your reaction. First decide the trigger, then choose the action you will take when that trigger occurs, or decide to move up to your Speed. When the trigger occurs, you may use your reaction to carry out your prepared action, or ignore the trigger entirely.</p>">Ready</span> &bull; 
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Search')}" data-action-name="Search" data-type="ability" data-html="<h4>Search</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Search action, you carefully examine your surroundings or inspect a specific object to uncover hidden details.</p>">Search</span> &bull; 
                <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Use an Object')}" data-action-name="Use an Object" data-type="ability" data-html="<h4>Use an Object</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When an object requires your full attention to operate, or if you want to interact with multiple objects on your turn, you take the Use an Object action.</p>">Use an Object</span>
                  `;
                })()}
              </div>
            </div>

            <!-- Dice Roller History -->
            <div class="card col-log glass" style="flex:1; display:flex; flex-direction:row; padding:0; overflow:hidden; margin:0;">
              <!-- Quick Dice Sidebar -->
              <div class="quick-dice-sidebar" style="display:flex; flex-direction:column; background:rgba(0,0,0,0.4); padding:15px 10px; gap:10px; border-right:1px solid rgba(255,255,255,0.1); align-items:center;">
                <input type="number" id="quick-dice-count" value="1" min="1" max="99" title="Number of dice to roll" style="width:100%; background:rgba(0,0,0,0.8); border:1px solid rgba(255,193,7,0.5); color:var(--amber); text-align:center; padding:4px 0; border-radius:4px; font-weight:bold; margin-bottom:5px;">
                <button class="btn btn-primary btn-xs quick-dice-btn" data-die="4" style="width:100%; font-weight:bold; padding:6px 0;">d4</button>
                <button class="btn btn-primary btn-xs quick-dice-btn" data-die="6" style="width:100%; font-weight:bold; padding:6px 0;">d6</button>
                <button class="btn btn-primary btn-xs quick-dice-btn" data-die="8" style="width:100%; font-weight:bold; padding:6px 0;">d8</button>
                <button class="btn btn-primary btn-xs quick-dice-btn" data-die="10" style="width:100%; font-weight:bold; padding:6px 0;">d10</button>
                <button class="btn btn-primary btn-xs quick-dice-btn" data-die="12" style="width:100%; font-weight:bold; padding:6px 0;">d12</button>
                <button class="btn btn-primary btn-xs quick-dice-btn" data-die="20" style="width:100%; font-weight:bold; padding:6px 0;">d20</button>
                <button class="btn btn-primary btn-xs quick-dice-btn" data-die="100" style="width:100%; font-weight:bold; padding:6px 0; font-size:0.75rem;">d100</button>
              </div>
              
              <div style="flex:1; display:flex; flex-direction:column; padding:15px; overflow:hidden;">
                <div class="log-header" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                  <h3 style="margin:0;">Roll History</h3>
                  <div style="display:flex; gap:10px;">
                    <select id="advantage-toggle" class="form-control inline-select" style="font-size:0.75rem; padding:2px 4px; height:auto; margin:0; background:rgba(0,0,0,0.8); color:var(--amber); border:1px solid rgba(255,193,7,0.5);">
                      <option value="normal">Normal Roll</option>
                      <option value="adv_dice">Advantage Dice</option>
                      <option value="dis_dice">Disadvantage Dice</option>
                      <option value="adv_die">Advantage Die</option>
                      <option value="dis_die">Disadvantage Die</option>
                    </select>
                    <button class="btn btn-secondary btn-xs" id="clear-dice-log-btn">Clear</button>
                  </div>
                </div>
                <div class="roll-log-list" id="sheet-roll-log" style="flex:1; overflow-y:auto; padding-right:5px;">
                  <!-- Rendered Dynamically -->
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    setupEventListeners(char);
    renderRollLog();
  }

  function renderAttributeRow(char, statKey, statName) {
    let innateVal = char.stats[statKey];
    
    // Check Ancestry
    const raceData = window.BB_DATABASE.SPECIES.find(s => s.name.toLowerCase() === (char.race || "").toLowerCase()) || {};
    let ancestryBonus = raceData.bonuses && raceData.bonuses[statKey] ? raceData.bonuses[statKey] : 0;
    
    let baseVal = innateVal - ancestryBonus;
    
    // Check Equipment
    let equipBonus = 0;
    let equipDetails = [];
    if (char.equipment && window.BB_DATABASE && window.BB_DATABASE.ITEMS) {
      Object.values(char.equipment).forEach(itemName => {
        if (!itemName || typeof itemName !== 'string') return;
        const item = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
        if (item) {
          let bonus = 0;
          if (item.description) {
            const regexDesc = new RegExp(`\\+([0-9]+) to ${statName}`, 'i');
            const matchDesc = item.description.match(regexDesc);
            if (matchDesc) bonus += parseInt(matchDesc[1]);
          }
          if (item.affix) {
            const regexAffix = new RegExp(`Your ${statName} score increases by \\+([0-9]+)`, 'i');
            const matchAffix = item.affix.match(regexAffix);
            if (matchAffix) bonus += parseInt(matchAffix[1]);
          }
          if (bonus > 0) {
            equipDetails.push(`Equipment (${item.name}): <span style='float:right; color:var(--amber); font-weight:bold;'>+${bonus}</span>`);
            equipBonus += bonus;
          }
        }
      });
    }

    let totalVal = innateVal + equipBonus;
    
    if (statKey === "Int" && char.equipment && char.equipment.head === "Starveil") {
      if (totalVal < 18) {
        equipDetails.push(`Equipment (Starveil): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
        equipBonus += (18 - totalVal);
        totalVal = 18;
      }
    }
    
    if (statKey === "Wis" && char.equipment && char.equipment.head === "Evergreen") {
      if (totalVal < 18) {
        equipDetails.push(`Equipment (Evergreen): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
        equipBonus += (18 - totalVal);
        totalVal = 18;
      }
    }

    if (statKey === "Con" && char.equipment && char.equipment.armor === "Heartcord") {
      if (totalVal < 18) {
        equipDetails.push(`Equipment (Heartcord): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
        equipBonus += (18 - totalVal);
        totalVal = 18;
      }
    }

    if (statKey === "Lck" && char.equipment && char.equipment.hands === "Caspian Clutches") {
      if (totalVal < 18) {
        equipDetails.push(`Equipment (Caspian Clutches): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
        equipBonus += (18 - totalVal);
        totalVal = 18;
      }
    }
    
    if (statKey === "Dex" && char.equipment && char.equipment.feet === "Dragon Riders") {
      if (totalVal < 18) {
        equipDetails.push(`Equipment (Dragon Riders): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
        equipBonus += (18 - totalVal);
        totalVal = 18;
      }
    }
    
    if (statKey === "Str" && char.equipment && char.equipment.waist === "String of Ears") {
      if (totalVal < 18) {
        equipDetails.push(`Equipment (String of Ears): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
        equipBonus += (18 - totalVal);
        totalVal = 18;
      }
    }
    
    let breakdown = [];
    breakdown.push(`Base & Points: <span style='float:right; color:var(--amber); font-weight:bold;'>${baseVal}</span>`);
    if (ancestryBonus > 0) {
      breakdown.push(`Ancestry Bonus: <span style='float:right; color:var(--amber); font-weight:bold;'>+${ancestryBonus}</span>`);
    }
    if (equipBonus > 0) {
      breakdown = breakdown.concat(equipDetails);
    }
    breakdown.push(`<hr style='border-color: rgba(255,255,255,0.1); margin: 8px 0;'><strong>Total Score: <span style='float:right; color:var(--amber); font-weight:bold;'>${totalVal}</span></strong>`);

    const breakdownHtml = breakdown.join("<br>");

    const mod = window.BB_STATE.getModifier(totalVal);
    const modStr = window.BB_STATE.getModifierString(totalVal);
    const unspentPoints = Math.max(0, (char.level - 1) - (char.spentStatPoints || 0));

    return `
      <div class="attribute-row glass info-tooltip-trigger" data-type="attribute" data-name="${statName}" data-html="<h4>${statName} Breakdown</h4><p style='margin:0'>${breakdownHtml.replace(/"/g, '&quot;')}</p><hr style='border-color: rgba(255,255,255,0.1); margin: 8px 0;'><p style='font-size:0.85rem; color:#fff; margin:0;'>${(window.BB_DATABASE.STAT_DESCRIPTIONS[statKey] || '').replace(/"/g, '&quot;')}</p>">
        <div class="stat-roll-hook" data-label="${statName}" data-mod="${mod}">
          <span class="attr-name">${statName.toUpperCase()}</span>
          <span class="attr-mod-pill">${modStr}</span>
        </div>
        <div class="attr-val-box" style="display:flex; align-items:center; gap:6px;">
          ${unspentPoints > 0 ? `<button class="btn btn-xs btn-primary btn-add-stat" data-stat="${statKey}" title="Increase ${statName} (+1)" style="padding:2px 6px; font-weight:bold; font-size:0.9rem;">+</button>` : ''}
          <input type="number" class="attr-val-input" data-stat="${statKey}" value="${totalVal}" style="width:50px;" readonly title="Base: ${innateVal}">
        </div>
      </div>
    `;
  }

  function renderTabContent(char) {
    const checkRequirement = (reqStr, char) => {
      if (!reqStr || reqStr === "None") return true;
      const match = reqStr.match(/([a-zA-Z]+)\s+(\d+)/);
      if (match) {
        const type = match[1].toLowerCase();
        const val = parseInt(match[2]);
        if (type === "level") return char.level >= val;
        const statMap = { strength: "Str", dexterity: "Dex", constitution: "Con", intelligence: "Int", wisdom: "Wis", luck: "Lck" };
        const statKey = statMap[type];
        if (statKey && char.stats && char.stats[statKey] >= val) return true;
        return false;
      }
      return true;
    };

    if (activeTab === "skills") {
      const skillsList = [
        { name: "Acrobatics", attr: "Dex" }, { name: "Athletics", attr: "Str" }, { name: "Awareness", attr: "Wis" },
        { name: "Brawn", attr: "Str" }, { name: "Browbeat", attr: "Str" }, { name: "Bushcraft", attr: "Wis" },
        { name: "Commerce", attr: "Lck" }, { name: "Concentration", attr: "Con" }, { name: "Diplomacy", attr: "Lck" },
        { name: "Endurance", attr: "Con" }, { name: "Investigation", attr: "Int" }, { name: "Knowledge", attr: "Int" },
        { name: "Linguistics", attr: "Int" }, { name: "Medicine", attr: "Wis" }, { name: "Performance", attr: "Lck" },
        { name: "Sleight of Hand", attr: "Dex" }, { name: "Sneak", attr: "Dex" }, { name: "Tolerance", attr: "Con" }
      ];

      let skillsHTML = "";
      skillsList.forEach(sk => {
        const classData = window.BB_DATABASE.CLASSES.find(c => c.name === char.class) || {};
        const isClassSkill = classData.skills && classData.skills.includes(sk.name);
        
        let attrVal = char.stats[sk.attr];
        
        // Calculate true attribute value for skills (including equipment)
        if (char.equipment && window.BB_DATABASE && window.BB_DATABASE.ITEMS) {
          let equipBonus = 0;
          Object.values(char.equipment).forEach(itemName => {
            if (!itemName) return;
            const item = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
            if (item) {
              const statNameMap = { "Str": "Strength", "Dex": "Dexterity", "Con": "Constitution", "Int": "Intelligence", "Wis": "Wisdom", "Lck": "Luck" };
              const fullStat = statNameMap[sk.attr];
              if (item.description) {
                const match1 = item.description.match(new RegExp(`\\+([0-9]+) to ${fullStat}`, 'i'));
                if (match1) equipBonus += parseInt(match1[1]);
              }
              if (item.affix) {
                const match2 = item.affix.match(new RegExp(`Your ${fullStat} score increases by \\+([0-9]+)`, 'i'));
                if (match2) equipBonus += parseInt(match2[1]);
              }
            }
          });
          attrVal += equipBonus;
          
          if (sk.attr === "Int" && char.equipment.head === "Starveil" && attrVal < 18) attrVal = 18;
          if (sk.attr === "Wis" && char.equipment.head === "Evergreen" && attrVal < 18) attrVal = 18;
          if (sk.attr === "Con" && char.equipment.armor === "Heartcord" && attrVal < 18) attrVal = 18;
          if (sk.attr === "Lck" && char.equipment.hands === "Caspian Clutches" && attrVal < 18) attrVal = 18;
          if (sk.attr === "Dex" && char.equipment.feet === "Dragon Riders" && attrVal < 18) attrVal = 18;
          if (sk.attr === "Str" && char.equipment.waist === "String of Ears" && attrVal < 18) attrVal = 18;
        }
        const attrMod = window.BB_STATE.getModifier(attrVal);
        
        let breakdown = [];
        breakdown.push(`Modifier (${sk.attr}): <span style='float:right; color:var(--amber); font-weight:bold;'>${attrMod >= 0 ? '+' : ''}${attrMod}</span>`);
        let totalMod = attrMod;

        if (isClassSkill) {
          breakdown.push(`Class: <span style='float:right; color:var(--amber); font-weight:bold;'>+2</span>`);
          totalMod += 2;
        }

        // Check Feats
        if (char.feats) {
          char.feats.forEach(featName => {
            if (!featName) return;
            
            if (featName.startsWith("Expert (")) {
              const expertMatch = featName.match(/Expert \((.*?)\)/i);
              if (expertMatch && expertMatch[1].toLowerCase() === sk.name.toLowerCase()) {
                let bonus = Math.floor(char.level / 2);
                breakdown.push(`Feat (Expert): <span style='float:right; color:var(--amber); font-weight:bold;'>+${bonus}</span>`);
                totalMod += bonus;
              }
            }

            if (window.BB_DATABASE && window.BB_DATABASE.FEATS) {
              const feat = window.BB_DATABASE.FEATS.find(f => f.name === featName);
              if (feat && feat.description) {
                const regex = new RegExp(`\\+([0-9]+) to ${sk.name}`, 'i');
                const match = feat.description.match(regex);
                if (match) {
                  let bonus = parseInt(match[1]);
                  breakdown.push(`Feat (${feat.name}): <span style='float:right; color:var(--amber); font-weight:bold;'>+${bonus}</span>`);
                  totalMod += bonus;
                }
              }
            }
          });
        }

        // Check Ancestry skill bonuses
        const raceData = window.BB_DATABASE.SPECIES.find(s => s.name === char.race) || {};
        if (raceData.skillBonuses && raceData.skillBonuses[sk.name]) {
          let bonus = raceData.skillBonuses[sk.name];
          breakdown.push(`Ancestry: <span style='float:right; color:var(--amber); font-weight:bold;'>+${bonus}</span>`);
          totalMod += bonus;
        }
        
        if (char.humanSkillBonuses && char.humanSkillBonuses.includes(sk.name)) {
          breakdown.push(`Ancestry: <span style='float:right; color:var(--amber); font-weight:bold;'>+2</span>`);
          totalMod += 2;
        }

        // Check Talents
        if (char.talents && window.BB_DATABASE && window.BB_DATABASE.TALENTS) {
          char.talents.forEach(talentName => {
            if (!talentName) return;
            const talent = window.BB_DATABASE.TALENTS.find(t => t.name === talentName);
            if (talent && talent.description) {
              const regex = new RegExp(`\\+([0-9]+) to ${sk.name}`, 'i');
              const match = talent.description.match(regex);
              if (match) {
                let bonus = parseInt(match[1]);
                breakdown.push(`Talent (${talent.name}): <span style='float:right; color:var(--amber); font-weight:bold;'>+${bonus}</span>`);
                totalMod += bonus;
              }
            }
          });
        }

        // Check Equipment
        if (char.equipment && window.BB_DATABASE && window.BB_DATABASE.ITEMS) {
          Object.values(char.equipment).forEach(itemName => {
            if (!itemName || typeof itemName !== 'string') return;
            const item = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
            if (item && item.description) {
              const regex = new RegExp(`\\+([0-9]+) to ${sk.name}`, 'i');
              const match = item.description.match(regex);
              if (match) {
                let bonus = parseInt(match[1]);
                breakdown.push(`Equipment (${item.name}): <span style='float:right; color:var(--amber); font-weight:bold;'>+${bonus}</span>`);
                totalMod += bonus;
              }
            }
          });
        }
        
        breakdown.push(`<hr style='border-color: rgba(255,255,255,0.1); margin: 8px 0;'><strong>Total Modifier: <span style='float:right; color:var(--amber); font-weight:bold;'>${totalMod >= 0 ? '+' : ''}${totalMod}</span></strong>`);

        const skillModStr = totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
        const breakdownHtml = breakdown.join("<br>");

        skillsHTML += `
          <div class="skill-item glass hover-lift info-tooltip-trigger" data-type="skill" data-name="${sk.name}" data-mod="${totalMod}" data-html="<h4>${sk.name} Breakdown</h4><p style='margin:0'>${breakdownHtml.replace(/"/g, '&quot;')}</p><hr style='border-color: rgba(255,255,255,0.1); margin: 8px 0;'><p style='font-size:0.85rem; color:#fff; margin:0;'>${(window.BB_DATABASE.SKILL_DESCRIPTIONS[sk.name] || '').replace(/"/g, '&quot;')}</p>">
            <div class="skill-label" style="padding-left: 10px;">
              <span class="skill-name">${sk.name}</span>
              <span class="skill-attr">(${sk.attr})</span>
            </div>
            <span class="skill-mod-display">${skillModStr}</span>
          </div>
        `;
      });

      return `
        <div class="tab-skills-grid">
          ${skillsHTML}
        </div>
      `;
    } 
    
    else if (activeTab === "equipment") {
      const eq = char.equipment;
      let charClass = window.BB_DATABASE.CLASSES.find(c => c.name === char.class) || {};
      let armorTrainingSet = new Set(charClass.armorTraining || []);
      let weaponTrainingSet = new Set(charClass.weaponTraining || []);

      if (char.talents.includes("Veiled")) armorTrainingSet.add("Ethereal Armor");
      if (char.talents.includes("Mercurial")) armorTrainingSet.add("Light Armor");
      if (char.talents.includes("Bulwark")) armorTrainingSet.add("Medium Armor");
      if (char.talents.includes("Juggernaut")) armorTrainingSet.add("Heavy Armor");
      if (char.talents.includes("Aegis")) armorTrainingSet.add("Shields");

      if (char.talents.includes("Martialist")) weaponTrainingSet.add("Martial Weapons");
      if (char.talents.includes("Colossus")) weaponTrainingSet.add("Great Weapons");
      if (char.talents.includes("Thaumic")) weaponTrainingSet.add("Focus Weapons");

      let armorTrainingList = Array.from(armorTrainingSet).join(", ") || "None";
      let weaponTrainingList = Array.from(weaponTrainingSet).join(", ") || "None";
      return `
        <div class="equipment-tab-view">
          <div class="equipment-grid">
            
            <!-- Left Grid: Equipment Slots -->
            <div class="slots-column">
              ${renderEquipSlot("Head", eq.head, "head", char)}
              ${renderEquipSlot("Armor", eq.armor, "armor", char)}
              ${renderEquipSlot("Hands", eq.hands, "hands", char)}
              ${renderEquipSlot("Feet", eq.feet, "feet", char)}
              ${renderEquipSlot("Main Hand", eq.mainHand, "mainHand", char)}
              ${renderEquipSlot("Off Hand", eq.offHand, "offHand", char)}
              ${renderEquipSlot("Waist", eq.waist, "waist", char)}
              ${renderEquipSlot("Neck", eq.neck, "neck", char)}
              ${renderEquipSlot("Finger", eq.finger1, "finger1", char)}
              ${renderEquipSlot("Finger", eq.finger2, "finger2", char)}
            </div>

            <!-- Right Grid: Training & Wealth -->
            <div class="wealth-column" style="display:flex; flex-direction:column; gap:15px; background:transparent; border:none; box-shadow:none;">
              


              <!-- Training Section -->
              <div class="training-card glass" style="padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; margin-bottom:10px; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Training</h4>
                <div style="margin-bottom:8px;">
                  <strong style="color:var(--text-light); font-size:0.85rem;">Armor:</strong>
                  <div style="font-size:0.85rem; color:#fff; margin-top:2px;">${armorTrainingList}</div>
                </div>
                <div>
                  <strong style="color:var(--text-light); font-size:0.85rem;">Weapons:</strong>
                  <div style="font-size:0.85rem; color:#fff; margin-top:2px;">${weaponTrainingList}</div>
                </div>
              </div>

              <!-- Wallet -->
              <div class="wallet-card glass" style="padding:15px; border-radius:8px;">
                <h4 style="margin-top:0; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">Wallet</h4>
              <div class="coin-row bronze">
                <span class="coin-icon">⚫</span>
                <span class="coin-name">Bronze:</span>
                <input type="number" class="coin-val-input" data-coin="bronze" value="${eq.coins.bronze}">
              </div>
              <div class="coin-row silver">
                <span class="coin-icon">⚪</span>
                <span class="coin-name">Silver:</span>
                <input type="number" class="coin-val-input" data-coin="silver" value="${eq.coins.silver}">
              </div>
              <div class="coin-row gold">
                <span class="coin-icon">🟡</span>
                <span class="coin-name">Gold:</span>
                <input type="number" class="coin-val-input" data-coin="gold" value="${eq.coins.gold}">
              </div>
              <div class="coin-row platinum">
                <span class="coin-icon">🪙</span>
                <span class="coin-name">Platinum:</span>
                <input type="number" class="coin-val-input" data-coin="platinum" value="${eq.coins.platinum}">
              </div>
              <div class="coin-row crystal">
                <span class="coin-icon">💎</span>
                <span class="coin-name">Crystal:</span>
                <input type="number" class="coin-val-input" data-coin="crystal" value="${eq.coins.crystal}">
              </div>
              </div>
            </div>

          </div>
        </div>
      `;
    } 
    
    else if (activeTab === "spells") {
      let spellsListHTML = "";
      
      if (char.spells.length === 0) {
        spellsListHTML = `<p class="no-spells-text">No attuned spells or abilities. Open the Compendium to read spell descriptions!</p>`;
      } else {
        char.spells.forEach(spellId => {
          const spell = window.BB_DATABASE.SPELLS.find(s => s.id === spellId);
          if (spell) {
          let badgeColor = 'var(--mana-blue)';
          const cls = spell.class ? spell.class.toLowerCase() : '';
          const classColors = {
            'archon': '#8B5CF6',
            'berserker': '#C0392B',
            'disciple': '#D4A017',
            'herald': '#D946EF',
            'invoker': '#F4D35E',
            'justicar': '#2563EB',
            'mage': '#3B82F6',
            'occultist': '#6D28D9',
            'prowler': '#4B5563',
            'tracker': '#8B5A2B',
            'vanguard': '#EA580C',
            'warden': '#16A34A'
          };
          if (classColors[cls]) {
            badgeColor = classColors[cls];
          }
          const tagBadge = spell.tag ? `<span class="card-tag tag-badge" style="background: var(--arcane-purple, #9b59b6);">${spell.tag}</span>` : '';

          spellsListHTML += `
            <div class="compendium-card glass" style="position:relative; margin-bottom:12px; display:flex; flex-direction:column;">
              <div class="card-tag-row">${tagBadge}<div class="card-tag" style="background: ${badgeColor}">${spell.class || 'SPELL'}</div></div>
              <h3 class="card-title info-tooltip-trigger spell-cast-btn" data-id="${spellId}" data-cast-type="base" style="cursor: pointer; text-decoration: underline dotted; transition: color 0.2s;" onmouseover="this.style.color='var(--amber)'" onmouseout="this.style.color=''"> ${spell.name}</h3>
              <div class="card-meta" style="margin-bottom:8px;">Attunement: ${spell.attunement || 0} | Cost: ${spell.cost} | Activation: ${spell.actTime} | Range: ${spell.range} | Components: ${spell.components} | Duration: ${spell.duration}</div>
              <p class="card-description" style="margin-bottom:12px;">${spell.description}</p>
              ${spell.overchargeDesc ? `
                <div class="spell-overcharge glass" style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; font-size:0.85rem; border-left:3px solid ${badgeColor}; margin-bottom:12px;">
                  <strong class="spell-cast-btn" data-id="${spellId}" data-cast-type="overcharge" style="color:var(--amber); cursor: pointer; text-decoration: underline dotted;">Overcharge (Cost: ${spell.overchargeCost}):</strong> ${spell.overchargeDesc}
                </div>
              ` : ''}
              <button class="btn btn-danger btn-xs btn-unattune" data-id="${spellId}" style="align-self:center; margin-top:auto; padding:4px 16px;">Unattune</button>
            </div>
          `;
          }
        });
      }

      // Calculate available attunement
      let availableAttunement = (char.attunement.total || 0) - (char.attunement.used || 0);

      // Attunement choices (spells not currently attuned, restricted by class)
      let attuneOptions = "";
      window.BB_DATABASE.SPELLS.forEach(spell => {
        if (spell.class === char.class && !char.spells.includes(spell.id)) {
          let req = spell.attunement || 0;
          let isDisabled = req > availableAttunement;
          attuneOptions += `<option value="${spell.id}" ${isDisabled ? 'disabled' : ''}>
            ${spell.name} (Attunement: ${req}) ${isDisabled ? '- Not enough slots' : ''}
          </option>`;
        }
      });

      return `
        <div class="spells-tab-view">
          <div class="spell-attune-panel glass">
            <h4 style="margin-bottom: 12px; color: var(--amber);">Attunement Slots: ${char.attunement.used} / ${char.attunement.total}</h4>
            <label for="spell-attune-selector">Attune New Technique/Spell:</label>
            <div class="attune-controls">
              <select id="spell-attune-selector" class="form-control inline-select info-tooltip-trigger" data-type="spell">
                <option value="">-- Choose spell to attune --</option>
                ${attuneOptions}
              </select>
              <button class="btn btn-primary" id="btn-attune-spell">Attune</button>
            </div>
          </div>
          
          <div class="attuned-spells-list">
            ${spellsListHTML}
          </div>
        </div>
      `;
    } 
    
    else if (activeTab === "talents") {
      let charClass = window.BB_DATABASE.CLASSES.find(c => c.name === char.class);
      const isRedundant = (tName) => {
        if (!charClass) return false;
        const a = charClass.armorTraining || [];
        const w = charClass.weaponTraining || [];
        const hasA = (str) => a.some(item => item.includes(str));
        const hasW = (str) => w.some(item => item.includes(str));

        if (tName === "Aegis" && hasA("Shields")) return true;
        if (tName === "Veiled" && hasA("Ethereal")) return true;
        if (tName === "Mercurial" && hasA("Light")) return true;
        if (tName === "Bulwark" && hasA("Medium")) return true;
        if (tName === "Juggernaut" && hasA("Heavy")) return true;
        if (tName === "Martialist" && hasW("Martial")) return true;
        if (tName === "Colossus" && hasW("Great")) return true;
        if (tName === "Thaumic" && hasW("Focus")) return true;
        return false;
      };

      let talentsHTML = "";
      for (let i = 0; i < 5; i++) {
        let talentLevel = (i * 2) + 2; // 2, 4, 6, 8, 10
        let isUnlocked = char.level >= talentLevel;
        let currentVal = char.talents[i] || "";
        let optionsHtml = `<div class="custom-dropdown-option" data-value="" style="padding:4px 8px; cursor:pointer;">-- Select Talent --</div>`;
        if (window.BB_DATABASE && window.BB_DATABASE.TALENTS) {
          window.BB_DATABASE.TALENTS.forEach(t => {
            let selected = (currentVal === t.name || (currentVal && currentVal.startsWith(t.name + " ("))) ? true : false;
            let alreadyPicked = char.talents.some(talent => talent && (talent === t.name || talent.startsWith(t.name + " ("))) && !selected;
            let redundant = isRedundant(t.name) && !selected;
            let meetsReq = checkRequirement(t.requirement, char);
            
            if (alreadyPicked) {
              optionsHtml += `<div class="custom-dropdown-option info-tooltip-trigger" data-type="talent" data-name="${t.name}" data-value="${t.name}" style="padding:4px 8px; cursor:not-allowed; opacity:0.4; color:#fff;">${t.name} (Picked)</div>`;
            } else if (redundant) {
              optionsHtml += `<div class="custom-dropdown-option info-tooltip-trigger" data-type="talent" data-name="${t.name}" data-value="${t.name}" style="padding:4px 8px; cursor:not-allowed; opacity:0.4; color:#fff;">${t.name} (Class Feature)</div>`;
            } else if (!meetsReq) {
              optionsHtml += `<div class="custom-dropdown-option info-tooltip-trigger" data-type="talent" data-name="${t.name}" data-value="${t.name}" style="padding:4px 8px; cursor:not-allowed; opacity:0.4; color:#ef4444;">${t.name} (Requires ${t.requirement})</div>`;
            } else {
              optionsHtml += `<div class="custom-dropdown-option info-tooltip-trigger" data-type="talent" data-name="${t.name}" data-value="${t.name}" style="padding:4px 8px; cursor:pointer; ${selected ? 'background:rgba(255,255,255,0.1);' : ''}">${t.name}</div>`;
            }
          });
        }
        if (currentVal && (!window.BB_DATABASE.TALENTS || !window.BB_DATABASE.TALENTS.find(t => t.name === currentVal))) {
          optionsHtml += `<div class="custom-dropdown-option" data-value="${currentVal}" style="padding:4px 8px; cursor:pointer; background:rgba(255,255,255,0.1);">${currentVal}</div>`;
        }
        talentsHTML += `
          <div class="editable-slot-row glass" ${!isUnlocked ? 'style="opacity: 0.5; overflow:visible;"' : 'style="overflow:visible;"'}>
            <span class="slot-number" style="width: 50px;">Lvl ${talentLevel}.</span>
            <div class="custom-select-wrapper" data-type="talent" data-index="${i}" style="position:relative; flex:1;">
              <button class="custom-select-button info-tooltip-trigger" data-type="talent" data-name="${currentVal}" ${(!isUnlocked || currentVal) ? "disabled" : ""} style="width:100%; text-align:left; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); padding:4px 8px; color:var(--text-light); border-radius:4px; ${currentVal ? 'opacity:0.8;' : ''}">
                ${currentVal || '-- Select Talent --'} <span style="float:right; font-size:0.7rem; margin-top:4px;">${currentVal ? '🔒' : '▼'}</span>
              </button>
              <div class="custom-select-dropdown glass" style="display:none; position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; z-index:9999; flex-direction:column; padding:0; box-shadow:0 4px 12px rgba(0,0,0,0.8); border:1px solid var(--amber);">
                ${optionsHtml}
              </div>
            </div>
          </div>
        `;
      }

      let numFeats = (char.race === "Human") ? 6 : 5;
      let featsHTML = "";
      for (let i = 0; i < numFeats; i++) {
        let featLevelStr = (i === 5) ? "1 (Human)" : ((i * 2) + 1).toString();
        let isUnlocked = (i === 5) ? true : (char.level >= ((i * 2) + 1));
        let currentVal = char.feats[i] || "";
        let optionsHtml = `<div class="custom-dropdown-option" data-value="" style="padding:4px 8px; cursor:pointer;">-- Select Feat --</div>`;
        if (window.BB_DATABASE && window.BB_DATABASE.FEATS) {
          window.BB_DATABASE.FEATS.forEach(f => {
            let selected = (currentVal === f.name || (currentVal && currentVal.startsWith(f.name + " ("))) ? true : false;
            let alreadyPicked = char.feats.some(feat => feat && (feat === f.name || feat.startsWith(f.name + " ("))) && !selected;
            let meetsReq = checkRequirement(f.requirement, char);

            if (alreadyPicked) {
              optionsHtml += `<div class="custom-dropdown-option info-tooltip-trigger" data-type="feat" data-name="${f.name}" data-value="${f.name}" style="padding:4px 8px; cursor:not-allowed; opacity:0.4; color:#fff;">${f.name} (Picked)</div>`;
            } else if (!meetsReq) {
              optionsHtml += `<div class="custom-dropdown-option info-tooltip-trigger" data-type="feat" data-name="${f.name}" data-value="${f.name}" style="padding:4px 8px; cursor:not-allowed; opacity:0.4; color:#ef4444;">${f.name} (Requires ${f.requirement})</div>`;
            } else {
              optionsHtml += `<div class="custom-dropdown-option info-tooltip-trigger" data-type="feat" data-name="${f.name}" data-value="${f.name}" style="padding:4px 8px; cursor:pointer; ${selected ? 'background:rgba(255,255,255,0.1);' : ''}">${f.name}</div>`;
            }
          });
        }
        if (currentVal && (!window.BB_DATABASE.FEATS || !window.BB_DATABASE.FEATS.find(f => f.name === currentVal))) {
          optionsHtml += `<div class="custom-dropdown-option" data-value="${currentVal}" style="padding:4px 8px; cursor:pointer; background:rgba(255,255,255,0.1);">${currentVal}</div>`;
        }
        featsHTML += `
          <div class="editable-slot-row glass" ${!isUnlocked ? 'style="opacity: 0.5; overflow:visible;"' : 'style="overflow:visible;"'}>
            <span class="slot-number" style="width: 85px;">Lvl ${featLevelStr}.</span>
            <div class="custom-select-wrapper" data-type="feat" data-index="${i}" style="position:relative; flex:1;">
              <button class="custom-select-button info-tooltip-trigger" data-type="feat" data-name="${currentVal}" ${(!isUnlocked || currentVal) ? "disabled" : ""} style="width:100%; text-align:left; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); padding:4px 8px; color:var(--text-light); border-radius:4px; ${currentVal ? 'opacity:0.8;' : ''}">
                ${currentVal || '-- Select Feat --'} <span style="float:right; font-size:0.7rem; margin-top:4px;">${currentVal ? '🔒' : '▼'}</span>
              </button>
              <div class="custom-select-dropdown glass" style="display:none; position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; z-index:9999; flex-direction:column; padding:0; box-shadow:0 4px 12px rgba(0,0,0,0.8); border:1px solid var(--amber);">
                ${optionsHtml}
              </div>
            </div>
          </div>
        `;
      }

      const raceData = window.BB_DATABASE.SPECIES.find(s => s.name === char.race) || {};
      let ancestralFeatHtml = "";
      if (raceData.ancestralFeat) {
        ancestralFeatHtml = `
          <div style="margin-bottom:10px;">
            <strong style="color:var(--text-light);">${raceData.ancestralFeat.name}</strong>
            <p style="margin:0; color:#fff; font-size:0.9rem;">${raceData.ancestralFeat.desc}</p>
          </div>
        `;
      }

      return `
        <div class="talents-tab-view">
          <div class="talents-feats-grid">
            <div class="feats-column">
              <h4>Feats</h4>
              <p class="tab-desc">At every odd-numbered level (1st, 3rd, 5th, 7th, 9th), your character gains one feat permanently reflecting your accomplishments.</p>
              ${featsHTML}
            </div>
            
            <div class="talents-column">
              <h4>Talents</h4>
              <p class="tab-desc">At every even-numbered level (2nd, 4th, 6th, 8th, 10th), your character gains one Talent representing the deliberate honing of battlecraft.</p>
              ${talentsHTML}
            </div>
          </div>
          
          <div class="glass" style="margin-top:20px; padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
            <h3 style="margin-top:0; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px; margin-bottom:15px;">Ancestral Feat</h3>
            ${ancestralFeatHtml || "<p style='color:#fff;'>No ancestral feat found.</p>"}
          </div>
          
          <button id="btn-unlock-feats" class="btn btn-secondary" style="margin-top:15px; width:100%; border:1px solid var(--amber); background:rgba(0,0,0,0.5); color:var(--text-light); padding:10px; border-radius:4px; cursor:pointer;">
            🔓 Edit Selections (Unlock)
          </button>
        </div>
      `;
    }
    
    else if (activeTab === "features") {
      let featuresHtml = "";
      const classData = window.BB_DATABASE.CLASSES.find(c => c.name === char.class);
      if (classData && classData.features) {
         const sortedFeatures = [...classData.features].sort((a,b) => a.level - b.level);
         sortedFeatures.forEach(f => {
            const isLocked = char.level < f.level;
            featuresHtml += `
              <div class="glass" style="margin-bottom:10px; padding:10px; border:1px solid rgba(255,255,255,0.1); border-radius:5px; position:relative; overflow:hidden; ${isLocked ? 'opacity:0.6;' : ''}">
                <h4 style="margin:0; color:var(--amber); display:flex; justify-content:space-between;">
                  <span>${f.name}</span>
                  <span style="font-size:0.8rem; color:#fff;">Level ${f.level}</span>
                </h4>
                <div style="margin:5px 0 0 0; font-size:0.85rem; color:var(--text-light); line-height:1.4;">${f.desc}</div>
                ${isLocked ? `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; pointer-events:none; z-index:10;"><span style="background:rgba(0,0,0,0.8); color:var(--red); padding:5px 15px; border-radius:4px; font-weight:bold; font-size:1.2rem; border:2px solid var(--red);">LOCKED</span></div>` : ""}
              </div>
            `;
         });
      } else {
         featuresHtml = `<div style="color:#fff; font-style:italic;">No class features available.</div>`;
      }
      return `
        <div class="features-tab-view" style="padding:15px; height:100%; overflow-y:auto; padding-bottom:50px;">
          <h3 style="margin-top:0; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Class Features</h3>
          ${featuresHtml}
        </div>
      `;
    }
    else if (activeTab === "background") {
      const bg = char.background || {};
      const bgData = window.BB_DATABASE.BACKGROUNDS.find(b => b.name === (bg.name || bg)) || {};
      char.backgroundTraits = char.backgroundTraits || { trait: "", ideal: "", bond: "", flaw: "" };

      const renderTraitText = (type, val) => {
        if (!val) return "";
        return `
          <div style="margin-bottom:15px;">
            <strong style="color:var(--text-light); display:block; margin-bottom:4px;">${type}</strong>
            <div class="glass" style="padding:10px; border-radius:4px; border:1px solid rgba(255,193,7,0.3); color:var(--amber); font-style:italic;">
              "${val}"
            </div>
          </div>
        `;
      };

      const raceData = window.BB_DATABASE.SPECIES.find(s => s.name === char.race) || {};
      let ancestryDetailsHtml = "";
      if (raceData.features && raceData.features.length) {
        raceData.features.forEach(f => {
          let desc = f.desc;
          if (f.name === "Languages" && ["Changeling", "Human", "Ogre"].includes(char.race) && char.bonusLanguage) {
            desc += ` You have also learned ${char.bonusLanguage}.`;
          }
          ancestryDetailsHtml += `
            <div style="margin-bottom:10px;">
              <strong style="color:var(--text-light);">${f.name}:</strong> 
              <span style="color:#fff; font-size:0.95rem;">${desc}</span>
            </div>
          `;
        });
      }

      return `
        <div class="background-tab-view" style="padding:15px;">
          <h2 style="color:var(--amber); margin-top:0; border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">${bgData.name || "None"}</h2>
          <p style="color:#fff; font-size:0.95rem; line-height:1.4;">${bgData.description || "No background selected."}</p>
          
          ${bgData.featureName ? `
            <div class="glass" style="padding:15px; border-radius:8px; margin:20px 0; border:1px solid rgba(255,255,255,0.1);">
              <h3 style="margin-top:0; color:var(--text-light); margin-bottom:10px;">Feature: ${bgData.featureName}</h3>
              <p style="margin-bottom:0; color:#fff; font-size:0.9rem; line-height:1.4;">${bgData.featureDesc}</p>
            </div>
          ` : ''}

          <div class="glass" style="padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
            <h3 style="margin-top:0; margin-bottom:15px; color:var(--text-light);">Personality</h3>
            ${renderTraitText('Trait', char.backgroundTraits.trait)}
            ${renderTraitText('Ideal', char.backgroundTraits.ideal)}
            ${renderTraitText('Bond', char.backgroundTraits.bond)}
            ${renderTraitText('Flaw', char.backgroundTraits.flaw)}
          </div>

          <div class="glass" style="padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin-top:20px;">
            <h3 style="margin-top:0; margin-bottom:15px; color:var(--text-light);">Ancestry Details</h3>
            ${ancestryDetailsHtml || "<p style='color:#fff; font-size:0.95rem;'>No ancestry details found.</p>"}
          </div>
        </div>
      `;
    } else if (activeTab === "inventory") {
      try {
        if (!Array.isArray(char.inventorySlots)) {
          char.inventorySlots = new Array(49).fill("");
        } else {
          if (char.inventorySlots.length < 49) {
            char.inventorySlots = char.inventorySlots.concat(new Array(49 - char.inventorySlots.length).fill(""));
          } else if (char.inventorySlots.length > 49) {
            char.inventorySlots = char.inventorySlots.slice(0, 49);
          }
        }

      let gridHtml = char.inventorySlots.map((itemName, i) => {
        let itemTooltip = "";
        let displayName = "";
        if (itemName && typeof itemName === "string") {
          displayName = itemName.substring(0, 12) + (itemName.length > 12 ? "..." : "");
          const itemData = window.BB_DATABASE.ITEMS.find(x => x.name === itemName);
          if (itemData) {
            let techBlock = "";
            if (itemData.technique) {
              techBlock = `<h4 style='margin:0 0 4px 0;'>Technique: ${itemData.technique}</h4>`;
              if (itemData.techniqueDesc) {
                techBlock += `<div>${itemData.techniqueDesc.replace(/"/g, '&quot;')}</div>`;
              }
            }

            let extra = "";
            if (itemData.slot) extra += `<strong>Slot:</strong> ${itemData.slot}<br>`;
            if (itemData.damageDie) extra += `<strong>Damage:</strong> ${itemData.damageDie} (${itemData.damageType})<br>`;
            if (itemData.damageBonus) extra += `<strong>Modifier:</strong> ${itemData.damageBonus}<br>`;
            if (itemData.range) extra += `<strong>Range:</strong> ${itemData.range}<br>`;
            if (itemData.grip) extra += `<strong>Grip:</strong> ${itemData.grip}<br>`;
            if (itemData.properties) extra += `<strong>Properties:</strong> ${itemData.properties}<br>`;
            if (itemData.defense) extra += `<strong>Defense:</strong> ${itemData.defense}<br>`;
            if (itemData.resilience) extra += `<strong>Resilience:</strong> ${itemData.resilience}<br>`;
            if (itemData.movementPenalty) extra += `<strong>Mov. Penalty:</strong> ${itemData.movementPenalty}<br>`;
            if (itemData.sneakPenalty) extra += `<strong>Sneak Penalty:</strong> ${itemData.sneakPenalty}<br>`;
            if (itemData.cost) extra += `<strong>Cost:</strong> ${itemData.cost}<br>`;
            if (itemData.weight) extra += `<strong>Weight:</strong> ${itemData.weight}<br>`;
            
            let hr = `<hr style='border-color:rgba(255,255,255,0.1); margin:8px 0;'>`;
            itemTooltip = `<h4>${itemData.name}</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>${(itemData.description || '').replace(/"/g, '&quot;')}</p>`;
            
            if (techBlock) {
              itemTooltip += `${hr}<div style='margin:0; font-size:0.85rem; color:#fff;'>${techBlock}</div>`;
            }
            if (extra) {
              itemTooltip += `${hr}<div style='font-size:0.8rem; color:var(--amber);'>${extra}</div>`;
            }
          } else {
            itemTooltip = `<h4>${itemName}</h4>`;
          }
        }
        
        return `
          <div class="inventory-slot ${itemName ? 'info-tooltip-trigger' : ''}" data-drag-index="${i}" data-html="${itemTooltip}" style="position:relative; width:100%; aspect-ratio:1; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${itemName ? `<span style="font-size:0.75rem; text-align:center; padding:2px; color:var(--amber); font-weight:bold; word-break:break-word; pointer-events:none;">${displayName}</span>` : `<span style="font-size:1.5rem; color:rgba(255,255,255,0.2); pointer-events:none;">+</span>`}
            <div class="slot-drag-handle" draggable="true" data-index="${i}" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; cursor:grab;" title="${itemName ? 'Drag to move item' : ''}"></div>
            ${itemName ? `<button class="remove-item-btn" data-index="${i}" style="position:absolute; top:2px; right:2px; background:rgba(255,0,0,0.6); color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:20; opacity:0.7; transition:opacity 0.2s;" onmouseover="this.style.opacity=1;" onmouseout="this.style.opacity=0.7;" title="Remove Item">×</button>` : ''}
          </div>
        `;
      }).join("");

      return `
        <div class="inventory-tab-view glass" style="padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); height:100%; display:flex; flex-direction:column; overflow-y:auto;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
            <div style="flex:1; margin-right:15px;">
              <h2 style="margin-top:0; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Inventory</h2>
              <div style="position:relative; margin-top:10px;">
                <input type="text" id="inventory-search" placeholder="Search compendium to add item..." style="width:100%; padding:8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light);">
                <div id="inventory-search-results" style="position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:#1a1a1a; border:1px solid rgba(255,255,255,0.2); border-radius:4px; z-index:100; display:none; flex-direction:column; box-shadow:0 4px 8px rgba(0,0,0,0.5);"></div>
              </div>
              <div id="inventory-trash-zone" style="margin-top:10px; width:100%; height:50px; background:rgba(255,0,0,0.1); border:1px dashed rgba(255,0,0,0.4); border-radius:4px; display:flex; align-items:center; justify-content:center; color:rgba(255,0,0,0.7); font-size:0.9rem; transition:background 0.2s;">
                Drag item here to discard
              </div>
            </div>
            
            <div class="card burden-card glass" style="padding:10px 15px; border-radius:8px; width:220px; margin:0;">
              <h4 style="margin-top:0; margin-bottom:10px; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Burden</h4>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div class="mini-stat" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
                  <strong>Encumbrance:</strong>
                  <span><input type="number" class="inline-hp-input" style="width:40px; margin-right:4px; text-align:right; font-size:0.75rem;" id="encumb-val" value="${char.encumbrance}" readonly> / ${(char.equipment && char.equipment.armor === 'Heartcord' && (char._effectiveCon || char.stats.Con) < 18 ? 18 : (char._effectiveCon || char.stats.Con)) * 10} lbs</span>
                </div>
                <div class="mini-stat" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
                  <strong>Carry Capacity:</strong>
                  <span>${(char._effectiveStr || char.stats.Str) * 10} lbs</span>
                </div>
                <div class="mini-stat" style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem;">
                  <strong>Push/Drag/Lift:</strong>
                  <span>${(char._effectiveStr || char.stats.Str) * (char.equipment && char.equipment.hands === 'Goliath Grippers' ? 40 : 20)} lbs</span>
                </div>
              </div>
            </div>
          </div>
          <div class="inventory-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(70px, 1fr)); gap:10px; margin-top:10px; padding-bottom:20px;">
            ${gridHtml}
          </div>
        </div>
      `;
      } catch (err) {
        return `<div style="padding:20px; color:red; background:rgba(255,0,0,0.1); border:1px solid red; border-radius:8px;">
          <h3>Inventory Render Error</h3>
          <p>${err.message}</p>
          <pre style="font-size:0.7rem; overflow-x:auto;">${err.stack}</pre>
        </div>`;
      }
    } else if (activeTab === "notes") {
      return `
        <div class="notes-tab-view glass" style="padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); height:100%; display:flex; flex-direction:column;">
          <h2 style="margin-top:0; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Character Notes</h2>
          <textarea class="char-notes-input" style="flex:1; width:100%; min-height:400px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light); padding:15px; font-family:inherit; font-size:1rem; resize:vertical;">${char.notes || ""}</textarea>
        </div>
      `;
    }
  }

  function renderEquipSlot(label, val, dbKey, char) {

    // Check if off hand should be disabled due to main hand grip
    let isDisabled = false;
    let disabledReason = "";
    if (label === "Off Hand" && char.equipment && char.equipment.mainHand) {
      const mainHandItem = window.BB_DATABASE.ITEMS.find(i => i.name === char.equipment.mainHand);
      if (mainHandItem && ["Double", "Colossal"].includes(mainHandItem.grip)) {
        isDisabled = true;
        disabledReason = `Disabled by ${mainHandItem.grip} weapon in Main Hand`;
      }
    }

    // Generate options from inventory
    let optionsHtml = `<option value="">-- Empty --</option>`;
    if (Array.isArray(char.inventorySlots)) {
      const uniqueInvItems = [...new Set(char.inventorySlots.filter(Boolean))];
      uniqueInvItems.forEach(itemName => {
        if (typeof itemName !== 'string') return;
        // Prevent equipping the same single item in multiple slots
        const inventoryCount = char.inventorySlots.filter(i => i === itemName).length;
        let equippedElsewhere = 0;
        if (char.equipment) {
          for (const [key, eqItem] of Object.entries(char.equipment)) {
            if (key !== dbKey && eqItem === itemName) {
              equippedElsewhere++;
            }
          }
        }

        if (inventoryCount > equippedElsewhere || val === itemName) {
          const invItemData = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
          if (invItemData && (invItemData.slot === label || (invItemData.slot === "Weapon" && (label === "Main Hand" || label === "Off Hand")) || (invItemData.slot === "Shield" && label === "Off Hand"))) {
            
            // Apply Off Hand grip restriction
            if (label === "Off Hand" && invItemData.slot === "Weapon" && ["Single", "Double", "Colossal"].includes(invItemData.grip)) {
              return; // skip this item, it can't be put in the off hand
            }

            const selected = (val === itemName) ? "selected" : "";
            optionsHtml += `<option value="${itemName.replace(/"/g, '&quot;')}" ${selected}>${itemName}</option>`;
          }
        }
      });
    }

    // Include the currently equipped item if it's not in the inventory but is set
    // Also include it if the slot is disabled so we don't lose the display, though it's technically invalid.
    if (val && !optionsHtml.includes(`value="${val.replace(/"/g, '&quot;')}"`)) {
       optionsHtml += `<option value="${val.replace(/"/g, '&quot;')}" selected>${val} (Not in Inventory)</option>`;
    }

    return `
      <div class="equip-slot-row glass">
        <div class="equip-label">${label}:</div>
        <div class="equip-input-wrapper">
          <select class="equip-slot-input" data-key="${dbKey}" ${isDisabled ? `disabled title="${disabledReason}"` : ""} style="width:100%; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:4px; color:var(--text-light); margin-bottom:4px; ${isDisabled ? 'opacity:0.5; cursor:not-allowed;' : ''}">
            ${optionsHtml}
          </select>

        </div>
      </div>
    `;
  }

  function renderRollLog() {
    const logContainer = document.getElementById("sheet-roll-log");
    if (!logContainer) return;

    const log = window.BB_STATE.getDiceLog();
    logContainer.innerHTML = "";

    if (log.length === 0) {
      logContainer.innerHTML = `<p class="no-rolls-text">No rolls logged yet. Click any attribute or skill modifier to roll!</p>`;
      return;
    }

    log.forEach(item => {
      const row = document.createElement("div");
      row.className = "roll-log-item glass";
      row.innerHTML = `
        <div class="roll-log-meta">
          <span class="roll-log-time">${item.timestamp}</span>
          <span class="roll-log-label">${item.label}</span>
        </div>
        <div class="roll-log-numeric">
          <span class="roll-log-total">${item.result}</span>
          <span class="roll-log-breakdown">${item.breakdown}</span>
        </div>
      `;
      logContainer.appendChild(row);
    });
  }

  function setupEventListeners(char) {
    // Dropdown active selector
    const selector = document.getElementById("active-char-selector");
    if (selector) {
      selector.addEventListener("change", (e) => {
        window.BB_STATE.setActiveCharacter(e.target.value);
      });
    }

    // Action economy checkboxes
    document.querySelectorAll(".action-cb").forEach(cb => {
      cb.addEventListener("change", (e) => {
        if (!char.combatState) char.combatState = {};
        char.combatState[e.target.dataset.action] = e.target.checked;
        window.BB_STATE.saveCharacter(char);
        
        if (e.target.dataset.action === "action") {
          document.querySelectorAll(".action-quick-btn").forEach(b => {
            b.style.opacity = e.target.checked ? "0.4" : "1";
            b.style.cursor = e.target.checked ? "not-allowed" : "pointer";
          });
        }
      });
    });

    const btnResetActions = document.getElementById("reset-actions-btn");
    if (btnResetActions) {
      btnResetActions.addEventListener("click", () => {
        char.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
        window.BB_STATE.saveCharacter(char);
        document.querySelectorAll(".action-cb").forEach(cb => cb.checked = false);
        document.querySelectorAll(".action-quick-btn").forEach(b => {
          b.style.opacity = "1";
          b.style.cursor = "pointer";
        });
      });
    }

    // Action economy quick buttons
    document.querySelectorAll(".action-quick-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const actionName = btn.getAttribute("data-action-name");
        
        if (!char.combatState) char.combatState = {};
        
        let targetAction = "action";
        if (actionName === "Help" && char.talents && char.talents.includes("Accomplice")) {
          targetAction = "bonusAction";
        }
        
        if (char.combatState[targetAction]) return; // already consumed
        
        char.combatState[targetAction] = true;
        window.BB_STATE.saveCharacter(char);
        
        // Show notification
        const actionDesc = targetAction === "bonusAction" ? "Bonus Action" : "Action";
        window.BB_DICE.showToastNotification(`${actionDesc} consumed: ${actionName}`);
        
        window.BB_APP.renderActiveTab(); // re-render to update the checkboxes and button opacity
      });
    });


    // Attack roll buttons
    document.querySelectorAll(".attack-roll-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        let label = btn.getAttribute("data-label");
        const count = parseInt(btn.getAttribute("data-count"));
        const type = parseInt(btn.getAttribute("data-type"));
        let mod = parseInt(btn.getAttribute("data-mod"));
        const slot = btn.getAttribute("data-slot");
        const grip = btn.getAttribute("data-grip");
        const critRange = parseInt(btn.getAttribute("data-crit")) || 0;
        const bowmens = parseInt(btn.getAttribute("data-bowmens")) || 0;
        
        if (bowmens > 0) {
          mod += bowmens;
          label += " (+1 Bowmen's Bracers)";
        }
        
        // Auto-consume action economy
        if (!char.combatState) char.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
        if (slot === "offHand" && grip === "Dual") {
          if (char.combatState.bonusAction) {
            window.BB_DICE.showToastNotification("You lack the Bonus Action economy to perform this attack!");
            return;
          }
          char.combatState.bonusAction = true;
          const cb = document.querySelector('.action-cb[data-action="bonusAction"]');
          if (cb) cb.checked = true;
        } else {
          if (char.combatState.action) {
            window.BB_DICE.showToastNotification("You lack the Action economy to perform this attack!");
            return;
          }
          char.combatState.action = true;
          const cb = document.querySelector('.action-cb[data-action="action"]');
          if (cb) cb.checked = true;
        }
        window.BB_STATE.saveCharacter(char);
        
        let advDis = 0;
        if (grip === "Colossal") {
          advDis = -2;
        }
        
        window.BB_DICE.roll(label, count, type, mod, advDis, critRange, true, grip); 
      });
    });

    // Finesse Override Select listener
    document.querySelectorAll(".finesse-override-select").forEach(sel => {
      sel.addEventListener("click", e => e.stopPropagation()); // prevent attack roll
      sel.addEventListener("change", e => {
        const slot = e.target.getAttribute("data-slot");
        if (!char.finesseOverrides) char.finesseOverrides = {};
        char.finesseOverrides[slot] = e.target.value;
        window.BB_STATE.saveCharacter(char);
        window.BB_APP.renderActiveTab();
      });
    });

    // Short Rest fully heals Stamina (SP)
    const btnShortRest = document.getElementById("btn-short-rest");
    if (btnShortRest) {
      btnShortRest.addEventListener("click", () => {
        char.sp.current = char.sp.total;
        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`${char.name} took a Short Rest. Stamina (SP) fully recovered!`);
      });
    }

    // Long Rest fully heals HP, MP, SP and resets saves/temp HP
    const btnLongRest = document.getElementById("btn-long-rest");
    if (btnLongRest) {
      btnLongRest.addEventListener("click", () => {
        char.hp.current = char.hp.total;
        char.hp.temp = 0;
        char.mp.current = char.mp.total;
        if (!char.mp.temp) char.mp.temp = 0;
        char.mp.temp = 0;
        char.sp.current = char.sp.total;
        if (!char.sp.temp) char.sp.temp = 0;
        char.sp.temp = 0;
        char.deathSaves.successes = 0;
        char.deathSaves.failures = 0;
        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`${char.name} took a Long Rest. HP, MP, SP, and Death Saves fully refreshed!`);
      });
    }



    const xpInput = document.getElementById("char-xp-input");
    if (xpInput) {
      xpInput.addEventListener("change", (e) => {
        const newXp = parseInt(e.target.value) || 0;
        char.xp = Math.max(0, newXp);
        
        // Auto-level logic
        const thresholds = [0, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000];
        let newLevel = 1;
        for (let i = thresholds.length - 1; i >= 0; i--) {
          if (char.xp >= thresholds[i]) {
            newLevel = i + 1;
            break;
          }
        }
        
        if (newLevel !== char.level) {
          const oldLevel = char.level;
          char.level = newLevel;
          window.BB_DICE.showToastNotification(`${char.name} is now Level ${newLevel}!`);

          // Revert stat upgrades if leveling down
          if (newLevel < oldLevel) {
            if (!char.statUpgrades) char.statUpgrades = [];
            while (char.statUpgrades.length > newLevel - 1) {
              const statToRevert = char.statUpgrades.pop();
              char.stats[statToRevert] = Math.max(1, char.stats[statToRevert] - 1);
            }
            // Sync spentStatPoints
            char.spentStatPoints = char.statUpgrades.length;
          }
        }
        
        window.BB_STATE.saveCharacter(char);
        render();
      });
    }

    // Crit Bonus input
    const critBonusInput = document.getElementById("char-crit-bonus-input");
    if (critBonusInput) {
      critBonusInput.addEventListener("change", (e) => {
        char.critBonus = Math.max(0, parseInt(e.target.value) || 0);
        window.BB_STATE.saveCharacter(char);
        window.BB_APP.renderActiveTab();
      });
    }

    // HP, MP, SP numeric inputs changes
    const hpCur = document.getElementById("hp-current");
    const hpTot = document.getElementById("hp-total");
    const hpTmp = document.getElementById("hp-temp");
    
    if (hpCur) hpCur.addEventListener("change", (e) => {
      let newVal = parseInt(e.target.value) || 0;
      char.hp.current = Math.max(0, Math.min(newVal, char.hp.total));
      e.target.value = char.hp.current;
      if (char.hp.current > 0) {
        char.deathSaves.successes = 0;
        char.deathSaves.failures = 0;
      }
      window.BB_STATE.saveCharacter(char);
      window.BB_APP.renderActiveTab();
    });
    if (hpTot) hpTot.addEventListener("change", (e) => {
      char.hp.total = Math.max(0, parseInt(e.target.value) || 0);
      e.target.value = char.hp.total;
      window.BB_STATE.saveCharacter(char);
    });
    if (hpTmp) hpTmp.addEventListener("change", (e) => {
      char.hp.temp = Math.max(0, parseInt(e.target.value) || 0);
      e.target.value = char.hp.temp;
      window.BB_STATE.saveCharacter(char);
    });

    const fortuneRollBtn = document.getElementById("fortune-roll-btn");
    if (fortuneRollBtn) {
      fortuneRollBtn.addEventListener("click", () => {
        let hasAdvantage = false;
        if (char.equipment) {
          for (const [slot, itemName] of Object.entries(char.equipment)) {
            if (itemName === "Fortunae's Band") {
              hasAdvantage = true;
              break;
            }
          }
        }
        
        let effectiveLck = (char.stats && char.stats.Lck) ? char.stats.Lck : 10;
        if (typeof getEquipStatBonus === "function") effectiveLck += getEquipStatBonus(char, "Lck");
        let lckMod = window.BB_STATE.getModifier ? window.BB_STATE.getModifier(effectiveLck) : Math.floor((effectiveLck - 10) / 2);

        let roll1 = Math.floor(Math.random() * 100) + 1;
        let finalRoll = roll1;
        let msg = `Fortune Roll: [${roll1}] + ${lckMod} (Luck) = ${finalRoll + lckMod}`;
        
        if (hasAdvantage) {
          let roll2 = Math.floor(Math.random() * 100) + 1;
          finalRoll = Math.max(roll1, roll2);
          msg = `Fortune Roll (Advantage from Fortunae's Band): [${roll1}, ${roll2}] + ${lckMod} (Luck) = ${finalRoll + lckMod}`;
        }
        
        if (window.BB_STATE && window.BB_STATE.addDiceRoll) {
           window.BB_STATE.addDiceRoll("Fortune", 1, 100, lckMod, finalRoll + lckMod, msg);
        }
        window.BB_DICE.showToastNotification(msg);
      });
    }

    const rollDeathSaveBtn = document.querySelector(".roll-death-save-btn");
    if (rollDeathSaveBtn) {
      rollDeathSaveBtn.addEventListener("click", () => {
        if (!char.deathSaves) char.deathSaves = { successes: 0, failures: 0 };
        let roll = Math.floor(Math.random() * 20) + 1;
        let message = `Rolled a ${roll} for Death Saving Throw. `;

        if (roll <= 9) {
          let skullBandSlot = null;
          if (char.equipment) {
            for (const [slot, itemName] of Object.entries(char.equipment)) {
              if (itemName === "Skull Band") {
                skullBandSlot = slot;
                break;
              }
            }
          }
          if (skullBandSlot) {
            char.equipment[skullBandSlot] = "";
            if (Array.isArray(char.inventorySlots)) {
              const invIdx = char.inventorySlots.indexOf("Skull Band");
              if (invIdx > -1) char.inventorySlots[invIdx] = "";
            }
            roll = Math.floor(Math.random() * 20) + 1;
            message += `The Skull Band shatters to bone dust, granting a reroll! New roll: ${roll}. `;
          }
        }
        
        if (roll === 1) {
          char.deathSaves.failures += 2;
          message += "Critical Failure! (2 Failures)";
        } else if (roll >= 2 && roll <= 9) {
          char.deathSaves.failures += 1;
          message += "Failure.";
        } else if (roll >= 10 && roll <= 19) {
          char.deathSaves.successes += 1;
          message += "Success!";
        } else if (roll === 20) {
          message += "Critical Success! You regain 1 HP and become conscious.";
          char.hp.current = 1;
          char.deathSaves.successes = 0;
          char.deathSaves.failures = 0;
        }

        if (char.deathSaves.successes >= 3 && roll !== 20) {
          message += " You have stabilized and regain 1 HP!";
          char.hp.current = 1;
          char.deathSaves.successes = 0;
          char.deathSaves.failures = 0;
        } else if (char.deathSaves.failures >= 3) {
          message += " You have died.";
        }

        if (window.BB_STATE && window.BB_STATE.addDiceRoll) {
          window.BB_STATE.addDiceRoll("Death Saving Throw", 1, 20, 0, roll, `Roll: [${roll}]`);
        }
        window.BB_DICE.showToastNotification(message);
        window.BB_STATE.saveCharacter(char);
        window.BB_APP.renderActiveTab();
      });
    }

    // Death save manual checkbox toggle listener
    document.querySelectorAll(".death-save-cb").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const type = e.target.getAttribute("data-type");
        const idx = parseInt(e.target.getAttribute("data-index"));
        if (!char.deathSaves) char.deathSaves = { successes: 0, failures: 0 };
        
        if (e.target.checked) {
           char.deathSaves[type] = Math.max(char.deathSaves[type], idx);
        } else {
           char.deathSaves[type] = idx - 1;
        }
        window.BB_STATE.saveCharacter(char);
        window.BB_APP.renderActiveTab();
      });
    });

    const mpCur = document.getElementById("mp-current");
    const mpTot = document.getElementById("mp-total");
    const mpTmp = document.getElementById("mp-temp");
    if (mpCur) mpCur.addEventListener("change", (e) => {
      let newVal = parseInt(e.target.value) || 0;
      char.mp.current = Math.max(0, Math.min(newVal, char.mp.total));
      e.target.value = char.mp.current;
      window.BB_STATE.saveCharacter(char);
    });
    if (mpTot) mpTot.addEventListener("change", (e) => {
      char.mp.total = Math.max(0, parseInt(e.target.value) || 0);
      e.target.value = char.mp.total;
      window.BB_STATE.saveCharacter(char);
    });
    if (mpTmp) mpTmp.addEventListener("change", (e) => {
      if (!char.mp.temp) char.mp.temp = 0;
      char.mp.temp = Math.max(0, parseInt(e.target.value) || 0);
      e.target.value = char.mp.temp;
      window.BB_STATE.saveCharacter(char);
    });

    const spCur = document.getElementById("sp-current");
    const spTot = document.getElementById("sp-total");
    const spTmp = document.getElementById("sp-temp");
    if (spCur) spCur.addEventListener("change", (e) => {
      let newVal = parseInt(e.target.value) || 0;
      char.sp.current = Math.max(0, Math.min(newVal, char.sp.total));
      e.target.value = char.sp.current;
      window.BB_STATE.saveCharacter(char);
    });
    if (spTot) spTot.addEventListener("change", (e) => {
      char.sp.total = Math.max(0, parseInt(e.target.value) || 0);
      e.target.value = char.sp.total;
      window.BB_STATE.saveCharacter(char);
    });
    if (spTmp) spTmp.addEventListener("change", (e) => {
      if (!char.sp.temp) char.sp.temp = 0;
      char.sp.temp = Math.max(0, parseInt(e.target.value) || 0);
      e.target.value = char.sp.temp;
      window.BB_STATE.saveCharacter(char);
    });







    // Death Saves checkboxes listeners
    const s1 = document.getElementById("death-s-1");
    const s2 = document.getElementById("death-s-2");
    const s3 = document.getElementById("death-s-3");
    const f1 = document.getElementById("death-f-1");
    const f2 = document.getElementById("death-f-2");
    const f3 = document.getElementById("death-f-3");

    const updateDeathSaves = () => {
      let succ = 0;
      if (s1.checked) succ = 1;
      if (s2.checked) succ = 2;
      if (s3.checked) succ = 3;
      
      let fail = 0;
      if (f1.checked) fail = 1;
      if (f2.checked) fail = 2;
      if (f3.checked) fail = 3;

      char.deathSaves.successes = succ;
      char.deathSaves.failures = fail;
      window.BB_STATE.saveCharacter(char);
    };

    [s1, s2, s3, f1, f2, f3].forEach(cb => {
      if (cb) cb.addEventListener("change", updateDeathSaves);
    });

    // Attributes change inputs
    document.querySelectorAll(".attr-val-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const stat = input.getAttribute("data-stat");
        char.stats[stat] = parseInt(e.target.value) || 10;
        window.BB_STATE.saveCharacter(char);
        render(); // Full re-render to update dependent mods & skills
      });
    });

    document.querySelectorAll(".btn-add-stat").forEach(btn => {
      btn.addEventListener("click", () => {
        const stat = btn.getAttribute("data-stat");
        char.stats[stat] = (char.stats[stat] || 10) + 1;
        
        if (!char.statUpgrades) char.statUpgrades = [];
        char.statUpgrades.push(stat);
        char.spentStatPoints = char.statUpgrades.length;
        
        window.BB_STATE.saveCharacter(char);
        render();
      });
    });

    // Attributes roll hooks
    document.querySelectorAll(".stat-roll-hook").forEach(el => {
      el.addEventListener("click", () => {
        const label = el.getAttribute("data-label");
        const mod = parseInt(el.getAttribute("data-mod"));
        window.BB_DICE.roll(label, 1, 20, mod, 0, 0, false);
      });
    });

    // Initiative roll hook
    const btnInit = document.getElementById("btn-roll-initiative");
    if (btnInit) {
      btnInit.addEventListener("click", () => {
        let effectiveLck = char.stats.Lck;
        if (char.equipment && char.equipment.hands === "Caspian Clutches" && effectiveLck < 18) effectiveLck = 18;
        let luckMod = window.BB_STATE.getModifier(effectiveLck);
        
        let extraModifier = 0;
        let extraBreakdown = "";
        
        if (char.equipment && char.equipment.feet === "Quick Steppers") {
          extraModifier += 2;
          extraBreakdown += "+2 (Quick Steppers) ";
        }
        
        // Alacrity Talent Bonus (1d4)
        if (char.talents.includes("Alacrity")) {
          const d4Roll = Math.floor(Math.random() * 4) + 1;
          extraModifier += d4Roll;
          extraBreakdown += `+${d4Roll} (Alacrity) `;
          window.BB_DICE.showToastNotification(`Alacrity Talent: +${d4Roll} to Initiative!`);
        }
        let initAdvantage = (char.equipment && Object.values(char.equipment).includes("Moxie Loop")) ? 1 : 0;
        window.BB_DICE.roll('Initiative', 1, 20, luckMod, initAdvantage, 0, false, "", extraModifier, extraBreakdown.trim());
      });
    }

    // Tab buttons
    document.querySelectorAll(".sheet-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-tab");
        render();
      });
    });

    // Spell casting hook
    document.querySelectorAll(".spell-cast-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const spellId = btn.getAttribute("data-id");
        const castType = btn.getAttribute("data-cast-type");
        const spell = window.BB_DATABASE.SPELLS.find(s => s.id === spellId);
        if (!spell) return;

        let baseMatch = (spell.cost || "").match(/\+?(\d+)/);
        let baseCost = baseMatch ? parseInt(baseMatch[1]) : 0;
        
        let totalCost = baseCost;
        if (castType === "overcharge") {
          let ocMatch = (spell.overchargeCost || "").match(/\+?(\d+)/);
          let ocCost = ocMatch ? parseInt(ocMatch[1]) : 0;
          totalCost += ocCost;
        }

        if (totalCost > 0) {
          let pool = spell.cost.toLowerCase().includes("mana") ? "mp" : 
                     spell.cost.toLowerCase().includes("stamina") ? "sp" : null;
          
          if (pool) {
            const poolName = pool === "mp" ? "Mana" : "Stamina";
            if (char[pool].current < totalCost) {
              if (window.BB_DICE && window.BB_DICE.showToastNotification) {
                window.BB_DICE.showToastNotification(`Out of ${poolName}!`);
              }
              return;
            }
            char[pool].current = Math.max(0, char[pool].current - totalCost);
            window.BB_STATE.saveCharacter(char);
            if (window.BB_DICE && window.BB_DICE.showToastNotification) {
              window.BB_DICE.showToastNotification(`Cast ${spell.name}${castType === 'overcharge' ? ' (Overcharged)' : ''}! Used ${totalCost} ${poolName}.`);
            }
          }
        }
      });
    });

    // Skills roll clicks
    document.querySelectorAll(".skill-item").forEach(item => {
      item.addEventListener("click", (e) => {
        // Only trigger roll if we didn't click the checkbox
        if (e.target.classList.contains("skill-prof-checkbox-custom")) return;
        const name = item.getAttribute("data-name");
        const mod = parseInt(item.getAttribute("data-mod"));
        
        let advantageMode = 0;
        
        // Beak Mask (Advantage Die on Medicine)
        if (name === "Medicine" && char.equipment && char.equipment.head === "Beak Mask") {
          advantageMode = 2; // Advantage Die
        }
        
        // Cap and Bells (Advantage Die on Performance, Disadvantage Die on Diplomacy)
        if (char.equipment && char.equipment.head === "Cap and Bells") {
          if (name === "Performance") advantageMode = 2; // Advantage Die
          if (name === "Diplomacy") advantageMode = -2; // Disadvantage Die
        }
        
        // Flower Crown (Advantage Die on Bushcraft)
        if (name === "Bushcraft" && char.equipment && char.equipment.head === "Flower Crown") {
          advantageMode = 2; // Advantage Die
        }
        
        // Pickpocket's Pincers (Advantage Die on Sleight of Hand)
        if (name === "Sleight of Hand" && char.equipment && char.equipment.hands === "Pickpocket’s Pincers") {
          advantageMode = 2; // Advantage Die
        }

        // Myrlock's Monocle (Advantage Die on Investigation)
        if (name === "Investigation" && char.equipment && char.equipment.head === "Myrlock’s Monocle") {
          advantageMode = 2; // Advantage Die
        }

        // Telepathy Topper (Disadvantage Die on Concentration and Awareness)
        if (char.equipment && char.equipment.head === "Telepathy Topper") {
          if (name === "Concentration" || name === "Awareness") advantageMode = -2; // Disadvantage Die
        }

        // Porcelain Guise (Advantage Die on Diplomacy)
        if (name === "Diplomacy" && char.equipment && char.equipment.head === "Porcelain Guise") {
          advantageMode = 2; // Advantage Die
        }

        // Grim Visage (Advantage Die on Browbeat)
        if (name === "Browbeat" && char.equipment && char.equipment.head === "Grim Visage") {
          advantageMode = 2; // Advantage Die
        }

        // Familiar Facemask (Advantage Die on Awareness)
        if (name === "Awareness" && char.equipment && char.equipment.head === "Familiar Facemask") {
          advantageMode = 2; // Advantage Die
        }

        // Coinoret (Advantage Die on Commerce)
        if (name === "Commerce" && char.equipment && char.equipment.head === "Coinoret") {
          advantageMode = 2; // Advantage Die
        }

        // Bear Skull (Advantage Die on Concentration)
        if (name === "Concentration" && char.equipment && char.equipment.head === "Bear Skull") {
          advantageMode = 2; // Advantage Die
        }

        // Fathomless Fez (Advantage Die on Knowledge)
        if (name === "Knowledge" && char.equipment && char.equipment.head === "Fathomless Fez") {
          advantageMode = 2; // Advantage Die
        }

        // Jabbercap (Advantage Die on Linguistics)
        if (name === "Linguistics" && char.equipment && char.equipment.head === "Jabbercap") {
          advantageMode = 2; // Advantage Die
        }
        
        // Check for Sneak Disadvantage from Equipment
        if (name === "Sneak" && char.equipment) {
          Object.values(char.equipment).forEach(itemName => {
            if (itemName) {
              const itemData = window.BB_DATABASE.ITEMS.find(i => i.name === itemName);
              if (itemData && itemData.sneakPenalty) {
                if (itemData.sneakPenalty.toLowerCase().includes("disadvantage")) {
                  advantageMode = -1;
                }
              }
            }
          });
        }
        
        window.BB_DICE.roll(`${name} Check`, 1, 20, mod, advantageMode, 0, false);
      });
    });



    // Equipment inputs changes
    document.querySelectorAll(".equip-slot-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const key = input.getAttribute("data-key");
        char.equipment[key] = e.target.value;

        // Automatically unequip offhand if equipping a 2-handed weapon
        if (key === "mainHand" && char.equipment.mainHand && char.equipment.offHand) {
          const mainHandItem = window.BB_DATABASE.ITEMS.find(i => i.name === char.equipment.mainHand);
          if (mainHandItem && ["Double", "Colossal"].includes(mainHandItem.grip)) {
            let allowedByVanguard = false;
            if (mainHandItem.grip === "Double" && (!mainHandItem.properties || !mainHandItem.properties.includes("Ranged"))) {
              if (char.talents && char.talents.some(t => typeof t === 'string' && t.includes("Mighty Stance"))) {
                allowedByVanguard = true;
              }
            }
            if (!allowedByVanguard) {
              char.equipment.offHand = "";
            }
          }
        }

        window.BB_STATE.saveCharacter(char);
        render(); // refresh to show metadata
      });
    });

    // Wallet coins changes
    document.querySelectorAll(".coin-val-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const coin = input.getAttribute("data-coin");
        char.equipment.coins[coin] = parseInt(e.target.value) || 0;
        window.BB_STATE.saveCharacter(char);
      });
    });

    // Attune spells trigger
    const btnAttune = document.getElementById("btn-attune-spell");
    const attuneSelector = document.getElementById("spell-attune-selector");
    if (btnAttune && attuneSelector) {
      btnAttune.addEventListener("click", () => {
        const spellId = attuneSelector.value;
        if (!spellId) return;

        const spellData = window.BB_DATABASE.SPELLS.find(s => s.id === spellId);
        if (spellData) {
          if (char.attunement.used + spellData.attunement > char.attunement.total) {
            window.BB_DICE.showToastNotification("Not enough attunement slots available!");
            return;
          }
          char.spells.push(spellId);
          char.attunement.used += spellData.attunement;
          window.BB_STATE.saveCharacter(char);
          window.BB_DICE.showToastNotification(`Attuned to ${spellData.name}.`);
          render();
        }
      });
    }

    // Unattune spell triggers
    document.querySelectorAll(".btn-unattune").forEach(btn => {
      btn.addEventListener("click", () => {
        const spellId = btn.getAttribute("data-id");
        const spellData = window.BB_DATABASE.SPELLS.find(s => s.id === spellId);
        if (spellData) {
          char.spells = char.spells.filter(id => id !== spellId);
          char.attunement.used = Math.max(0, char.attunement.used - spellData.attunement);
          window.BB_STATE.saveCharacter(char);
          window.BB_DICE.showToastNotification(`Unattuned from ${spellData.name}.`);
          render();
        }
      });
    });

    // Custom Dropdown triggers
    document.querySelectorAll(".custom-select-button").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;
        const isOpening = dropdown.style.display === "none";
        document.querySelectorAll(".custom-select-dropdown").forEach(d => {
          d.style.display = "none";
          const row = d.closest('.editable-slot-row');
          if (row) row.style.zIndex = "";
        });
        if (isOpening) {
          dropdown.style.display = "flex";
          const row = dropdown.closest('.editable-slot-row');
          if (row) row.style.zIndex = "999";
        }
      });
    });

    document.querySelectorAll(".custom-dropdown-option").forEach(opt => {
      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        if (opt.style.cursor === "not-allowed") return;
        
        const wrapper = opt.closest('.custom-select-wrapper');
        const idx = parseInt(wrapper.getAttribute("data-index"));
        const type = wrapper.getAttribute("data-type");
        const val = opt.getAttribute("data-value");
        
        if (!val) {
          if (type === "talent") {
            char.talents[idx] = "";
          } else if (type === "feat") {
            char.feats[idx] = "";
          }
          window.BB_STATE.saveCharacter(char);
          render();
          return;
        }

        if (confirm(`Are you sure you want to lock in "${val}"? This choice cannot be undone.`)) {
          let finalVal = val;
          if (val === "Expert" && type === "feat") {
            const skillChoice = prompt("The Expert feat grants a bonus to one skill. Which skill do you choose? (e.g. Stealth, Athletics, etc.)");
            if (!skillChoice || skillChoice.trim() === "") {
              const dropdown = opt.closest('.custom-select-dropdown');
              if (dropdown) dropdown.style.display = "none";
              return;
            }
            const skillName = skillChoice.trim().charAt(0).toUpperCase() + skillChoice.trim().slice(1).toLowerCase();
            finalVal = `Expert (${skillName})`;
          }

          if (type === "talent") {
            char.talents[idx] = finalVal;
          } else if (type === "feat") {
            char.feats[idx] = finalVal;
          }
          window.BB_STATE.saveCharacter(char);
          render(); // Full re-render handles closing and updating
        } else {
          const dropdown = opt.closest('.custom-select-dropdown');
          if (dropdown) dropdown.style.display = "none";
        }
      });
      
      // Highlight effect
      opt.addEventListener("mouseenter", () => {
        if (opt.style.cursor !== "not-allowed") {
          opt.style.background = "rgba(255,255,255,0.15)";
        }
      });
      opt.addEventListener("mouseleave", () => {
        if (opt.style.cursor !== "not-allowed" && (!opt.getAttribute("style") || !opt.getAttribute("style").includes("rgba(255,255,255,0.1)"))) {
          opt.style.background = "transparent";
        }
      });
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll(".custom-select-dropdown").forEach(d => {
          d.style.display = "none";
          const row = d.closest('.editable-slot-row');
          if (row) row.style.zIndex = "";
        });
      }
    });

    // Unlock Feats Button
    const unlockFeatsBtn = document.getElementById("btn-unlock-feats");
    if (unlockFeatsBtn) {
      unlockFeatsBtn.addEventListener("click", () => {
        document.querySelectorAll('.custom-select-button[data-type="feat"], .custom-select-button[data-type="talent"]').forEach(btn => {
          btn.removeAttribute("disabled");
          const span = btn.querySelector("span");
          if (span && span.innerText === "🔒") {
            span.innerText = "▼";
          }
        });
      });
    }

    // Notes auto-save
    document.querySelectorAll(".char-notes-input").forEach(ta => {
      ta.addEventListener("change", (e) => {
        char.notes = e.target.value;
        window.BB_STATE.saveCharacter(char);
      });
    });

    const invSearch = document.getElementById("inventory-search");
    const invResults = document.getElementById("inventory-search-results");
    
    if (invSearch && invResults) {
      invSearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        invResults.innerHTML = "";
        
        if (query.length === 0) {
          invResults.style.display = "none";
          return;
        }
        
        const matchedItems = (window.BB_DATABASE.ITEMS || []).filter(item => 
          item.name.toLowerCase().includes(query)
        );
        
        if (matchedItems.length === 0) {
          invResults.style.display = "none";
          return;
        }
        
        matchedItems.forEach(item => {
          const div = document.createElement("div");
          div.textContent = item.name;
          div.style.padding = "8px 12px";
          div.style.cursor = "pointer";
          div.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
          div.onmouseover = () => div.style.backgroundColor = "rgba(255,193,7,0.2)";
          div.onmouseout = () => div.style.backgroundColor = "transparent";
          
          div.addEventListener("click", () => {
            if (!char.inventorySlots) char.inventorySlots = new Array(49).fill("");
            if (char.inventorySlots.length < 49) {
              char.inventorySlots = char.inventorySlots.concat(new Array(49 - char.inventorySlots.length).fill(""));
            }
            const emptyIdx = char.inventorySlots.findIndex(slot => slot === "");
            
            if (emptyIdx !== -1) {
              char.inventorySlots[emptyIdx] = item.name;
              window.BB_STATE.saveCharacter(char);
              render();
            } else {
              if (window.BB_DICE && window.BB_DICE.showToastNotification) {
                window.BB_DICE.showToastNotification("Inventory is full!");
              }
            }
          });
          
          invResults.appendChild(div);
        });
        
        invResults.style.display = "flex";
      });

      // Hide results when clicking outside
      document.addEventListener("click", (e) => {
        if (e.target !== invSearch && e.target !== invResults) {
          invResults.style.display = "none";
        }
      });
    }

    document.querySelectorAll(".remove-item-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = e.target.getAttribute("data-index");
        if (char.inventorySlots && char.inventorySlots[idx]) {
          char.inventorySlots[idx] = "";
          window.BB_STATE.saveCharacter(char);
          render();
        }
      });
    });

    // Drag and Drop Logic for Inventory Slots
    let draggedSlotIndex = null;

    document.querySelectorAll('.slot-drag-handle').forEach(handle => {
      handle.addEventListener('dragstart', (e) => {
        draggedSlotIndex = parseInt(e.target.getAttribute('data-index'));
        e.dataTransfer.effectAllowed = 'move';
        // HTML5 requires some data to be set to enable drag
        e.dataTransfer.setData('text/plain', draggedSlotIndex);
        e.target.closest('.inventory-slot').style.opacity = '0.5';
      });

      handle.addEventListener('dragend', (e) => {
        e.target.closest('.inventory-slot').style.opacity = '1';
        document.querySelectorAll('.inventory-slot').forEach(s => {
          s.style.border = '1px solid rgba(255,255,255,0.2)';
        });
      });
    });

    document.querySelectorAll('.inventory-slot').forEach(slot => {
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        slot.style.border = '2px solid var(--amber)';
      });

      slot.addEventListener('dragleave', (e) => {
        slot.style.border = '1px solid rgba(255,255,255,0.2)';
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        slot.style.border = '1px solid rgba(255,255,255,0.2)';
        const dropIndex = parseInt(slot.getAttribute('data-drag-index'));
        
        if (draggedSlotIndex !== null && draggedSlotIndex !== dropIndex) {
          // Swap items in inventory slots
          const temp = char.inventorySlots[draggedSlotIndex];
          char.inventorySlots[draggedSlotIndex] = char.inventorySlots[dropIndex];
          char.inventorySlots[dropIndex] = temp;
          
          window.BB_STATE.saveCharacter(char);
          render(); // Re-render to update UI
        }
      });
    });

    // Trash Zone Logic
    const trashZone = document.getElementById('inventory-trash-zone');
    if (trashZone) {
      trashZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        trashZone.style.background = 'rgba(255,0,0,0.3)';
        trashZone.style.border = '1px solid rgba(255,0,0,0.8)';
      });
      trashZone.addEventListener('dragleave', (e) => {
        trashZone.style.background = 'rgba(255,0,0,0.1)';
        trashZone.style.border = '1px dashed rgba(255,0,0,0.4)';
      });
      trashZone.addEventListener('drop', (e) => {
        e.preventDefault();
        trashZone.style.background = 'rgba(255,0,0,0.1)';
        trashZone.style.border = '1px dashed rgba(255,0,0,0.4)';
        if (draggedSlotIndex !== null) {
          char.inventorySlots[draggedSlotIndex] = "";
          window.BB_STATE.saveCharacter(char);
          render();
        }
      });
    }

    // Dice log clear button
    const clearLogBtn = document.getElementById("clear-dice-log-btn");
    if (clearLogBtn) {
      clearLogBtn.addEventListener("click", () => {
        window.BB_STATE.getDiceLog().length = 0; // Empty in-place
        renderRollLog();
      });
    }

    // Quick Dice Sidebar
    document.querySelectorAll(".quick-dice-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const sides = parseInt(btn.getAttribute("data-die"), 10);
        const countInput = document.getElementById("quick-dice-count");
        const count = countInput ? (parseInt(countInput.value) || 1) : 1;
        window.BB_DICE.roll(`Quick Roll (${count}d${sides})`, count, sides, 0, 0, 0, false);
      });
    });

    // Rest Logic
    const toggleShortRestBtn = document.getElementById("short-rest-toggle-btn");
    const shortRestPanel = document.getElementById("short-rest-panel");
    if (toggleShortRestBtn && shortRestPanel) {
      toggleShortRestBtn.addEventListener("click", () => {
        if (shortRestPanel.style.display === "none") {
          shortRestPanel.style.display = "flex";
        } else {
          shortRestPanel.style.display = "none";
        }
      });
    }

    document.querySelectorAll(".short-rest-option").forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (!char.restDice) char.restDice = { used: 0 };
        if (char.restDice.used >= char.level) return; // No dice left

        const pool = btn.getAttribute("data-pool");
        let restDieSize = 4;
        if (char.level >= 2) restDieSize = 6;
        if (char.level >= 4) restDieSize = 8;
        if (char.level >= 6) restDieSize = 10;
        if (char.level >= 8) restDieSize = 12;
        if (char.level >= 10) restDieSize = 20;

        let baseMod = 0;
        let poolName = "";
        let statName = "";
        if (pool === "hp") {
          let effectiveCon = char.stats.Con;
          if (char.equipment && char.equipment.armor === "Heartcord" && effectiveCon < 18) effectiveCon = 18;
          baseMod = Math.max(0, window.BB_STATE.getModifier(effectiveCon));
          poolName = "Hit Points";
          statName = "Con";
        } else if (pool === "mp") {
          let effectiveInt = char.stats.Int;
          if (char.equipment && char.equipment.head === "Starveil" && effectiveInt < 18) effectiveInt = 18;
          baseMod = Math.max(0, window.BB_STATE.getModifier(effectiveInt));
          poolName = "Mana Points";
          statName = "Int";
        } else if (pool === "sp") {
          baseMod = Math.max(0, window.BB_STATE.getModifier(char.stats.Dex));
          poolName = "Stamina Points";
          statName = "Dex";
        }

        let mod = baseMod;
        let hasRestful = false;
        if (char.talents && char.talents.includes("Restful")) {
          mod += 1;
          hasRestful = true;
        }

        const rollResult = Math.floor(Math.random() * restDieSize) + 1;
        const totalRestored = Math.max(0, rollResult + mod);

        // Apply to pool
        char[pool].current = Math.min(char[pool].current + totalRestored, char[pool].total);
        char.restDice.used += 1;
        
        // Log it
        let breakdownText = `Roll: [${rollResult}] ${baseMod >= 0 ? '+' : '-'} ${Math.abs(baseMod)} (${statName})`;
        if (hasRestful) breakdownText += ` + 1 (Restful)`;
        window.BB_STATE.addDiceRoll(`Short Rest (${poolName})`, 1, restDieSize, mod, totalRestored, breakdownText);

        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`Restored ${totalRestored} ${poolName}!`);
        render(); // Update UI
      });
    });

    const longRestBtn = document.getElementById("long-rest-btn");
    if (longRestBtn) {
      longRestBtn.addEventListener("click", () => {
        // Fully restore HP, MP, SP
        char.hp.current = char.hp.total;
        char.hp.temp = 0;
        char.mp.current = char.mp.total;
        char.mp.temp = 0;
        char.sp.current = char.sp.total;
        char.sp.temp = 0;

        // Restore half rest dice, minimum 1
        if (!char.restDice) char.restDice = { used: 0 };
        const maxDice = char.level;
        const toRestore = Math.max(1, Math.floor(maxDice / 2));
        char.restDice.used = Math.max(0, char.restDice.used - toRestore);

        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`Long Rest complete. Fully restored resources!`);
        render();
      });
    }
    // (Removed Background Personality Select & Roll event listeners here since it's now read-only in the sheet)


    // Subscribe to rolls to dynamically push new logs instantly
    window.BB_STATE.subscribe("dice_log_changed", () => {
      renderRollLog();
    });

    // Hover Tooltips for Spells, Feats, Talents
    const tooltip = document.getElementById("hover-tooltip");
    if (tooltip) {
      document.querySelectorAll(".info-tooltip-trigger").forEach(el => {
        el.addEventListener("mouseenter", (e) => {
          const html = el.getAttribute("data-html");
          if (html) {
            tooltip.innerHTML = html;
            tooltip.style.display = "block";
            return;
          }

          let name = el.getAttribute("data-name");
          let type = el.getAttribute("data-type");
          
          // For select elements, we need to map the selected value (ID or Name) to the actual Name
          if (!name) {
            let val = el.value;
            if (!val || val === "") return;
            if (type === "spell") {
              const s = window.BB_DATABASE.SPELLS.find(x => x.id === val);
              if (s) name = s.name;
            } else {
              name = val;
            }
          }
          if (!name || name === "") return;

          let dbArray = null;
          if (type === "spell") dbArray = window.BB_DATABASE.SPELLS;
          if (type === "feat") dbArray = window.BB_DATABASE.FEATS;
          if (type === "talent") dbArray = window.BB_DATABASE.TALENTS;

          if (dbArray) {
            const item = dbArray.find(i => i.name === name);
            if (item) {
              let meta = "";
              if (type === "spell") meta = `Attunement: ${item.attunement} | Cost: ${item.cost} | Range: ${item.range}`;
              if (type === "feat" || type === "talent") meta = `Requirement: ${item.requirement}`;
              
              tooltip.innerHTML = `
                <h4>${item.name}</h4>
                <div class="tooltip-meta">${meta}</div>
                <p>${item.description}</p>
              `;
              tooltip.style.display = "block";
            }
          } else if (type === "skill" || type === "attribute") {
            const html = el.getAttribute("data-html");
            if (html) {
              tooltip.innerHTML = html;
              tooltip.style.display = "block";
            }
          }
        });
        el.addEventListener("mousemove", (e) => {
          if (tooltip.style.display === "block") {
            let left = e.pageX + 15;
            let top = e.pageY + 15;
            const tooltipRect = tooltip.getBoundingClientRect();
            
            if (e.clientX + 15 + tooltipRect.width > window.innerWidth) {
              left = e.pageX - tooltipRect.width - 15;
            }
            if (e.clientY + 15 + tooltipRect.height > window.innerHeight) {
              top = e.pageY - tooltipRect.height - 15;
            }
            
            tooltip.style.left = left + "px";
            tooltip.style.top = top + "px";
          }
        });
        el.addEventListener("mouseleave", () => {
          tooltip.style.display = "none";
        });
      });
    }
  }

  return {
    init
  };
})();
