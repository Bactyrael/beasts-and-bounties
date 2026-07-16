// B&B Interactive Character Sheet Viewer
window.BB_CHARACTER_SHEET = (() => {
  let activeTab = localStorage.getItem("bb_sheet_tab") || "combat";
  if (activeTab === "spells") activeTab = "combat";
  let isEditingBackground = false;
  let isConditionsFlyoutOpen = false;

  function init() {
    render();
    
    // Subscribe to state updates to re-render when character state changes
    window.BB_STATE.subscribe("active_character_changed", () => {
      if (window.location.hash.startsWith("#/characters")) {
        render();
      }
    });
  }

  let lastScrollPositions = new Map();
  let renderPending = false;

  function render() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      renderPending = false;
      actualRender();
    });
  }

  function actualRender() {
    const container = document.getElementById("main-view-container");
    if (!container) return;

    // Save scroll positions
    const scrollableElements = document.querySelectorAll('*');
    scrollableElements.forEach(el => {
      if (el.scrollTop > 0 || el.scrollLeft > 0) {
        let key = el.id;
        if (!key && el.className) key = el.className;
        if (key) lastScrollPositions.set(key, {top: el.scrollTop, left: el.scrollLeft});
      }
    });
    lastScrollPositions.set('window', {top: window.scrollY, left: window.scrollX});

    const char = window.BB_STATE.getActiveCharacter();
    const allChars = window.BB_STATE.getSavedCharacters();

    if (!char) {
      container.innerHTML = `
        <div class="empty-sheet-view glass" style="padding: 40px; display:flex; flex-direction:column; align-items:center; text-align:center;">
          <h2>No Character Selected</h2>
          <p>Forge a new hero to start your journey in Beasts and Bounties.</p>
          <a href="#/builder" class="btn btn-primary" style="margin-top:15px;">Go to Character Forge</a>
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
    if (char.class === "Mage" && char.level >= 9) {
      totalAttunementSlots += 2;
    }
    let usedAttunement = 0;
    if (char.spells && window.BB_DATABASE && window.BB_DATABASE.SPELLS) {
      char.spells.forEach(spellId => {
        const spell = window.BB_DATABASE.SPELLS.find(s => s.id === spellId);
        if (spell && spell.attunement) {
          usedAttunement += window.BB_STATE.getSpellAttunementCost(char, spell);
        }
      });
    }
    char.attunement = { used: usedAttunement, total: totalAttunementSlots };

    // Compute Class-Granted Abilities & Trackers
    char.grantedAbilities = [];
    char.availableTrackers = [];
    char.trackers = char.trackers || {};

    if (window.BB_DATABASE && window.BB_DATABASE.CLASSES) {
      const classData = window.BB_DATABASE.CLASSES.find(c => c.name.toLowerCase() === (char.class || "").toLowerCase());
      if (classData && classData.features) {
        classData.features.forEach(feature => {
          if (feature.level <= char.level) {
            if (feature.grantedAbilities) {
              char.grantedAbilities.push(...feature.grantedAbilities);
            }
            const trackersToProcess = [];
            if (feature.tracker) trackersToProcess.push(feature.tracker);
            if (feature.trackers) trackersToProcess.push(...feature.trackers);

            trackersToProcess.forEach(t => {
              let maxVal = 0;
              try {
                const expression = t.maxCalc.replace(/level/g, char.level);
                maxVal = eval(expression);
              } catch(e) {
                console.error("Failed to parse tracker maxCalc", e);
              }
              let srr = t.shortRestRecover;
              if (srr && srr.includes && srr.includes("char.level")) {
                try {
                  srr = eval(srr);
                } catch(e) {}
              }

              char.availableTrackers.push({
                name: t.name,
                type: t.type,
                max: maxVal,
                shortRestRecover: srr
              });
              if (char.trackers[t.name] === undefined) {
                char.trackers[t.name] = t.type === "number" ? (t.defaultZero ? 0 : maxVal) : 0;
              }
            });
          }
        });
      }
    }

    // Helper for equip bonuses
    const getEquipStatBonus = (charObj, statKey) => {
      if (!charObj.equipment || !window.BB_DATABASE || !window.BB_DATABASE.ITEMS) return 0;
      let bonus = 0;
      const statMap = { "Str": "Strength", "Dex": "Dexterity", "Con": "Constitution", "Int": "Intelligence", "Wis": "Wisdom", "Lck": "Luck" };
      const fullStat = statMap[statKey] || statKey;
      Object.values(charObj.equipment).forEach(itemName => {
        if (!itemName || typeof itemName !== 'string') return;
        const item = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
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
    let effectiveCon = window.BB_STATE.getComputedStat(char, "Con");
    const conMod = window.BB_STATE.getModifier(effectiveCon);
    
    let effectiveInt = window.BB_STATE.getComputedStat(char, "Int");
    const intMod = window.BB_STATE.getModifier(effectiveInt);
    
    let effectiveDex = window.BB_STATE.getComputedStat(char, "Dex");
    const dexMod = window.BB_STATE.getModifier(effectiveDex);
    
    let effectiveStr = window.BB_STATE.getComputedStat(char, "Str");
    
    char._effectiveStr = effectiveStr;
    char._effectiveCon = effectiveCon;

    char.hp.total = (effectiveCon + conMod) * 5;
    if (char.talents && char.talents.includes("Vitality")) char.hp.total += conMod;
    if (char.equipment && Object.values(char.equipment).includes("Bull's Amulet")) char.hp.total += 5;
    
    char.mp.total = effectiveInt + intMod;
    if (char.talents && char.talents.includes("Acuity")) char.mp.total += intMod;
    if (char.equipment && Object.values(char.equipment).includes("Lizard's Amulet")) char.mp.total += 5;
    
    char.sp.total = effectiveDex + dexMod;
    if (char.talents && char.talents.includes("Vigor")) char.sp.total += dexMod;
    if (char.equipment && Object.values(char.equipment).includes("Rabbit's Amulet")) char.sp.total += 5;

    if (char.isNew) {
      char.hp.current = char.hp.total;
      char.mp.current = char.mp.total;
      char.sp.current = char.sp.total;
      delete char.isNew;
      if (window.BB_STATE && window.BB_STATE.saveCharacter) {
        window.BB_STATE.saveCharacter(char);
      }
    }

    char.critBonus = 0;
    if (char.equipment && Object.values(char.equipment).includes("Fox's Amulet")) char.critBonus += 1;

    let inventoryWeight = 0;
    if (Array.isArray(char.inventorySlots)) {
      char.inventorySlots.forEach(slotItem => {
        let name = null;
        let qty = 1;
        if (typeof slotItem === "string" && slotItem) {
          name = slotItem;
        } else if (slotItem && typeof slotItem === "object" && slotItem.name) {
          name = slotItem.name;
          qty = slotItem.quantity || 1;
        }
        if (name) {
          const item = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === name);
          if (item && item.weight) {
            inventoryWeight += (parseFloat(item.weight) || 0) * qty;
          }
        }
      });
    }
    char.encumbrance = inventoryWeight;
    const encumbMax = effectiveCon * 10;

    let maxSlots = 20;
    if (char.equipment && char.equipment.container1) {
      const allItems = (window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || []);
      const c1 = allItems.find(i => i.name === char.equipment.container1);
      if (c1 && c1.capacity) maxSlots += c1.capacity;
    }
    char.maxSlots = maxSlots;

    let isOvercapacity = false;
    if (Array.isArray(char.inventorySlots)) {
      for (let i = maxSlots; i < char.inventorySlots.length; i++) {
        if (char.inventorySlots[i] && char.inventorySlots[i] !== "") {
          isOvercapacity = true;
          break;
        }
      }
    }

    let defBreakdown = [];
    let resBreakdown = [];
    let speedBreakdown = [];

    // Calculate Defense and Resilience dynamically based on equipment
    let hasArmor = false;
    let hasShield = false;
    if (char.equipment && char.equipment.armor) {
      const armorItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.armor);
      if (armorItem && armorItem.type !== "Clothing") {
        hasArmor = true;
      }
    }
    
    let baseDefStat = (char.equipment && !!char.equipment.armor) ? "Str" : null;
    let baseResStat = (char.equipment && !!char.equipment.armor) ? "Wis" : null;
    let defBonus = 0;
    let resBonus = 0;

    if (!char.equipment || !char.equipment.armor) {
      defBreakdown.push(`0 (Unarmored Base)`);
      resBreakdown.push(`0 (Unarmored Base)`);
    }

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
          const itemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
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

    const finalDefStatBonus = baseDefStat ? Math.max(0, window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, baseDefStat))) : 0;
    if (baseDefStat) defBreakdown.push(`${finalDefStatBonus >= 0 ? '+' : ''}${finalDefStatBonus} (${baseDefStat} Modifier)`);
    char.defBreakdownStr = defBreakdown.join("&#10;");

    const finalResStatBonus = baseResStat ? Math.max(0, window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, baseResStat))) : 0;
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
          const itemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
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

    // Berserker Level 5: Monomania
    if (char.class === "Berserker" && char.level >= 5) {
      movementBonus += 10;
      speedBreakdown.push(`+10 (Monomania)`);
    }

    // Traits: Fleetfooted
    if (char.talents && char.talents.includes("Fleetfooted")) {
      movementBonus += 10;
      speedBreakdown.push(`+10 (Fleetfooted)`);
    }

    char.movement = baseMovement + movementBonus;

    // Encumbrance Penalties
    if (char.encumbrance >= encumbMax * 2 || isOvercapacity) {
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
    let xpPercent = 100;
    if (char.level < 10) {
      let currentLevelBase = xpThresholds[char.level - 1] || 0;
      let nextLevelReq = xpThresholds[char.level];
      let earnedThisLevel = char.xp - currentLevelBase;
      let neededThisLevel = nextLevelReq - currentLevelBase;
      xpPercent = Math.max(0, Math.min(100, (earnedThisLevel / neededThisLevel) * 100));
    }

    // Convert old string conditions to an object
    if (typeof char.conditions === 'string' || !char.conditions) {
      char.conditions = { exhaustion: 0 };
    }
    
    // Generate active condition badges

    window.getConditionIcon = (cond) => {
        const map = {
            "Bleeding": { icon: "fa-tint", color: "#EF4444" },
            "Blinded": { icon: "fa-eye-slash", color: "#9CA3AF" },
            "Charmed": { icon: "fa-heart", color: "#EC4899" },
            "Deafened": { icon: "fa-deaf", color: "#9CA3AF" },
            "Frightened": { icon: "fa-ghost", color: "#8B5CF6" },
            "Grappled": { icon: "fa-hand-rock", color: "#F59E0B" },
            "Incapacitated": { icon: "fa-user-injured", color: "#FCD34D" },
            "Invisible": { icon: "fa-low-vision", color: "#60A5FA" },
            "Paralyzed": { icon: "fa-bolt", color: "#FBBF24" },
            "Petrified": { icon: "fa-cubes", color: "#6B7280" },
            "Poisoned": { icon: "fa-skull-crossbones", color: "#10B981" },
            "Prone": { icon: "fa-bed", color: "#D97706" },
            "Restrained": { icon: "fa-link", color: "#F59E0B" },
            "Silenced": { icon: "fa-comment-slash", color: "#9CA3AF" },
            "Sleep": { icon: "fa-moon", color: "#3B82F6" },
            "Stunned": { icon: "fa-star", color: "#FCD34D" },
            "Submerged": { icon: "fa-water", color: "#3B82F6" },
            "Unconscious": { icon: "fa-dizzy", color: "#EF4444" },
            "Unstable": { icon: "fa-balance-scale-right", color: "#F59E0B" }
        };
        return map[cond] || { icon: "fa-skull", color: "#fff" };
    };

    let activeConditionBadges = "";
    const allConditions = Object.keys(window.BB_DATABASE.CONDITIONS).filter(c => c !== "Exhaustion");
    allConditions.forEach(c => {
      if (char.conditions && char.conditions[c]) {
        const styleInfo = window.getConditionIcon(c);
        activeConditionBadges += `<i class="fas ${styleInfo.icon} info-tooltip-trigger" data-type="condition" data-name="${c}" style="color:${styleInfo.color}; font-size:1rem; margin-left:6px; cursor:help;" title="${c}"></i>`;
      }
    });
    if (char.conditions && char.conditions.exhaustion > 0) {
      activeConditionBadges += `<i class="fas fa-lungs-virus info-tooltip-trigger" data-type="condition" data-name="Exhaustion" style="color:#EF4444; font-size:1rem; margin-left:6px; cursor:help;" title="Exhaustion"></i><strong style="color:#EF4444; font-size:0.75rem; margin-left:2px;">${char.conditions.exhaustion}</strong>`;
    }


    // Build character selector dropdown options
    let selectOptions = "";
    allChars.forEach(c => {
      selectOptions += `<option value="${c.id}" ${c.id === char.id ? "selected" : ""}>${c.name} (Lvl ${c.level} ${c.race} ${c.class})</option>`;
    });

    try {
      let topBarHtml = '', skillsColHtml = '', tabContentHtml = '';
      try { topBarHtml = renderTopBar(char, selectOptions); } catch (e) { topBarHtml = `<div style="color:red; padding:10px;">renderTopBar Error: ${e.message}<br><pre style="font-size:0.7rem;">${e.stack}</pre></div>`; console.error('renderTopBar error:', e); }
      try { skillsColHtml = renderSkillsColumn(char); } catch (e) { skillsColHtml = `<div style="color:red; padding:10px;">renderSkillsColumn Error: ${e.message}<br><pre style="font-size:0.7rem;">${e.stack}</pre></div>`; console.error('renderSkillsColumn error:', e); }
      try { tabContentHtml = renderTabContent(char); } catch (e) { tabContentHtml = `<div style="color:red; padding:10px;">renderTabContent Error: ${e.message}<br><pre style="font-size:0.7rem;">${e.stack}</pre></div>`; console.error('renderTabContent error:', e); }

      container.innerHTML = `
        <div class="sheet-page glass" style="display:flex; flex-direction:column; gap:20px; position: relative;">
          <!-- Main Row -->
          <div class="sheet-main-row" style="display:grid; grid-template-columns: 320px 350px minmax(300px, 1fr); gap:20px; align-items:stretch; overflow-x:auto; padding-bottom:10px;">
            
            <!-- COLUMN 1: Profile & Vitals (Formerly Top Bar) -->
            <div class="col-vitals glass" style="display:flex; flex-direction:column; gap:15px; padding:15px; border-radius:12px; overflow-y:auto; overflow-x:hidden;">
              ${topBarHtml}
            </div>

            <!-- COLUMN 2: Skills -->
            ${skillsColHtml}

            <!-- COLUMN 3: Tabs (Combat, Equipment, Traits, Background, Notes) -->
            <div class="col-details glass" style="display: flex; flex-direction: column; min-height: 0; border-radius: 12px; overflow: hidden;">
              <div class="details-tab-bar" style="flex-shrink: 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                <button class="sheet-tab-btn ${activeTab === "combat" ? "active" : ""}" data-tab="combat">Combat</button>
                <button class="sheet-tab-btn ${activeTab === "attunement" ? "active" : ""}" data-tab="attunement">Attunement</button>
                <button class="sheet-tab-btn ${activeTab === "equipment" ? "active" : ""}" data-tab="equipment">Equipment</button>
                <button class="sheet-tab-btn ${activeTab === "talents" ? "active" : ""}" data-tab="talents">Traits</button>
                <button class="sheet-tab-btn ${activeTab === "background" ? "active" : ""}" data-tab="background">Background</button>
                <button class="sheet-tab-btn ${activeTab === "notes" ? "active" : ""}" data-tab="notes">Notes</button>
              </div>

              <div class="tab-content-container" style="flex: 1; display: flex; flex-direction: column; padding: 15px; min-height: 800px;">
                ${tabContentHtml}
              </div>
            </div>
          </div>

          ${renderConditionsFlyout(char)}

          <!-- Inject Add Inspiration Modal -->
          <div id="add-insp-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:100000; justify-content:center; align-items:center;">
            <div class="card glass" style="width:300px; padding:20px; border-radius:8px; border:1px solid var(--amber);">
              <h3 style="margin-top:0; color:var(--amber);">Add Inspiration Die</h3>
              <div style="margin-bottom:10px;">
                <label style="font-size:0.8rem; color:var(--text-light);">Size</label>
                <select id="add-insp-size" class="form-control" style="background:rgba(0,0,0,0.5); color:#fff; border:1px solid rgba(255,255,255,0.2);">
                  <option value="d4">d4</option>
                  <option value="d6">d6</option>
                  <option value="d8">d8</option>
                  <option value="d10">d10</option>
                  <option value="d12">d12</option>
                  <option value="d20">d20</option>
                </select>
              </div>
              <div style="margin-bottom:15px;">
                <label style="font-size:0.8rem; color:var(--text-light);">Source / Name</label>
                <input type="text" id="add-insp-source" class="form-control" placeholder="e.g. Inspiring Performer" style="background:rgba(0,0,0,0.5); color:#fff; border:1px solid rgba(255,255,255,0.2);">
              </div>
              <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="add-insp-cancel" class="btn btn-secondary btn-sm">Cancel</button>
                <button id="add-insp-confirm" class="btn btn-primary btn-sm">Add</button>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (outerErr) {
      container.innerHTML = `<div style="color:red; padding:20px; background:rgba(0,0,0,0.9); border:2px solid red; border-radius:8px; margin:20px;">
        <h2>Character Sheet Render Error</h2>
        <p>${outerErr.message}</p>
        <pre style="font-size:0.7rem; overflow:auto;">${outerErr.stack}</pre>
      </div>`;
      console.error('Character sheet render error:', outerErr);
    }

    setupEventListeners(char);
    renderRollLog();
  }

  function renderConditionsFlyout(char) {
    const allConditions = Object.keys(window.BB_DATABASE.CONDITIONS).filter(c => c !== "Exhaustion");
    const displayStyle = isConditionsFlyoutOpen ? "flex" : "none";
    return `
      <!-- Conditions Flyout Panel -->
      <div id="conditions-flyout" class="conditions-flyout-panel glass" style="display:${displayStyle}; flex-direction:column; position:absolute; left:330px; top:80px; z-index:10000; width:250px; max-height:400px; overflow-y:auto; border:1px solid rgba(255,193,7,0.3); border-radius:8px; padding:15px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--amber); padding-bottom:5px; margin-bottom:10px;">
          <h3 style="margin:0;">Conditions</h3>
          <button id="close-conditions-btn" style="background:transparent; border:none; color:var(--text-light); cursor:pointer; font-size:1.5rem; line-height:1; padding:0;">&times;</button>
        </div>
        <div class="conditions-list">
          ${allConditions.map(c => {
            const desc = window.BB_DATABASE.CONDITIONS[c].replace(/'/g, "&#39;");
            return `
            <div class="condition-toggle-row">
              <span class="info-tooltip-trigger" style="cursor:help; border-bottom:1px dotted rgba(255,193,7,0.5);" data-html="<h4>${c}</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>${desc}</p>">${c}</span>
              <label class="switch">
                <input type="checkbox" class="condition-toggle-cb" data-condition="${c}" ${char.conditions && char.conditions[c] ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
            </div>
            `;
          }).join('')}
        </div>

        <div class="exhaustion-tracker">
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <span class="info-tooltip-trigger" style="cursor:help; border-bottom:1px dotted rgba(255,193,7,0.5);" data-html="<h4>Exhaustion</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>${window.BB_DATABASE.CONDITIONS['Exhaustion'].replace(/\n/g, '<br>').replace(/'/g, '&#39;')}</p>">Exhaustion</span>
            <span style="font-size:0.75rem; color:var(--text-light);">Level ${(char.conditions && char.conditions.exhaustion) || 0}</span>
          </div>
          <div class="exhaustion-levels">
            <button class="exhaustion-level-btn info-tooltip-trigger ${(char.conditions && char.conditions.exhaustion || 0) === 0 ? 'active' : ''}" data-level="0" data-html="<p style='margin:0; font-size:0.85rem; color:#fff;'>No exhaustion.</p>">--</button>
            <button class="exhaustion-level-btn info-tooltip-trigger ${(char.conditions && char.conditions.exhaustion || 0) >= 1 ? 'active' : ''}" data-level="1" data-html="<p style='margin:0; font-size:0.85rem; color:#fff;'>1. Disadvantage on ability checks.</p>">1</button>
            <button class="exhaustion-level-btn info-tooltip-trigger ${(char.conditions && char.conditions.exhaustion || 0) >= 2 ? 'active' : ''}" data-level="2" data-html="<p style='margin:0; font-size:0.85rem; color:#fff;'>2. Stamina costs are doubled.</p>">2</button>
            <button class="exhaustion-level-btn info-tooltip-trigger ${(char.conditions && char.conditions.exhaustion || 0) >= 3 ? 'active' : ''}" data-level="3" data-html="<p style='margin:0; font-size:0.85rem; color:#fff;'>3. Disadvantage on attacks and saving throws.</p>">3</button>
            <button class="exhaustion-level-btn info-tooltip-trigger ${(char.conditions && char.conditions.exhaustion || 0) >= 4 ? 'active' : ''}" data-level="4" data-html="<p style='margin:0; font-size:0.85rem; color:#fff;'>4. Hit point maximum is halved.</p>">4</button>
            <button class="exhaustion-level-btn info-tooltip-trigger ${(char.conditions && char.conditions.exhaustion || 0) >= 5 ? 'active' : ''}" data-level="5" data-html="<p style='margin:0; font-size:0.85rem; color:#fff;'>5. Speed becomes 0, and the creature can&#39;t move.</p>">5</button>
            <button class="exhaustion-level-btn info-tooltip-trigger ${(char.conditions && char.conditions.exhaustion || 0) >= 6 ? 'active' : ''}" data-level="6" style="border-color:#EF4444; color:#EF4444;" data-html="<p style='margin:0; font-size:0.85rem; color:#fff;'>6. Death.</p>">6</button>
          </div>
        </div>
      </div>
    `;
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
        const item = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
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

    let classBonus = 0;
    if (char.class === "Berserker" && char.level >= 10 && (statKey === "Str" || statKey === "Con")) {
      classBonus = 4;
    }
    if (char.class === "Disciple" && char.level >= 10 && (statKey === "Dex" || statKey === "Con")) {
      classBonus = 4;
    }

    let totalVal = window.BB_STATE.getComputedStat(char, statKey);
    
    let breakdown = [];
    breakdown.push(`Base & Points: <span style='float:right; color:var(--amber); font-weight:bold;'>${baseVal}</span>`);
    if (ancestryBonus > 0) {
      breakdown.push(`Ancestry Bonus: <span style='float:right; color:var(--amber); font-weight:bold;'>+${ancestryBonus}</span>`);
    }
    if (classBonus > 0) {
      breakdown.push(`Class Bonus: <span style='float:right; color:var(--amber); font-weight:bold;'>+${classBonus}</span>`);
    }
    if (equipBonus > 0) {
      breakdown = breakdown.concat(equipDetails);
    }

    // Add logic to show equipment overrides (Starveil, Heartcord, etc.)
    if (statKey === "Int" && char.equipment && char.equipment.head === "Starveil" && (innateVal + equipBonus + ancestryBonus + classBonus) < 18) {
      breakdown.push(`Equipment (Starveil): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
    }
    if (statKey === "Wis" && char.equipment && char.equipment.head === "Evergreen" && (innateVal + equipBonus + ancestryBonus + classBonus) < 18) {
      breakdown.push(`Equipment (Evergreen): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
    }
    if (statKey === "Con" && char.equipment && char.equipment.armor === "Heartcord" && (innateVal + equipBonus + ancestryBonus + classBonus) < 18) {
      breakdown.push(`Equipment (Heartcord): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
    }
    if (statKey === "Lck" && char.equipment && char.equipment.hands === "Caspian Clutches" && (innateVal + equipBonus + ancestryBonus + classBonus) < 18) {
      breakdown.push(`Equipment (Caspian Clutches): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
    }
    if (statKey === "Dex" && char.equipment && char.equipment.feet === "Dragon Riders" && (innateVal + equipBonus + ancestryBonus + classBonus) < 18) {
      breakdown.push(`Equipment (Dragon Riders): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
    }
    if (statKey === "Str" && char.equipment && char.equipment.waist === "String of Ears" && (innateVal + equipBonus + ancestryBonus + classBonus) < 18) {
      breakdown.push(`Equipment (String of Ears): <span style='float:right; color:var(--amber); font-weight:bold;'>Set to 18</span>`);
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
          ${unspentPoints > 0 && totalVal < 30 ? `<button class="btn btn-xs btn-primary btn-add-stat" data-stat="${statKey}" title="Increase ${statName} (+1)" style="padding:2px 6px; font-weight:bold; font-size:0.9rem;">+</button>` : ''}
          <input type="number" class="attr-val-input" data-stat="${statKey}" value="${totalVal}" style="width:50px;" readonly title="Base: ${innateVal}">
        </div>
      </div>
    `;
  }



  function renderTopBar(char, selectOptions) {
    char.conditions = char.conditions || {};
    let restDieSize = 4;
    if (char.level >= 2) restDieSize = 6;
    if (char.level >= 4) restDieSize = 8;
    if (char.level >= 6) restDieSize = 10;
    if (char.level >= 8) restDieSize = 12;
    if (char.level >= 10) restDieSize = 20;

    if (!char.restDice) char.restDice = { used: 0 };
    const maxRestDice = char.level;
    const availableRestDice = maxRestDice - char.restDice.used;


    window.getConditionIcon = (cond) => {
        const map = {
            "Bleeding": { icon: "fa-tint", color: "#EF4444" },
            "Blinded": { icon: "fa-eye-slash", color: "#9CA3AF" },
            "Charmed": { icon: "fa-heart", color: "#EC4899" },
            "Deafened": { icon: "fa-deaf", color: "#9CA3AF" },
            "Frightened": { icon: "fa-ghost", color: "#8B5CF6" },
            "Grappled": { icon: "fa-hand-rock", color: "#F59E0B" },
            "Incapacitated": { icon: "fa-user-injured", color: "#FCD34D" },
            "Invisible": { icon: "fa-low-vision", color: "#60A5FA" },
            "Paralyzed": { icon: "fa-bolt", color: "#FBBF24" },
            "Petrified": { icon: "fa-cubes", color: "#6B7280" },
            "Poisoned": { icon: "fa-skull-crossbones", color: "#10B981" },
            "Prone": { icon: "fa-bed", color: "#D97706" },
            "Restrained": { icon: "fa-link", color: "#F59E0B" },
            "Silenced": { icon: "fa-comment-slash", color: "#9CA3AF" },
            "Sleep": { icon: "fa-moon", color: "#3B82F6" },
            "Stunned": { icon: "fa-star", color: "#FCD34D" },
            "Submerged": { icon: "fa-water", color: "#3B82F6" },
            "Unconscious": { icon: "fa-dizzy", color: "#EF4444" },
            "Unstable": { icon: "fa-balance-scale-right", color: "#F59E0B" }
        };
        return map[cond] || { icon: "fa-skull", color: "#fff" };
    };

    let activeConditionBadges = "";
    const allConditions = Object.keys(window.BB_DATABASE.CONDITIONS).filter(c => c !== "Exhaustion");
    allConditions.forEach(c => {
      if (char.conditions && char.conditions[c]) {
        const styleInfo = window.getConditionIcon(c);
        activeConditionBadges += `<i class="fas ${styleInfo.icon} info-tooltip-trigger" data-type="condition" data-name="${c}" style="color:${styleInfo.color}; font-size:1rem; margin-left:6px; cursor:help;" title="${c}"></i>`;
      }
    });
    if (char.conditions && char.conditions.exhaustion > 0) {
      activeConditionBadges += `<i class="fas fa-lungs-virus info-tooltip-trigger" data-type="condition" data-name="Exhaustion" style="color:#EF4444; font-size:1rem; margin-left:6px; cursor:help;" title="Exhaustion"></i><strong style="color:#EF4444; font-size:0.75rem; margin-left:2px;">${char.conditions.exhaustion}</strong>`;
    }


    if (char.xp === undefined) char.xp = 0;
    const xpThresholds = [0, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000];
    let nextXp = char.level < 10 ? xpThresholds[char.level] : "Max";
    let xpPercent = 100;
    if (char.level < 10) {
      let currentLevelBase = xpThresholds[char.level - 1] || 0;
      let nextLevelReq = xpThresholds[char.level];
      let earnedThisLevel = char.xp - currentLevelBase;
      let neededThisLevel = nextLevelReq - currentLevelBase;
      xpPercent = Math.max(0, Math.min(100, (earnedThisLevel / neededThisLevel) * 100));
    }

    const unspentPoints = Math.max(0, (char.level - 1) - (char.spentStatPoints || 0));

    const renderAttrBox = (statKey, statName) => {
        let innateVal = char.stats[statKey];
        let computedVal = window.BB_STATE.getComputedStat(char, statKey);
        let mod = window.BB_STATE.getModifier(computedVal);
        let modStr = mod >= 0 ? "+" + mod : mod;
        
        const breakdownArray = window.BB_STATE.getStatBreakdown ? window.BB_STATE.getStatBreakdown(char, statKey) : [];
        let breakdownStr = breakdownArray.map(b => b.label === "Base" ? `${b.value} (Base)` : `+${b.value} (${b.label})`).join("&#10;");

        let addBtn = "";
        if (unspentPoints > 0 && computedVal < 30) {
            addBtn = `<button class="btn btn-xs btn-primary btn-add-stat" data-stat="${statKey}" title="Increase ${statName} (+1)" style="position:absolute; top:-5px; right:-5px; width:20px; height:20px; padding:0; border-radius:50%; font-weight:bold; font-size:0.8rem; z-index:10; display:flex; align-items:center; justify-content:center; box-shadow: 0 0 5px rgba(0,0,0,0.5);">+</button>`;
        }

        return `
          <div class="attr-box stat-roll-hook glass info-tooltip-trigger" style="position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; aspect-ratio:1/1; width:100%; padding:0; box-sizing:border-box; border:1px solid rgba(255,193,7,0.3); border-radius:8px; cursor:pointer;" data-type="attribute" data-name="${statName}" data-html="<h4>${statName} (${statKey})</h4><hr style='border-color:rgba(255,255,255,0.2); margin:5px 0;'><div style='font-size:0.8rem; color:#ddd; white-space:pre-wrap;'>${breakdownStr}</div>" data-label="${statName}" data-mod="${mod}">
            ${addBtn}
            <div style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; margin-bottom:2px;">${statKey}</div>
            <div style="font-size:1.2rem; font-weight:bold; color:#fff;">${modStr}</div>
            <div style="font-size:0.75rem; color:#aaa; margin-top:2px;">${computedVal}</div>
          </div>
        `;
    };

    return `
      <!-- Col 1: Profile & Rest -->
      <div style="display:flex; flex-direction:column; gap:10px; min-width:200px;">
        <div class="char-dropdown-wrapper" style="display:flex; align-items:center; gap:8px;">
          <label for="active-char-selector" style="margin:0; font-size:0.85rem; color:#fff;">Profile:</label>
          <select id="active-char-selector" class="char-select-dropdown" style="flex:1;">
            ${selectOptions}
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn btn-brown btn-xs" id="long-rest-btn" style="padding:4px 8px; font-size:0.75rem; flex:1;">Long Rest</button>
          <div style="position:relative; flex:1;">
            <button class="btn btn-accent btn-xs" id="short-rest-toggle-btn" style="padding:4px 8px; font-size:0.75rem; width:100%;">Short Rest</button>
            <div id="short-rest-panel" style="display:none; position:absolute; top:110%; right:0; width:160px; flex-direction:column; gap:6px; padding:8px; border:1px solid var(--amber); border-radius:6px; background:var(--bg-dark); z-index:10000; box-shadow:0 4px 10px rgba(0,0,0,0.8);">
              <span style="font-size:0.75rem; color:#fff; text-align:center;">d${restDieSize} Rest Die: <span style="color:var(--amber);">${availableRestDice} / ${maxRestDice}</span></span>
              <button class="btn btn-xs btn-primary short-rest-option" data-pool="hp" ${availableRestDice <= 0 ? "disabled" : ""}>+ Hit Points</button>
              <button class="btn btn-xs btn-primary short-rest-option" data-pool="mp" ${availableRestDice <= 0 ? "disabled" : ""}>+ Mana Points</button>
              <button class="btn btn-xs btn-primary short-rest-option" data-pool="sp" ${availableRestDice <= 0 ? "disabled" : ""}>+ Stamina Points</button>
              <hr style="margin:2px 0; border-color:rgba(255,255,255,0.1);">
              <button class="btn btn-xs btn-brown" id="btn-short-rest">Finish Short Rest</button>
            </div>
          </div>
          <button class="btn btn-primary btn-xs info-tooltip-trigger" id="fortune-roll-btn" style="padding:4px 8px; font-size:0.75rem; flex:1;" data-html="<h4>Fortune Roll</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>Roll a d100 + your Luck modifier to discover what you find!</p>">Fortune</button>
        </div>
      </div>

      <!-- Col 4: Resources -->
      <div style="display:flex; flex-direction:column; gap:5px;">
        <div style="display:flex; flex-direction:column; gap:10px; justify-content:center; align-items:stretch;">
            <div class="resource-col glass" style="display:flex; flex-direction:column; align-items:center; padding:5px 10px; border-radius:8px; position:relative; overflow:hidden;">
                <div style="position:absolute; left:0; top:0; height:100%; width:${(char.hp && char.hp.total > 0) ? Math.max(0, Math.min(100, (char.hp.current / char.hp.total) * 100)) : 0}%; background:rgba(239, 68, 68, 0.35); z-index:0; transition:width 0.3s ease;"></div>
                <div style="position:absolute; right:0; top:0; height:100%; width:${(char.hp && char.hp.total > 0 && char.hp.temp > 0) ? Math.max(0, Math.min(100, (char.hp.temp / char.hp.total) * 100)) : 0}%; background:rgba(255, 255, 255, 0.35); z-index:0; transition:width 0.3s ease;"></div>
                <div style="position:relative; z-index:1; width:100%;">
                    <div style="text-align:center; font-size:0.75rem; color:var(--text-light); font-weight:bold; margin-bottom:4px;">Hit Points</div>
                    <div style="display:flex; justify-content:space-around; align-items:flex-end; width:100%;">
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="font-size:0.6rem; color:#aaa; margin-bottom:2px;">CURRENT</div>
                            <div style="display:flex; align-items:center;">
                                <input type="number" class="res-val-input" id="hp-current" value="${(char.hp && char.hp.current) || 0}" style="width:50px; font-size:1rem; padding:2px; text-align:center;">
                                <span style="margin:0 4px; color:#666;">/</span>
                                <input type="number" class="res-val-input" id="hp-total" value="${(char.hp && char.hp.total) || 0}" readonly style="width:50px; font-size:1rem; padding:2px; color:#aaa; text-align:center;">
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="font-size:0.6rem; color:#aaa; margin-bottom:2px;">TEMP</div>
                            <input type="number" class="inline-hp-input" id="hp-temp" value="${(char.hp && char.hp.temp) || 0}" style="width:50px; font-size:1rem; padding:2px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--amber);">
                        </div>
                    </div>
                </div>
            </div>
            <div class="resource-col glass" style="display:flex; flex-direction:column; align-items:center; padding:5px 10px; border-radius:8px; position:relative; overflow:hidden;">
                <div style="position:absolute; left:0; top:0; height:100%; width:${(char.sp && char.sp.total > 0) ? Math.max(0, Math.min(100, (char.sp.current / char.sp.total) * 100)) : 0}%; background:rgba(64, 192, 87, 0.35); z-index:0; transition:width 0.3s ease;"></div>
                <div style="position:absolute; right:0; top:0; height:100%; width:${(char.sp && char.sp.total > 0 && char.sp.temp > 0) ? Math.max(0, Math.min(100, (char.sp.temp / char.sp.total) * 100)) : 0}%; background:rgba(255, 255, 255, 0.35); z-index:0; transition:width 0.3s ease;"></div>
                <div style="position:relative; z-index:1; width:100%;">
                    <div style="text-align:center; font-size:0.75rem; color:var(--text-light); font-weight:bold; margin-bottom:4px;">Stamina Points</div>
                    <div style="display:flex; justify-content:space-around; align-items:flex-end; width:100%;">
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="font-size:0.6rem; color:#aaa; margin-bottom:2px;">CURRENT</div>
                            <div style="display:flex; align-items:center;">
                                <input type="number" class="res-val-input" id="sp-current" value="${(char.sp && char.sp.current) || 0}" style="width:50px; font-size:1rem; padding:2px; text-align:center;">
                                <span style="margin:0 4px; color:#666;">/</span>
                                <input type="number" class="res-val-input" id="sp-total" value="${(char.sp && char.sp.total) || 0}" readonly style="width:50px; font-size:1rem; padding:2px; color:#aaa; text-align:center;">
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="font-size:0.6rem; color:#aaa; margin-bottom:2px;">TEMP</div>
                            <input type="number" class="inline-hp-input" id="sp-temp" value="${(char.sp && char.sp.temp) || 0}" style="width:50px; font-size:1rem; padding:2px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--amber);">
                        </div>
                    </div>
                </div>
            </div>
            <div class="resource-col glass" style="display:flex; flex-direction:column; align-items:center; padding:5px 10px; border-radius:8px; position:relative; overflow:hidden;">
                <div style="position:absolute; left:0; top:0; height:100%; width:${(char.mp && char.mp.total > 0) ? Math.max(0, Math.min(100, (char.mp.current / char.mp.total) * 100)) : 0}%; background:rgba(77, 171, 247, 0.35); z-index:0; transition:width 0.3s ease;"></div>
                <div style="position:absolute; right:0; top:0; height:100%; width:${(char.mp && char.mp.total > 0 && char.mp.temp > 0) ? Math.max(0, Math.min(100, (char.mp.temp / char.mp.total) * 100)) : 0}%; background:rgba(255, 255, 255, 0.35); z-index:0; transition:width 0.3s ease;"></div>
                <div style="position:relative; z-index:1; width:100%;">
                    <div style="text-align:center; font-size:0.75rem; color:var(--text-light); font-weight:bold; margin-bottom:4px;">Mana Points</div>
                    <div style="display:flex; justify-content:space-around; align-items:flex-end; width:100%;">
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="font-size:0.6rem; color:#aaa; margin-bottom:2px;">CURRENT</div>
                            <div style="display:flex; align-items:center;">
                                <input type="number" class="res-val-input" id="mp-current" value="${(char.mp && char.mp.current) || 0}" style="width:50px; font-size:1rem; padding:2px; text-align:center;">
                                <span style="margin:0 4px; color:#666;">/</span>
                                <input type="number" class="res-val-input" id="mp-total" value="${(char.mp && char.mp.total) || 0}" readonly style="width:50px; font-size:1rem; padding:2px; color:#aaa; text-align:center;">
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div style="font-size:0.6rem; color:#aaa; margin-bottom:2px;">TEMP</div>
                            <input type="number" class="inline-hp-input" id="mp-temp" value="${(char.mp && char.mp.temp) || 0}" style="width:50px; font-size:1rem; padding:2px; text-align:center; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--amber);">
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <!-- Col 3: Vitals -->
      <div style="display:flex; gap:10px; align-items:center; justify-content:center;">
        <div class="def-box glass info-tooltip-trigger" data-type="attribute" data-name="Defense" data-html="<h4>Defense (DEF)</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>How much physical damage you can mitigate.</p><hr style='border-color:rgba(255,255,255,0.2); margin:5px 0;'><div style='font-size:0.8rem; color:#ddd; white-space:pre-wrap;'>${char.defBreakdownStr}</div>" style="padding:5px 10px; text-align:center; min-width:50px;">
          <div style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; margin-bottom:2px;">DEF</div>
          <input type="number" class="def-input" id="def-val" value="${char.defense}" readonly style="font-size:1.2rem; font-weight:bold; background:transparent; border:none; color:#fff; width:100%; text-align:center; padding:0;">
        </div>
        <div class="def-box glass info-tooltip-trigger" data-type="attribute" data-name="Resilience" data-html="<h4>Resilience (RES)</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>How much elemental and divine damage you can mitigate.</p><hr style='border-color:rgba(255,255,255,0.2); margin:5px 0;'><div style='font-size:0.8rem; color:#ddd; white-space:pre-wrap;'>${char.resBreakdownStr}</div>" style="padding:5px 10px; text-align:center; min-width:50px;">
          <div style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; margin-bottom:2px;">RES</div>
          <input type="number" class="def-input" id="res-val" value="${char.resilience}" readonly style="font-size:1.2rem; font-weight:bold; background:transparent; border:none; color:#fff; width:100%; text-align:center; padding:0;">
        </div>
        <div class="def-box glass info-tooltip-trigger" data-type="attribute" data-name="Speed" data-html="<h4>Speed (SPD)</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>How far you can move during your turn in feet.</p><hr style='border-color:rgba(255,255,255,0.2); margin:5px 0;'><div style='font-size:0.8rem; color:#ddd; white-space:pre-wrap;'>${char.speedBreakdownStr}</div>" style="padding:5px 10px; text-align:center; min-width:50px;">
          <div style="font-size:0.75rem; color:var(--text-light); text-transform:uppercase; margin-bottom:2px;">SPD</div>
          <input type="number" class="def-input" id="move-val" value="${char.movement}" readonly style="font-size:1.2rem; font-weight:bold; background:transparent; border:none; color:#fff; width:100%; text-align:center; padding:0;">
        </div>
      </div>
      ${char.hasUntrainedArmor ? `<div style="text-align:center; color:var(--danger); font-weight:bold; font-size:0.85rem; padding:5px; border:1px solid var(--danger); border-radius:4px; background:rgba(255,50,50,0.1); margin-top:10px; cursor:pointer;" class="info-tooltip-trigger" data-type="condition" data-name="Untrained Armor">⚠️ UNTRAINED ARMOR EQUIPPED ⚠️</div>` : ''}

      <!-- Col 2: Attributes -->
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; align-items:center;">
        ${renderAttrBox("Str", "Strength")}
        ${renderAttrBox("Dex", "Dexterity")}
        ${renderAttrBox("Con", "Constitution")}
        ${renderAttrBox("Int", "Intelligence")}
        ${renderAttrBox("Wis", "Wisdom")}
        ${renderAttrBox("Lck", "Luck")}
      </div>

      <!-- Col 5: Conditions & XP -->
      <div style="display:flex; flex-direction:column; gap:5px; min-width:150px; flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong class="roll-death-save-btn info-tooltip-trigger" style="font-size:0.75rem; color:var(--text-light); cursor:pointer; border-bottom:1px dashed var(--amber);">Death Saves</strong>
            <div style="display:flex; gap:4px; font-size:0.7rem;">
                <span style="color:#aaa;">S:</span>
                <input type="checkbox" class="death-save-cb" data-type="successes" data-index="1" ${(char.deathSaves?.successes || 0) >= 1 ? "checked" : ""}>
                <input type="checkbox" class="death-save-cb" data-type="successes" data-index="2" ${(char.deathSaves?.successes || 0) >= 2 ? "checked" : ""}>
                <input type="checkbox" class="death-save-cb" data-type="successes" data-index="3" ${(char.deathSaves?.successes || 0) >= 3 ? "checked" : ""}>
                <span style="color:#aaa; margin-left:4px;">F:</span>
                <input type="checkbox" class="death-save-cb" data-type="failures" data-index="1" ${(char.deathSaves?.failures || 0) >= 1 ? "checked" : ""}>
                <input type="checkbox" class="death-save-cb" data-type="failures" data-index="2" ${(char.deathSaves?.failures || 0) >= 2 ? "checked" : ""}>
                <input type="checkbox" class="death-save-cb" data-type="failures" data-index="3" ${(char.deathSaves?.failures || 0) >= 3 ? "checked" : ""}>
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
            <strong style="font-size:0.75rem; color:var(--text-light);">XP</strong>
            <div style="flex:1; height:6px; background:rgba(0,0,0,0.5); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${xpPercent}%; background:var(--amber);"></div>
            </div>
            <input type="number" id="char-xp-input" value="${char.xp}" style="width:50px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:2px; border-radius:3px; text-align:right; font-size:0.75rem;"> 
        </div>
        <div class="glass" style="display:flex; flex-direction:column; padding:10px; border-radius:8px; margin-top:5px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.75rem; color:var(--text-light);">Conditions <button id="open-conditions-btn" style="background:transparent; border:none; color:var(--amber); cursor:pointer; font-weight:bold; padding:0 4px;">+</button></strong>
            </div>
            <div id="active-conditions-container" style="display:flex; flex-wrap:wrap; gap:4px; min-height:24px; align-items:center; margin-top:5px; padding:4px; background:rgba(0,0,0,0.2); border-radius:4px;">
                ${activeConditionBadges || '<span style="color:#aaa; font-size:0.7rem; font-style:italic;">No active conditions</span>'}
            </div>
        </div>
      </div>
    `;
  }

  function renderSkillsColumn(char) {
      const skillsList = [
        { name: "Acrobatics", attr: "Dex" }, { name: "Athletics", attr: "Str" }, { name: "Awareness", attr: "Wis" },
        { name: "Brawn", attr: "Str" }, { name: "Browbeat", attr: "Str" }, { name: "Bushcraft", attr: "Wis" },
        { name: "Commerce", attr: "Lck" }, { name: "Concentration", attr: "Con" }, { name: "Diplomacy", attr: "Lck" },
        { name: "Endurance", attr: "Con" }, { name: "Investigation", attr: "Int" }, { name: "Knowledge", attr: "Int" },
        { name: "Linguistics", attr: "Int" }, { name: "Medicine", attr: "Wis" }, { name: "Performance", attr: "Lck" },
        { name: "Sleight of Hand", attr: "Dex" }, { name: "Sneak", attr: "Dex" }, { name: "Tolerance", attr: "Con" }
      ];

      let skillsHTML = "";

      const getSkillAdvMode = (char, name) => {
        let mode = 0;
        if (name === "Commerce" && char.class === "Prowler" && char.level >= 6) mode = 2;
        if (name === "Diplomacy" && char.race === "Ogre") mode = 2;
        if (name === "Medicine" && char.equipment && char.equipment.head === "Beak Mask") mode = 2;
        if (char.equipment && char.equipment.head === "Cap and Bells") {
          if (name === "Performance") mode = 2;
          if (name === "Diplomacy") mode = -2;
        }
        if (name === "Bushcraft" && char.equipment && char.equipment.head === "Flower Crown") mode = 2;
        if (name === "Sleight of Hand" && char.equipment && char.equipment.hands === "Pickpocket's Pincers") mode = 2;
        if (name === "Investigation" && char.equipment && char.equipment.head === "Myrlock's Monocle") mode = 2;
        if (char.equipment && char.equipment.head === "Telepathy Topper" && (name === "Concentration" || name === "Awareness")) mode = -2;
        if (name === "Diplomacy" && char.equipment && char.equipment.head === "Porcelain Guise") mode = 2;
        if (name === "Browbeat" && char.equipment && char.equipment.head === "Grim Visage") mode = 2;
        if (name === "Awareness" && char.equipment && char.equipment.head === "Familiar Facemask") mode = 2;
        if (name === "Commerce" && char.equipment && char.equipment.head === "Coinoret") mode = 2;
        if (name === "Concentration" && char.equipment && char.equipment.head === "Bear Skull") mode = 2;
        if (name === "Knowledge" && char.equipment && char.equipment.head === "Fathomless Fez") mode = 2;
        if (name === "Linguistics" && char.equipment && char.equipment.head === "Jabbercap") mode = 2;
        if (name === "Sneak" && char.equipment) {
          Object.values(char.equipment).forEach(itemName => {
            if (itemName) {
              const itemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
              if (itemData && itemData.sneakPenalty && itemData.sneakPenalty.toLowerCase().includes("disadvantage")) mode = -1;
            }
          });
        }
        return mode;
      };

      skillsList.forEach(sk => {
        const classData = window.BB_DATABASE.CLASSES.find(c => c.name === char.class) || {};
        const isClassSkill = classData.skills && classData.skills.includes(sk.name);
        
        let displayAttr = sk.attr;
        let displayName = sk.name;
        
        if (sk.name === "Diplomacy" && char.race === "Ogre") {
          displayAttr = "Lck";
        }
        
        let advMode = getSkillAdvMode(char, sk.name);
        if (advMode === 2) displayName += ` <span style="color:var(--stamina-gold); font-size:0.7rem;">[ADV]</span>`;
        if (advMode === -2 || advMode === -1) displayName += ` <span style="color:var(--red); font-size:0.7rem;">[DIS]</span>`;
        
        let attrVal = window.BB_STATE.getComputedStat(char, displayAttr);
        const attrMod = window.BB_STATE.getModifier(attrVal);
        
        let breakdown = [];
        breakdown.push(`Modifier (${displayAttr}): <span style='float:right; color:var(--amber); font-weight:bold;'>${attrMod >= 0 ? '+' : ''}${attrMod}</span>`);
        let totalMod = attrMod;

        if (isClassSkill) {
          breakdown.push(`Class: <span style='float:right; color:var(--amber); font-weight:bold;'>+2</span>`);
          totalMod += 2;
        }

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

        if (char.equipment && window.BB_DATABASE && window.BB_DATABASE.ITEMS) {
          Object.values(char.equipment).forEach(itemName => {
            if (!itemName || typeof itemName !== 'string') return;
            const item = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
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
          <div class="skill-item glass hover-lift info-tooltip-trigger" style="padding: 7px 8px; margin: 0; display: flex; justify-content: space-between; align-items: center; border-radius: 3px; border: 1px solid rgba(255,255,255,0.05); cursor:pointer;" data-type="skill" data-name="${sk.name}" data-label="${sk.name}" data-mod="${totalMod}" data-html="<h4>${sk.name} Breakdown</h4><p style='margin:0'>${breakdownHtml.replace(/"/g, '&quot;')}</p><hr style='border-color: rgba(255,255,255,0.1); margin: 8px 0;'><p style='font-size:0.85rem; color:#fff; margin:0;'>${(window.BB_DATABASE.SKILL_DESCRIPTIONS[sk.name] || '').replace(/"/g, '&quot;')}</p>">
            <div class="skill-label" style="display:flex; align-items:center; gap:8px; overflow:hidden;">
              <span class="skill-name" style="font-weight:bold; color:#fff; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="skill-attr" style="color:var(--text-light); font-size:0.65rem; white-space:nowrap;">(${displayAttr})</span>
              <span class="skill-mod-display" style="color:var(--amber); font-weight:bold; font-size:0.9rem; white-space:nowrap;">${skillModStr}</span>
            </div>
          </div>
        `;
      });

      let resHTML = "";
      if (char.resistances && char.resistances.length > 0) resHTML += `<div style="font-size:0.75rem; margin-bottom:4px;"><strong style="color:var(--text-light)">Resistances:</strong> ${char.resistances.join(', ')}</div>`;
      if (char.immunities && char.immunities.length > 0) resHTML += `<div style="font-size:0.75rem; margin-bottom:4px;"><strong style="color:var(--text-light)">Immunities:</strong> ${char.immunities.join(', ')}</div>`;
      if (char.vulnerabilities && char.vulnerabilities.length > 0) resHTML += `<div style="font-size:0.75rem; margin-bottom:4px;"><strong style="color:var(--text-light)">Vulnerabilities:</strong> ${char.vulnerabilities.join(', ')}</div>`;

      return `
        <div style="display:flex; flex-direction:column; gap:10px; height: 100%;">
            <div class="card glass" style="flex:1; display:flex; flex-direction:column; padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); overflow:hidden;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 class="card-header-sm" style="margin:0;">Skills</h3>
              </div>
              <div class="skills-list-container" style="flex:1; display:grid; grid-template-columns: 1fr; grid-auto-rows: max-content; gap:4px; overflow-y:auto; overflow-x:hidden;">
                ${skillsHTML}
              </div>
              ${resHTML ? `<div style="margin-top:5px; border-top:1px solid rgba(255,255,255,0.1); padding-top:5px;">${resHTML}</div>` : ''}
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

    if (activeTab === "equipment") {
      try {
        let maxSlots = char.maxSlots || 20;

        if (!Array.isArray(char.inventorySlots)) {
          char.inventorySlots = new Array(maxSlots).fill("");
        } else {
          while (char.inventorySlots.length > maxSlots && (!char.inventorySlots[char.inventorySlots.length - 1] || char.inventorySlots[char.inventorySlots.length - 1] === "")) {
            char.inventorySlots.pop();
          }
          if (char.inventorySlots.length < maxSlots) {
            char.inventorySlots = char.inventorySlots.concat(new Array(maxSlots - char.inventorySlots.length).fill(""));
          }
        }

      let slotsToRender = char.inventorySlots.length > maxSlots ? char.inventorySlots : char.inventorySlots.concat(new Array(maxSlots - char.inventorySlots.length).fill(""));

      let gridHtml = slotsToRender.map((slotObj, i) => {
        let itemTooltip = "";
        let displayName = "";
        let itemName = "";
        let quantity = 1;

        if (slotObj) {
          if (typeof slotObj === "string") {
            itemName = slotObj;
          } else if (typeof slotObj === "object" && slotObj.name) {
            itemName = slotObj.name;
            quantity = slotObj.quantity || 1;
          }
        }

        if (itemName) {
          displayName = quantity > 1 ? `${itemName} (${quantity})` : itemName;
          if (char.equipment && Object.values(char.equipment).includes(itemName)) {
            displayName += " <span style='color:#aaa; font-size:0.85em; font-style:italic; font-weight:normal;'>(Equipped)</span>";
          }
          const dbItems = window.BB_DATABASE.ITEMS || [];
          const miscItems = window.BB_DATABASE.MISC_ITEMS || [];
          let itemData = dbItems.find(x => x.name === itemName);
          if (itemData) {
            itemData = { ...itemData, category: "item" };
          } else {
            itemData = miscItems.find(x => x.name === itemName);
            if (itemData) itemData = { ...itemData, category: "misc" };
          }

          if (itemData) {
            itemTooltip = window.BB_COMPENDIUM && window.BB_COMPENDIUM.generateDetailHTML
              ? window.BB_COMPENDIUM.generateDetailHTML(itemData).replace(/"/g, '&quot;')
              : `<h4>${displayName}</h4>`;
          } else {
            itemTooltip = `<h4>${displayName}</h4>`;
          }
        }
        
        const isOverCapacity = i >= maxSlots;
        const overcapStyle = isOverCapacity ? "box-shadow: inset 0 0 10px rgba(255,0,0,0.5); border: 1px solid rgba(255,0,0,0.5);" : "border:1px solid rgba(255,255,255,0.2);";

        return `
          <div class="inventory-slot ${itemName ? 'info-tooltip-trigger' : ''}" data-drag-index="${i}" data-html="${itemTooltip}" style="position:relative; width:100%; min-height:40px; background:rgba(0,0,0,0.5); ${overcapStyle} border-radius:4px; display:flex; align-items:center; justify-content:flex-start; padding:0 12px; overflow:hidden; cursor:pointer;">
            ${itemName ? `<span style="font-size:0.85rem; text-align:left; color:${isOverCapacity ? '#ff4d4d' : 'var(--amber)'}; font-weight:bold; pointer-events:none; flex-grow:1;">${displayName}${isOverCapacity ? ' <span style="font-size:0.7rem;color:#ff4d4d;">(Overcapacity)</span>' : ''}</span>` : `<span style="font-size:0.85rem; color:rgba(255,255,255,0.2); pointer-events:none; font-style:italic;">Empty Slot</span>`}
            <div class="slot-drag-handle" draggable="true" data-index="${i}" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; cursor:grab;" title="${itemName ? 'Drag to move item' : ''}"></div>
            ${itemName ? `<button class="remove-item-btn" data-index="${i}" style="position:relative; z-index:20; background:rgba(255,0,0,0.6); color:white; border:none; border-radius:50%; width:18px; height:18px; font-size:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0.7; transition:opacity 0.2s;" onmouseover="this.style.opacity=1;" onmouseout="this.style.opacity=0.7;" title="Remove Item">×</button>` : ''}
          </div>
        `;
      }).join("");

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
        <div class="equipment-tab-view glass" style="flex: 1; overflow-y:auto; position:relative; display:flex; flex-direction:column; padding:15px;">
          <div class="equipment-grid">
            
            <!-- Left Grid: Equipment Slots -->
            <div class="paper-doll-grid">
              ${renderEquipSlot("Head", eq.head, "head", char, "pd-head")}
              ${renderEquipSlot("Armor", eq.armor, "armor", char, "pd-armor")}
              ${renderEquipSlot("Hands", eq.hands, "hands", char, "pd-hands")}
              ${renderEquipSlot("Feet", eq.feet, "feet", char, "pd-feet")}
              ${renderEquipSlot("Main Hand", eq.mainHand, "mainHand", char, "pd-mainHand")}
              ${renderEquipSlot("Off Hand", eq.offHand, "offHand", char, "pd-offHand")}
              ${renderEquipSlot("Waist", eq.waist, "waist", char, "pd-waist")}
              ${renderEquipSlot("Neck", eq.neck, "neck", char, "pd-neck")}
              ${renderEquipSlot("Finger", eq.finger1, "finger1", char, "pd-finger1")}
              ${renderEquipSlot("Finger", eq.finger2, "finger2", char, "pd-finger2")}
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
              <!-- Burden -->
              <div class="card burden-card glass" style="padding:10px 15px; border-radius:8px; margin-top:20px;">
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

          </div>

          <!-- Inventory Section -->
          <div class="inventory-section glass" style="margin-top:20px; padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
              <div style="flex:1;">
                <h2 style="margin-top:0; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Inventory (${maxSlots})</h2>
                <div style="position:relative; margin-top:10px;">
                  <input type="text" id="inventory-search" placeholder="Search the compendium to add an item..." style="width:100%; padding:8px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light);">
                  <div id="inventory-search-results" style="position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:#1a1a1a; border:1px solid rgba(255,255,255,0.2); border-radius:4px; z-index:100; display:none; flex-direction:column; box-shadow:0 4px 8px rgba(0,0,0,0.5);"></div>
                </div>
                <div style="display:flex; gap:10px; margin-top:10px; align-items: stretch; width: 100%;">
                  <!-- Containers -->
                  <div style="display:flex; flex-direction:column; gap:4px; flex: 2; justify-content:center;">
                    ${renderEquipSlot("Container", eq.container1, "container1", char, "pd-container1")}
                  </div>
                  <!-- Discard Dropzone -->
                  <div id="inventory-trash-zone" style="flex: 1; min-height:50px; background:rgba(255,0,0,0.1); border:1px dashed rgba(255,0,0,0.4); border-radius:4px; display:flex; align-items:center; justify-content:center; color:rgba(255,0,0,0.7); font-size:0.9rem; transition:background 0.2s; text-align: center;">
                    Discard
                  </div>
                </div>
              </div>
            </div>
            <div class="inventory-grid" style="display:flex; flex-direction:column; gap:4px; margin-top:10px; padding-bottom:20px; padding-right: 8px;">
              ${gridHtml}
            </div>
          </div>
        </div>
      `;
      } catch (err) {
        return `<div style="padding:20px; color:red; background:rgba(255,0,0,0.1); border:1px solid red; border-radius:8px;">
          <h3>Equipment Render Error</h3>
          <p>${err.message}</p>
          <pre style="font-size:0.7rem; overflow-x:auto;">${err.stack}</pre>
        </div>`;
      }
    } 
    
    else if (activeTab === "combat") {
      let attacksHtml = ""; // Pre-declare if needed inside, but it's an IIFE right now
      return `
        <div style="display:flex; justify-content:center; align-items:stretch; flex:1; overflow-y:auto; height:100%;">
          <div style="flex:1; max-width:600px; display:flex; flex-direction:column; gap:20px; padding-bottom:20px; min-height:0;">
            ${(function(){return `<div style="display:flex; flex-direction:column;">${''}`})()} <!-- dummy just to isolate context if needed -->

            <!-- Class Resources Tracker Card -->
            ${(function() {
                let trackersHtml = "";
                let headerExtras = "";
                if (char.class === "Archon" && char.level >= 4) {
                  let diceType = "d20";
                  if (char.level >= 10) diceType = "d8";
                  else if (char.level >= 8) diceType = "d10";
                  else if (char.level >= 6) diceType = "d12";
                  headerExtras = `<button class="btn btn-xs btn-primary inline-roll-btn" data-roll="1${diceType}" data-label="Arcane Instability" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px;"><i class="fas fa-dice-d20"></i> Instability (${diceType})</button>`;
                } else if (char.class === "Vanguard") {
                    headerExtras = "";

                    let numStances = 1;
                    char.stances = char.stances || [];
                    if (char.stances.length > 1) char.stances = char.stances.slice(0, 1);
                    let stanceHtml = `<div style="display:flex; gap:5px; margin-top:5px; align-items:center;">
                        <span style="font-size:0.75rem; color:var(--amber);">Stances:</span>`;
                    for (let i = 0; i < numStances; i++) {
                        let selected = char.stances[i] || "";
                        stanceHtml += `<select class="vanguard-stance-select" data-index="${i}" style="font-size:0.7rem; padding:2px; background:rgba(0,0,0,0.5); color:#fff; border:1px solid var(--amber); border-radius:3px; outline:none;">
                            <option value="" ${selected===""?"selected":""}>None</option>
                            <option value="Mighty Stance" ${selected==="Mighty Stance"?"selected":""}>Mighty Stance</option>
                            <option value="Furious Stance" ${selected==="Furious Stance"?"selected":""}>Furious Stance</option>
                            <option value="Defensive Stance" ${selected==="Defensive Stance"?"selected":""}>Defensive Stance</option>
                            <option value="Giant Stance" ${selected==="Giant Stance"?"selected":""}>Giant Stance</option>
                        </select>`;
                    }
                    stanceHtml += `</div>`;
                    headerExtras += stanceHtml;
                }

                const hasTrackers = char.availableTrackers && char.availableTrackers.length > 0;

                if (hasTrackers || headerExtras !== "") {
                  trackersHtml += `<div class="card class-resources-card glass" style="padding:15px; margin:0; margin-bottom:20px;">`;
                  trackersHtml += `<h3 class="card-header-sm" style="display:flex; justify-content:space-between; align-items:center;">
                      <span>Class Resources</span>
                      ${headerExtras}
                    </h3>`;

                  if (hasTrackers) {
                    trackersHtml += `<div style="display:flex; flex-direction:column; gap:10px;">`;
                    char.availableTrackers.forEach((tracker) => {
                      let currentVal = char.trackers[tracker.name] || 0;
                      
                      let nameHtml = `<strong style="font-size:0.8rem; color:var(--text-light);">${tracker.name}</strong>`;
                      if (tracker.name === "Further Beyond") {
                        let fbUsedThisTurn = char.trackers && char.trackers["Further Beyond Used This Turn"];
                        let fbDisabled = (currentVal <= 0 || fbUsedThisTurn) ? "disabled" : "";
                        let fbStyle = fbDisabled ? "opacity:0.5; cursor:not-allowed;" : "";
                        nameHtml = `<button class="btn btn-xs btn-further-beyond" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px; background:var(--sp-green, #40c057); border:none; color:#ffffff; ${fbStyle}" title="On your turn, gain one additional action. Twice per long rest." ${fbDisabled}><i class="fas fa-unlink"></i> Further Beyond</button>`;
                      } else if (tracker.name === "Iron Lungs") {
                        let ilDisabled = currentVal <= 0 ? "disabled" : "";
                        let ilStyle = ilDisabled ? "opacity:0.5; cursor:not-allowed;" : "";
                        nameHtml = `<button class="btn btn-xs btn-primary btn-iron-lungs" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px; ${ilStyle}" title="Roll a die based on Dex to regain Stamina. If at max, gain Temp Stamina. Once per Long Rest." ${ilDisabled}><i class="fas fa-lungs"></i> Iron Lungs</button>`;
                      } else if (tracker.name === "Exhilaration") {
                        let exDisabled = currentVal <= 0 ? "disabled" : "";
                        let exStyle = exDisabled ? "opacity:0.5; cursor:not-allowed;" : "";
                        nameHtml = `<button class="btn btn-xs btn-danger btn-exhilaration" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px; background:#8a0303; border:none; color:#ffffff; ${exStyle}" title="As a bonus action, regain HP equal to Exhilaration Die + Vanguard level." ${exDisabled}>&#129504; Exhilaration</button>`;
                      } else if (tracker.name === "In Retrograde") {
                        let retroDisabled = currentVal <= 0 ? "disabled" : "";
                        let retroStyle = retroDisabled ? "opacity:0.5; cursor:not-allowed;" : "";
                        nameHtml = `<button class="btn btn-xs btn-primary btn-retrograde" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px; ${retroStyle}" title="Recover Covenant uses equal to half your Justicar level (rounded up) - Once per Long Rest" ${retroDisabled}><i class="fas fa-undo"></i> In Retrograde</button>`;
                      } else if (tracker.name === "Studious Meditation") {
                        let medDisabled = currentVal <= 0 ? "disabled" : "";
                        let medStyle = medDisabled ? "opacity:0.5; cursor:not-allowed;" : "";
                        nameHtml = `<button class="btn btn-xs btn-primary btn-studious-meditation" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px; ${medStyle}" title="Regain MP equal to Mage level + INT mod. If max, gain Temp MP instead. Once per Long Rest." ${medDisabled}><i class="fas fa-book-reader"></i> Studious Meditation</button>`;
                      } else if (tracker.name === "Archmage Uses") {
                        let archmageUses = (char.trackers && char.trackers["archmageUses"]) || 0;
                        let costText = archmageUses === 0 ? "Free" : (Math.pow(2, archmageUses) + "x MP");
                        nameHtml = `<button class="btn btn-xs btn-primary btn-archmage" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px;" title="Deal max damage on an attuned damage-dealing spell. Cost doubles each use."><i class="fas fa-hat-wizard"></i> Archmage (${costText})</button>`;
                      } else if (tracker.name === "Dark Bargain Uses") {
                        let dbDisabled = currentVal <= 0 ? "disabled" : "";
                        let dbStyle = dbDisabled ? "opacity:0.5; cursor:not-allowed;" : "";
                        nameHtml = `<button class="btn btn-xs btn-danger btn-dark-bargain" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px; background:#630214; border:1px solid #9c0a25; color:#ffffff; ${dbStyle}" title="Exchange HP equal to your level for the same amount of MP. Reduces HP to 1 if not enough." ${dbDisabled}><i class="fas fa-tint" style="color:#ef4444;"></i> Dark Bargain</button>`;
                      } else if (tracker.name === "Berserk Charges") {
                        let berserkDisabled = currentVal <= 0 ? "disabled" : "";
                        let berserkStyle = berserkDisabled ? "opacity:0.5; cursor:not-allowed;" : "";
                        nameHtml = `<button class="btn btn-xs btn-danger btn-berserk" style="padding:2px 8px; font-size:0.75rem; display:flex; align-items:center; gap:5px; ${berserkStyle}" ${berserkDisabled}><i class="fas fa-fire"></i> Berserk</button>`;
                      }

                      trackersHtml += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:5px;">
                        ${nameHtml}`;
                      if (tracker.type === "checkboxes") {
                        trackersHtml += `<div style="display:flex; gap:4px; align-items:center;">`;
                        for (let i = 1; i <= tracker.max; i++) {
                          trackersHtml += `<input type="checkbox" class="tracker-cb" data-tracker="${tracker.name}" data-index="${i}" ${currentVal >= i ? "checked" : ""}>`;
                        }
                        trackersHtml += `</div>`;
                      } else if (tracker.type === "number") {
                        trackersHtml += `<div style="display:flex; align-items:center; gap:5px;">
                          <button class="btn btn-xs btn-secondary tracker-num-btn" data-tracker="${tracker.name}" data-change="-1" style="padding:2px 6px;">-</button>
                          <input type="number" class="tracker-num-input" data-tracker="${tracker.name}" value="${currentVal}" max="${tracker.max}" min="0" style="width:40px; text-align:center; background:rgba(0,0,0,0.3); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:3px; padding:2px;">
                          <span style="color:#aaa; font-size:0.8rem;">/ ${tracker.max}</span>
                          <button class="btn btn-xs btn-secondary tracker-num-btn" data-tracker="${tracker.name}" data-change="1" style="padding:2px 6px;">+</button>
                        </div>`;
                      }
                      trackersHtml += `</div>`;
                    });
                    trackersHtml += `</div>`;
                  }
                  trackersHtml += `</div>`;
                }
                return trackersHtml;
              })()}

            <!-- Action Economy Tracker Card -->
            <div class="card action-economy-card glass" style="padding:15px; margin:0; margin-bottom:20px;">
              <h3 class="card-header-sm" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Action Economy</span>
                <div style="display:flex; align-items:center; gap:10px;">
                  <button class="btn btn-xs btn-secondary" id="reset-actions-btn" style="font-size:0.7rem; padding:2px 6px;">Reset Turn</button>
                </div>
              </h3>
              ${(function() {
                const countPotion = (name) => {
                  return (char.inventorySlots || []).reduce((acc, slot) => {
                    if (typeof slot === "string" && slot === name) return acc + 1;
                    if (slot && typeof slot === "object" && slot.name === name) return acc + (slot.quantity || 1);
                    return acc;
                  }, 0);
                };
                let hpPotionCount = countPotion("Health Potion");
                let mpPotionCount = countPotion("Mana Potion");
                let spPotionCount = countPotion("Stamina Potion");
                if (hpPotionCount > 0 || mpPotionCount > 0 || spPotionCount > 0) {
                   let html = `<div style="margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center;">`;
                   if (hpPotionCount > 0) html += `<button class="btn btn-xs use-potion-btn" data-pool="hp" data-name="Health Potion" style="background:var(--hp-red, #ff6b6b); border:1px solid #c92a2a; color:#fff; font-size:0.7rem; padding:2px 6px;">Health Potion (${hpPotionCount})</button>`;
                   if (mpPotionCount > 0) html += `<button class="btn btn-xs use-potion-btn" data-pool="mp" data-name="Mana Potion" style="background:var(--mana-blue, #4dabf7); border:1px solid #1864ab; color:#fff; font-size:0.7rem; padding:2px 6px;">Mana Potion (${mpPotionCount})</button>`;
                   if (spPotionCount > 0) html += `<button class="btn btn-xs use-potion-btn" data-pool="sp" data-name="Stamina Potion" style="background:var(--sp-green, #40c057); border:1px solid #2b8a3e; color:#fff; font-size:0.7rem; padding:2px 6px;">Stamina Potion (${spPotionCount})</button>`;
                   html += `</div>`;
                   return html;
                }
                return "";
              })()}
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

            <div class="card combat-stats-card glass" style="flex-shrink:0; padding:15px; margin:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:8px;">
                <h3 class="card-header-sm" style="margin:0; border:none; padding:0; display:flex; align-items:center; gap:10px;">
                  Combat
                </h3>
                <div style="display:flex; align-items:center;">
                  ${char.class === "Disciple" && char.level >= 5 && char.trackers && char.trackers["Battle Meditation Uses"] > 0 ?
                    `<button class="btn btn-sm" id="btn-battle-meditation" title="Consume 1 Use of Battle Meditation" style="background:var(--amber); color:black; border:none; font-weight:bold; padding:4px 12px; font-size:0.8rem; cursor:pointer; margin-right:8px;">Battle Meditation</button>` : ''}
                  <button class="btn btn-sm info-tooltip-trigger" id="btn-roll-initiative" data-type="ability" data-name="Initiative" data-html="<h4>Initiative</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When combat begins, each participant determines when they act by rolling Initiative. To do so, roll a d20 and add your Luck modifier to the result. The final number determines the order in which you take your turns during the clash.</p>" style="background:var(--mana-blue); color:white; border:none; font-weight:bold; padding:4px 12px; font-size:0.8rem; cursor:pointer;">Roll Initiative</button>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin:15px 0 10px 0; border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:4px;">
                <h4 style="margin:0; color:var(--amber); font-size:0.9rem;">Weapon Attacks</h4>
                <label style="font-size:0.7rem; color:var(--text-light); display:flex; align-items:center; gap:4px; font-weight:normal; cursor:pointer;">
                  <input type="checkbox" id="track-ammo-cb" ${(char.flags && char.flags.trackAmmo === false) ? "" : "checked"}> Track Ammo
                </label>
              </div>
              <div class="attacks-list" style="display:flex; flex-direction:column; gap:8px;">
                ${(function() {
                  let attacksHtml = "";
                  let hasWeaponEquipped = false;
                  for (const [slot, itemName] of Object.entries(char.equipment || {})) {
                    if (!itemName) continue;

                    let item = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);

                    if (slot === 'offHand' && char.equipment.mainHand) {
                        const mainHandItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.mainHand);
                        if (mainHandItem && ["Double", "Colossal"].includes(mainHandItem.grip)) {
                            let isMighty = mainHandItem.grip === "Double" && (!mainHandItem.properties || !mainHandItem.properties.includes("Ranged")) && char.stances && char.stances.includes("Mighty Stance");
                            if (!isMighty) {
                                continue;
                            }
                        }
                        // Dual grip bonus action attack requires two Dual grip weapons
                        if (item && item.grip === "Dual" && mainHandItem && mainHandItem.grip !== "Dual") {
                            continue;
                        }
                    }



                    let mightyPenalty = "";
                    if (item && item.grip === "Double" && (!item.properties || !item.properties.includes("Ranged")) && char.stances && char.stances.includes("Mighty Stance")) {
                        item = JSON.parse(JSON.stringify(item));
                        item.grip = "Single";
                        mightyPenalty = "(Reach -5ft) ";
                    }

                    if (item && item.damageDie) {
                      hasWeaponEquipped = true;
                      let modVal = 0;
                      let modStat = "";
                      let isImprovised = false;
                      
                      let charClass = window.BB_DATABASE.CLASSES.find(c => c.name === char.class);
                      const w = charClass ? (charClass.weaponTraining || []) : [];
                      if (char.talents && char.talents.includes("Martialist")) w.push("Martial");
                      if (char.talents && char.talents.includes("Colossus")) w.push("Great");
                      if (char.talents && char.talents.includes("Thaumic")) w.push("Focus");
                      
                      const itemTraining = item.training || item.type;
                      const hasTraining = itemTraining ? w.some(tw => tw === itemTraining || (typeof itemTraining === 'string' && itemTraining.includes(tw)) || (typeof tw === 'string' && tw.includes(itemTraining))) : true;

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

                      if (useDamageBonus === "Strength") { modVal = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Str")); modStat = "STR"; }
                      else if (useDamageBonus === "Dexterity") { modVal = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Dex")); modStat = "DEX"; }
                      else if (useDamageBonus === "Intelligence") { modVal = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Int")); modStat = "INT"; }
                      else if (useDamageBonus === "Wisdom") { modVal = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Wis")); modStat = "WIS"; }
                      else if (useDamageBonus === "Charisma") { modVal = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Cha")); modStat = "CHA"; }
                      
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
                        if (currentOverride === "STR") { modVal = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Str")); modStat = "STR"; }
                        else if (currentOverride === "DEX") { modVal = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Dex")); modStat = "DEX"; }
                        else {
                          const strMod = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Str"));
                          const dexMod = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Dex"));
                          if (strMod >= dexMod) { modVal = strMod; modStat = "STR"; }
                          else { modVal = dexMod; modStat = "DEX"; }
                        }
                      }
                      
                      if (item.grip === "Dual" && slot === "offHand") {
                        let hasFuriousStance = char.stances && char.stances.includes("Furious Stance");
                        if (!hasFuriousStance) {
                          modVal = 0;
                          modStat = "None";
                        }
                      }
                      if (modVal < 0) modVal = 0;
                      
                      if (item.grip === "Single") {
                        modVal += 2;
                        modStat += " + Single Grip";
                      }
                      
                      let bowmensBonus = 0;
                      if (item.properties && item.properties.includes("Ranged") && char.equipment && char.equipment.hands === "Bowmen's Bracers") {
                        bowmensBonus = 1;
                      }
                      
                      let maxCritCap = 0;
                      if (!isImprovised) {
                        if (item.grip === "Dual") maxCritCap = 1;
                        else if (item.grip === "Single") maxCritCap = 2;
                        else if (item.grip === "Double") maxCritCap = 3;
                        else if (item.grip === "Colossal") maxCritCap = 4;
                      }

                      let vanguardCritBonus = (char.class === "Vanguard" && char.level >= 10) ? 1 : 0;
                      
                      let baseCritRange = 0;
                      let critBonus = (char.critBonus || 0) + vanguardCritBonus;
                      let totalCritRange = baseCritRange + critBonus;
                      
                      if (!isImprovised && item.grip === "Single" && char.talents && char.talents.includes("Unfettered")) {
                        maxCritCap += 1;
                      }
                      
                      let finalCritRange = Math.min(totalCritRange, maxCritCap);
                      
                      let labelPrefix = (isImprovised ? "Improvised " : "");
                      let titleStr = `Roll ${count}d${type} ${modVal >= 0 ? '+'+modVal : modVal} (Base Crit: ${baseCritRange}, Max: ${maxCritCap})`;
                      
                      let displaySlot = slot === "mainHand" ? "Main Hand" : (slot === "offHand" ? "Off Hand" : slot.charAt(0).toUpperCase() + slot.slice(1));
                      let modDisplay = (modVal !== 0 || modStat !== "None") ? ` ${modVal >= 0 ? '+'+modVal : modVal}` : "";
                      let statDisplay = modStat !== "None" ? ` <span style="font-size:0.7rem; color:#fff; margin-left:4px;">(${modStat})</span>` : "";

                      let extraDmgLabel = "";
                      let extraDiceConfig = null;
                      if (char.class === "Justicar" && char.level >= 5 && slot === "mainHand" && item.type !== "Bow" && item.type !== "Throwing") {
                        if (char.level >= 10) {
                          extraDmgLabel = ` <span style="color:#a855f7; font-size:0.8rem; margin-left:4px;" title="Ascendency: +2d8 Magic">+ 2d8 Magic</span>`;
                          extraDiceConfig = "2,8,Magic";
                        } else {
                          extraDmgLabel = ` <span style="color:#a855f7; font-size:0.8rem; margin-left:4px;" title="Celestial Strikes: +1d8 Magic">+ 1d8 Magic</span>`;
                          extraDiceConfig = "1,8,Magic";
                        }
                      }

                      let qtyStr = "";
                      let ammoName = null;
                      if (["Dart", "Throwing Knife", "Bola"].includes(item.name)) ammoName = item.name;
                      else if (item.type && item.type.includes("Bow") && !item.name.includes("Crossbow")) ammoName = "Arrow";
                      else if (item.name.includes("Crossbow")) ammoName = "Crossbow Bolt";

                      if (ammoName && !(char.flags && char.flags.trackAmmo === false)) {
                        let totalQty = 0;
                        if (char.inventorySlots) {
                          char.inventorySlots.forEach(s => {
                            if (typeof s === "string" && s === ammoName) totalQty++;
                            else if (typeof s === "object" && s && s.name === ammoName) totalQty += (s.quantity || 1);
                          });
                        }
                        qtyStr = ` <span style="color:#ef4444; font-size:0.75rem; margin-left:4px;">(Ammo: ${totalQty})</span>`;
                      }

                      let mightyHtml = mightyPenalty ? ` <span style="color:#ef4444; font-size:0.7rem;">${mightyPenalty.trim()}</span>` : "";

                      attacksHtml += `<button class="btn btn-secondary attack-roll-btn" data-slot="${slot}" data-grip="${isImprovised ? '' : (item.grip || '')}" data-label="Damage: ${labelPrefix}${item.name}" data-count="${count}" data-type="${type}" data-mod="${modVal}" data-base-crit="${baseCritRange}" data-crit-bonus="${critBonus}" data-max-crit="${maxCritCap}" data-bowmens="${bowmensBonus}" data-ammo="${ammoName || ''}" data-extradice="${extraDiceConfig || ''}" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer;" title="${titleStr}"><span>${labelPrefix}${item.name}${qtyStr} <span style="color:#fff; font-size:0.75rem;">(${displaySlot})${mightyHtml}</span></span><span style="color:var(--amber); display:flex; align-items:center;">${count}d${type}${modDisplay} ${item.damageType || ""}${statDisplay}${extraDmgLabel}${finesseSelect}</span></button>`;
                    }
                  }

                  if (true) {
                    let strMod = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Str"));
                    let modToUse = strMod;
                    let statLabel = "STR";
                    let diceType = 1;
                    let displayDmg = "1";

                    if (char.class === "Disciple") {
                      let dexMod = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Dex"));
                      if (dexMod > strMod) {
                        modToUse = dexMod;
                        statLabel = "DEX";
                      }

                      if (char.level >= 10) diceType = 20;
                      else if (char.level >= 8) diceType = 12;
                      else if (char.level >= 6) diceType = 10;
                      else if (char.level >= 4) diceType = 8;
                      else if (char.level >= 2) diceType = 6;
                      else diceType = 4;
                      displayDmg = "1d" + diceType;
                    }
                    if (modToUse < 0) modToUse = 0;

                    let extraDmgLabelUnarmed = "";
                    let extraDiceConfigUnarmed = null;
                    if (char.class === "Justicar" && char.level >= 5) {
                      if (char.level >= 10) {
                        extraDmgLabelUnarmed = ` <span style="color:#a855f7; font-size:0.8rem; margin-left:4px;" title="Ascendency: +2d8 Magic">+ 2d8 Magic</span>`;
                        extraDiceConfigUnarmed = "2,8,Magic";
                      } else {
                        extraDmgLabelUnarmed = ` <span style="color:#a855f7; font-size:0.8rem; margin-left:4px;" title="Celestial Strikes: +1d8 Magic">+ 1d8 Magic</span>`;
                        extraDiceConfigUnarmed = "1,8,Magic";
                      }
                    }

                    let vanguardCritBonus = (char.class === "Vanguard" && char.level >= 10) ? 1 : 0;
                    let unarmedCritBonus = (char.critBonus || 0) + vanguardCritBonus;

                    attacksHtml += `<button class="btn btn-secondary attack-roll-btn" data-slot="unarmed" data-grip="" data-label="Damage: Unarmed Strike" data-count="1" data-type="${diceType}" data-mod="${modToUse}" data-base-crit="0" data-crit-bonus="${unarmedCritBonus}" data-max-crit="1" data-bowmens="0" data-extradice="${extraDiceConfigUnarmed || ''}" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer;" title="Roll ${displayDmg} Bludgeoning ${modToUse >= 0 ? '+'+modToUse : modToUse} (Crit Range: 0)"><span>Unarmed Strike <span style="color:#fff; font-size:0.75rem;">(Body)</span></span><span style="color:var(--amber); display:flex; align-items:center;">${displayDmg} ${modToUse >= 0 ? '+'+modToUse : modToUse} Bludgeoning <span style="font-size:0.7rem; color:#fff; margin-left:4px;">(${statLabel})</span>${extraDmgLabelUnarmed}</span></button>`;

                    if (char.class === "Disciple" && char.level >= 2) {
                      attacksHtml += `<button class="btn btn-secondary attack-roll-btn" data-slot="flowing_combo" data-grip="" data-label="Damage: Flowing Combination" data-count="1" data-type="${diceType}" data-mod="${modToUse}" data-base-crit="0" data-crit-bonus="${unarmedCritBonus}" data-max-crit="1" data-bowmens="0" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer; margin-top:4px;" title="Roll ${displayDmg} Bludgeoning ${modToUse >= 0 ? '+'+modToUse : modToUse} (Crit Range: 0) - Costs a Bonus Action"><span>Flowing Combination <span style="color:#fff; font-size:0.75rem;">(Bonus Action)</span></span><span style="color:var(--amber); display:flex; align-items:center;">${displayDmg} ${modToUse >= 0 ? '+'+modToUse : modToUse} Bludgeoning <span style="font-size:0.7rem; color:#fff; margin-left:4px;">(${statLabel})</span></span></button>`;
                    }
                  }

                  let consumableCounts = {};
                  (char.inventorySlots || []).forEach(slot => {
                    let name = null;
                    let qty = 1;
                    if (typeof slot === "string" && slot) name = slot;
                    else if (slot && typeof slot === "object" && slot.name) {
                      name = slot.name;
                      qty = slot.quantity || 1;
                    }
                    if (name) {
                      consumableCounts[name] = (consumableCounts[name] || 0) + qty;
                    }
                  });

                  Object.keys(consumableCounts).forEach(itemName => {
                    const itemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
                    if (itemData && itemData.slot === "Consumable") {
                      let count, type, damageType;
                      if (itemData.damageDie && itemData.damageType) {
                        let parts = itemData.damageDie.toLowerCase().split('d');
                        if (parts.length === 2) {
                          count = parts[0] || "1";
                          type = parts[1];
                          damageType = itemData.damageType;
                        }
                      } else {
                        let damageMatch = itemData.description ? itemData.description.match(/dealing (\d+)d(\d+) ([a-zA-Z]+) damage/i) : null;
                        if (damageMatch) {
                          count = damageMatch[1];
                          type = damageMatch[2];
                          damageType = damageMatch[3];
                        }
                      }

                      if (count && type && damageType) {
                        let qty = consumableCounts[itemName];
                        
                        let titleStr = `Roll ${count}d${type} (Consumable)`;
                        attacksHtml += `<button class="btn btn-secondary attack-roll-btn" data-slot="consumable" data-grip="" data-label="Damage: ${itemName}" data-count="${count}" data-type="${type}" data-mod="0" data-crit="0" data-bowmens="0" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer;" title="${titleStr}"><span>${itemName} <span style="color:#fff; font-size:0.75rem;">(x${qty})</span></span><span style="color:var(--amber); display:flex; align-items:center;">${count}d${type} ${damageType}</span></button>`;
                      }
                    }
                  });

                  return attacksHtml || `<div style="font-size:0.85rem; color:#fff; text-align:center;">No weapons equipped.</div>`;
                })()}
              </div>
            </div>

            <!-- Dice Roller History -->
            <div class="card col-log glass" style="flex:1; display:flex; flex-direction:row; padding:0; overflow:hidden; margin:0; margin-top:20px; min-height:250px;">
              <div style="flex:1; display:flex; flex-direction:column; padding:15px; overflow:hidden; min-height:0;">
                <div class="log-header" style="margin-bottom:10px; display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; width:100%; justify-content:flex-start;">
                    <h3 style="margin:0; text-align:left; align-self:flex-start;">Roll History</h3>
                  </div>
                  <div style="display:flex; gap:10px; align-items:center; align-self:flex-end; flex-wrap:nowrap; justify-content:flex-end; max-width:100%; overflow-x:auto;">
                    <select id="crit-range-toggle" class="form-control inline-select" style="font-size:0.75rem; padding:2px 4px; height:auto; margin:0; background:rgba(0,0,0,0.8); color:var(--amber); border:1px solid rgba(255,193,7,0.5);">
                      <option value="0">Crit: +0</option>
                      <option value="1">Crit: +1</option>
                      <option value="2">Crit: +2</option>
                      <option value="3">Crit: +3</option>
                      <option value="4">Crit: +4</option>
                      <option value="5">Crit: +5</option>
                      <option value="6">Crit: +6</option>
                      <option value="7">Crit: +7</option>
                      <option value="8">Crit: +8</option>
                      <option value="9">Crit: +9</option>
                      <option value="10">Crit: +10</option>
                    </select>
                    <select id="advantage-toggle" class="form-control inline-select" style="font-size:0.75rem; padding:2px 4px; height:auto; margin:0; background:rgba(0,0,0,0.8); color:var(--amber); border:1px solid rgba(255,193,7,0.5);">
                      <option value="normal">Normal Roll</option>
                      <option value="adv_dice">Advantage Dice</option>
                      <option value="dis_dice">Disadvantage Dice</option>
                      <option value="adv_die">Advantage Die</option>
                      <option value="dis_die">Disadvantage Die</option>
                    </select>
                    <div style="display:flex; align-items:center; gap:4px; font-size:0.75rem;">
                      <span style="color:var(--text-light);" title="Your Inspiration Dice">Insp:</span>
                      <select id="char-inspiration-die-select" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); color:#fff; padding:2px; border-radius:3px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${(!char.inspirationDice || char.inspirationDice.length === 0) ? `<option value="">None</option>` : char.inspirationDice.map(d => `<option value="${d.id}" ${char.useInspirationId === d.id ? 'selected' : ''}>${d.size} (${d.source})</option>`).join('')}
                      </select>
                      <button id="add-insp-btn" style="background:rgba(255,255,255,0.1); color:#fff; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;" title="Add Inspiration Die">+</button>
                      <button id="del-insp-btn" style="background:rgba(255,0,0,0.2); color:#fff; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;" title="Remove Selected Die"><i class="fas fa-trash"></i></button>
                      <button id="use-insp-btn" style="background:${char.useInspirationId ? 'var(--amber)' : 'rgba(255,255,255,0.1)'}; color:${char.useInspirationId ? '#000' : '#fff'}; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;" title="Apply selected to next roll">Use</button>
                    </div>
                  </div>
                </div>
                <!-- Custom Roll Box -->
                <div style="display:flex; gap:5px; margin-bottom:10px; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">
                  <div style="font-size:0.8rem; color:var(--amber); align-self:center; font-weight:bold; width:85px; margin-right:5px;">CUSTOM ROLL</div>
                  <input type="text" id="sheet-custom-dice" class="form-control" placeholder="e.g. 2d6+4" style="flex:1; background:rgba(0,0,0,0.8); color:#fff; border:1px solid rgba(255,193,7,0.5); padding:4px 8px; font-size:0.85rem;">
                  <button class="btn btn-primary btn-xs" id="sheet-custom-roll-btn" style="padding:4px 12px; font-weight:bold;">Roll</button>
                  <button class="btn btn-secondary btn-xs" id="clear-dice-log-btn" style="padding:4px 12px;">Clear</button>
                </div>
                <div class="roll-log-list" id="sheet-roll-log" style="flex:1; overflow-y:auto; padding-right:5px;">
                  <!-- Rendered Dynamically -->
                </div>
              </div>
            </div>


          </div>
        </div>
      `;
    }

    else if (activeTab === "attunement") {
      let spellsListHTML = "";
      char.imbuedSpells = char.imbuedSpells || {};
      const allSpells = char.spells.concat(Object.values(char.imbuedSpells)).concat(char.grantedAbilities || []);

      // Deduplicate to prevent an ability granted multiple ways from showing twice
      const uniqueSpells = [...new Set(allSpells)];

      let scribingSpellsHTML = "";
      if (char.class === "Mage" && char.scribingSpell && char.scribingSpell.spellId) {
        const spell = window.BB_DATABASE.SPELLS.find(s => s.id === char.scribingSpell.spellId);
        if (spell) {
          const progressPercent = Math.min(100, (char.scribingSpell.completedRests / char.scribingSpell.requiredRests) * 100);
          scribingSpellsHTML = `
            <div class="attuned-spell-card glass" style="border: 1px solid var(--mana-blue); margin-bottom: 15px;">
              <div class="card-tag-row">
                <div class="card-tag" style="background: var(--amber)">SCRIBING IN PROGRESS</div>
              </div>
              <h3 class="card-title">${spell.name}</h3>
              <div style="margin-top: 10px; margin-bottom: 5px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                  <span>Study Progress</span>
                  <span>${char.scribingSpell.completedRests} / ${char.scribingSpell.requiredRests} Long Rests</span>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.5); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${progressPercent}%; height: 100%; background: var(--mana-blue); transition: width 0.3s;"></div>
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                <button class="btn btn-danger btn-xs btn-cancel-scribe" style="padding:4px 16px;">Cancel Scribing</button>
              </div>
            </div>
          `;
        }
      }

      if (uniqueSpells.length === 0) {
        spellsListHTML = `<p class="no-spells-text">No attuned spells or abilities. Open the compendium to see your available options.</p>`;
      } else {
        uniqueSpells.forEach(spellId => {
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
          const actionTypeBadge = spell.actionType ? `<div class="card-tag" style="background: ${spell.actionType === 'Spell' ? 'var(--mana-blue)' : 'var(--stamina-gold)'};">${spell.actionType.toUpperCase()}</div>` : '';
          let dynamicDesc = spell.description || "";
          if (spell.id === "abyssal_blast" && char.level) {
            let diceCount = Math.max(1, Math.floor(char.level / 2));
            dynamicDesc = dynamicDesc.replace("1d10", `${diceCount}d10`);
          }
          const tooltipHtml = window.BB_COMPENDIUM && window.BB_COMPENDIUM.generateDetailHTML ? window.BB_COMPENDIUM.generateDetailHTML({ ...spell, description: dynamicDesc, category: 'spell' }).replace(/"/g, '&quot;') : '';

          spellsListHTML += `
            <div class="compendium-card glass" style="position:relative; margin-bottom:12px; display:flex; flex-direction:column;">
              <div class="card-tag-row">${tagBadge}${actionTypeBadge}<div class="card-tag" style="background: ${badgeColor}">${spell.class || 'SPELL'}</div></div>
              <h3 class="card-title info-tooltip-trigger spell-cast-btn" data-html="${tooltipHtml}" data-id="${spellId}" data-cast-type="base" style="cursor: pointer; text-decoration: underline dotted; transition: color 0.2s;" onmouseover="this.style.color='var(--amber)'" onmouseout="this.style.color=''"> ${spell.name}</h3>
              <div class="card-meta" style="margin-bottom:8px;">Attunement: ${window.BB_STATE.getSpellAttunementCost(char, spell)} | Cost: ${spell.cost} | Activation: ${spell.actTime} | Range: ${spell.range} | Components: ${spell.components} | Duration: ${spell.duration}</div>
              <p class="card-description" style="margin-bottom:12px;">${dynamicDesc}</p>
              ${spell.overchargeDesc ? `
                <div class="spell-overcharge glass" style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; font-size:0.85rem; border-left:3px solid ${badgeColor}; margin-bottom:12px;">
                  <strong class="spell-cast-btn info-tooltip-trigger" data-html="<h4>Overcharge</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>Overcharging represents a character pushing their mystical, divine, or innate energies beyond their normal limits. Each spell or ability that can be overcharged will describe exactly how its effects change and the predetermined cost associated with overcharging. You must decide to overcharge at the moment you cast or perform.</p>" data-id="${spellId}" data-cast-type="overcharge" style="color:var(--amber); cursor: pointer; text-decoration: underline dotted;">Overcharge (Cost: ${spell.overchargeCost}):</strong> ${spell.overchargeDesc}
                </div>
              ` : ''}
              ${char.spells.includes(spellId) ? `<button class="btn btn-danger btn-xs btn-unattune" data-id="${spellId}" style="align-self:center; margin-top:auto; padding:4px 16px;">Unattune</button>` :
                (char.grantedAbilities || []).includes(spellId) ? `<div style="text-align:center; margin-top:auto; font-size:0.8rem; color:var(--amber); border: 1px solid var(--amber); border-radius: 4px; padding: 4px;">Class-Granted</div>` :
                `<div style="text-align:center; margin-top:auto; font-size:0.8rem; color:var(--mana-blue); border: 1px solid var(--mana-blue); border-radius: 4px; padding: 4px;">Item-Granted</div>`}
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
        if (spell.class === char.class && !char.spells.includes(spell.id) && !Object.values(char.imbuedSpells || {}).includes(spell.id) && (!char.grantedAbilities || !char.grantedAbilities.includes(spell.id))) {
          let req = window.BB_STATE.getSpellAttunementCost(char, spell);
          let isDisabled = req > availableAttunement;
          attuneOptions += `<option value="${spell.id}" ${isDisabled ? 'disabled' : ''}>
            ${spell.name} (Attunement: ${req}) ${isDisabled ? '- Not enough slots' : ''}
          </option>`;
        }
      });

      // Codex choices (all spells in the game, actionType === 'Spell', excluding Mage spells)
      let codexOptions = "";
      if (char.class === "Mage") {
        let isScribing = char.scribingSpell && char.scribingSpell.spellId;
        window.BB_DATABASE.SPELLS.forEach(spell => {
          let hasManaCost = (spell.cost || "").match(/(\d+)\s*Mana/i);
          if (spell.actionType === 'Spell' && spell.class !== "Mage" && hasManaCost && !char.spells.includes(spell.id) && !Object.values(char.imbuedSpells || {}).includes(spell.id) && (!char.grantedAbilities || !char.grantedAbilities.includes(spell.id))) {
            let req = window.BB_STATE.getSpellAttunementCost(char, spell);
            let isDisabled = req > availableAttunement || isScribing;
            let disableReason = isScribing ? '- Already Scribing' : (req > availableAttunement ? '- Not enough slots' : '');
            codexOptions += `<option value="${spell.id}" ${isDisabled ? 'disabled' : ''}>
              ${spell.name} [${spell.class}] (Attunement: ${req}) ${disableReason}
            </option>`;
          }
        });
      }

      let imbueSectionHTML = "";
      char.imbuedSpells = char.imbuedSpells || {};

      const equipKeys = Object.keys(char.equipment || {});
      equipKeys.forEach(slot => {
        const itemName = char.equipment[slot];
        if (!itemName) return;
        const item = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
        if (item && item.techniqueDesc && item.techniqueDesc.toLowerCase().includes("imbue it into")) {
          const typeMatch = item.techniqueDesc.match(/select (?:a|an|any) ([a-zA-Z]+) (spell|ability)/i);
          const filterType = typeMatch ? typeMatch[1].toLowerCase() : null;

          let slotImbueOptions = `<option value="">Choose Spell/Ability to Imbue</option>`;
          window.BB_DATABASE.SPELLS.forEach(spell => {
            if (spell.class !== char.class) return;
            const requiresOne = item.techniqueDesc.toLowerCase().includes("requires one attunement");
            if (requiresOne && window.BB_STATE.getSpellAttunementCost(char, spell) !== 1) return;
            if (!requiresOne && !window.BB_STATE.getSpellAttunementCost(char, spell)) return; // Must have an attunement cost
            if (filterType) {
                const spellStr = JSON.stringify(spell).toLowerCase();
                if (!spellStr.includes(filterType)) return;
            }
            if (char.spells.includes(spell.id) || Object.values(char.imbuedSpells).includes(spell.id)) return;
            slotImbueOptions += `<option value="${spell.id}">${spell.name}</option>`;
          });

          const currentImbuedId = char.imbuedSpells[slot];
          let currentImbuedText = "None";
          if (currentImbuedId) {
             const imbSpell = window.BB_DATABASE.SPELLS.find(s => s.id === currentImbuedId);
             if (imbSpell) currentImbuedText = imbSpell.name;
          }

          imbueSectionHTML += `
            <div class="spell-attune-panel glass" style="margin-top:15px; border-color:var(--mana-blue);">
              <h4 style="margin-bottom: 8px; color: var(--mana-blue);">${item.name} (Item-Granted)</h4>
              <p style="font-size:0.8rem; margin-bottom:8px; color:var(--text-muted);">${item.techniqueDesc}</p>
              ${currentImbuedId ?
                `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px;">
                   <span><strong>Imbued:</strong> ${currentImbuedText}</span>
                   <button class="btn btn-danger btn-xs btn-unimbue" data-slot="${slot}" style="padding:4px 12px;">Remove</button>
                 </div>` :
                `<div class="attune-controls">
                  <select class="form-control inline-select imbue-selector" id="imbue-selector-${slot}" data-slot="${slot}">
                    ${slotImbueOptions}
                  </select>
                  <button class="btn btn-primary btn-imbue-spell" data-slot="${slot}">Imbue</button>
                </div>`
              }
            </div>
          `;
        }
      });

      return `
        <div style="display:flex; justify-content:center; flex:1; overflow:hidden;">
          <div style="flex:1; max-width:800px; display:flex; flex-direction:column;">
        <div class="spells-tab-view" style="flex:1; overflow-y:auto; padding-right:10px;">
          <div class="spell-attune-panel glass">
            <h4 style="margin-bottom: 12px; color: var(--amber);">Attunement Slots: ${char.attunement.used} / ${char.attunement.total}</h4>
            <label for="spell-attune-selector">Attune New Spell or Ability:</label>
            <div class="attune-controls">
              <select id="spell-attune-selector" class="form-control inline-select info-tooltip-trigger" data-type="spell">
                <option value="">Choose Attunement</option>
                ${attuneOptions}
              </select>
              <button class="btn btn-primary" id="btn-attune-spell">Attune</button>
            </div>
          </div>
          ${char.class === "Mage" ? `
          <div class="spell-attune-panel glass" style="margin-top:15px; border-color:var(--amber);">
            <h4 style="margin-bottom: 12px; color: var(--amber);">Codex</h4>
            <label for="codex-attune-selector">Scribe Spell into Codex:</label>
            <div class="attune-controls">
              <select id="codex-attune-selector" class="form-control inline-select info-tooltip-trigger" data-type="spell">
                <option value="">Choose Spell</option>
                ${codexOptions}
              </select>
              <button class="btn btn-primary" id="btn-codex-attune">Scribe</button>
            </div>
          </div>
          ` : ''}
          ${imbueSectionHTML}

          <div class="attuned-spells-list">
            ${scribingSpellsHTML}
            ${spellsListHTML}
          </div>
        </div>
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

      let numFeats = 5;
      let featsHTML = "";
      for (let i = 0; i < numFeats; i++) {
        let featLevelStr = ((i * 2) + 1).toString();
        let isUnlocked = (char.level >= ((i * 2) + 1));
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
        <div class="talents-tab-view" style="flex:1; display:flex; flex-direction:column; overflow-y:auto; position:relative;">
          <button id="btn-unlock-feats" class="btn btn-secondary" style="position:absolute; top:5px; right:5px; border:1px solid var(--amber); background:rgba(0,0,0,0.8); color:var(--text-light); padding:3px 6px; border-radius:4px; cursor:pointer; font-size:0.9rem; z-index:10;" title="Edit Selections (Unlock)">
            🔓
          </button>
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

          <div class="glass" style="flex:1; margin-top:20px; padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
            <h3 style="margin-top:0; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px; margin-bottom:15px;">Class Features</h3>
            ${featuresHtml}
          </div>
        </div>
      `;
    }
    else if (activeTab === "background") {
      const bg = char.background || {};
      const bgData = window.BB_DATABASE.BACKGROUNDS.find(b => b.name === (bg.name || bg)) || {};
      char.backgroundTraits = char.backgroundTraits || { trait: "", ideal: "", bond: "", flaw: "" };

      const isEditing = isEditingBackground;
      const renderTraitText = (type, val, cat, field, optionsArray = null) => {
        if (!isEditing && !val) return "";
        if (isEditing) {
          if (optionsArray) {
            return `
              <div style="margin-bottom:15px;">
                <strong style="color:var(--text-light); display:block; margin-bottom:4px;">${type}</strong>
                <select class="form-control bg-inline-edit" data-category="${cat}" data-field="${field}" style="width:100%; background:rgba(0,0,0,0.5); border:1px solid rgba(255,193,7,0.3); color:var(--amber); font-style:italic; border-radius:4px; padding:10px; font-family:inherit;">
                  <option value="">-- Select ${type} --</option>
                  ${optionsArray.map(opt => `<option value="${opt.replace(/"/g, '&quot;')}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
              </div>
            `;
          }
          return `
            <div style="margin-bottom:15px;">
              <strong style="color:var(--text-light); display:block; margin-bottom:4px;">${type}</strong>
              <textarea class="form-control bg-inline-edit" data-category="${cat}" data-field="${field}" style="width:100%; min-height:40px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,193,7,0.3); color:var(--amber); font-style:italic; border-radius:4px; padding:10px; font-family:inherit; resize:vertical;">${val || ""}</textarea>
            </div>
          `;
        }
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
        <div class="background-tab-view" style="flex:1; display:flex; flex-direction:column; overflow-y:auto; padding-right:25px; position:relative;">
          <button id="btn-edit-background" class="btn btn-secondary" style="position:absolute; top:15px; right:25px; border:1px solid var(--amber); background:rgba(0,0,0,0.8); color:var(--text-light); padding:3px 8px; border-radius:4px; cursor:pointer; font-size:0.9rem; z-index:10;">
            ${isEditing ? 'Save' : 'Edit'}
          </button>
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
            ${renderTraitText('Faith', char.characterDetails ? char.characterDetails.faith : '', 'characterDetails', 'faith')}
            ${renderTraitText('Trait', char.backgroundTraits.trait, 'backgroundTraits', 'trait', bgData.traits)}
            ${renderTraitText('Ideal', char.backgroundTraits.ideal, 'backgroundTraits', 'ideal', bgData.ideals)}
            ${renderTraitText('Bond', char.backgroundTraits.bond, 'backgroundTraits', 'bond', bgData.bonds)}
            ${renderTraitText('Flaw', char.backgroundTraits.flaw, 'backgroundTraits', 'flaw', bgData.flaws)}
            ${renderTraitText('Lifestyle', char.characterDetails ? char.characterDetails.lifestyle : '', 'characterDetails', 'lifestyle', ["Wretched", "Squalid", "Poor", "Modest", "Comfortable", "Wealthy", "Aristocratic"])}
          </div>

          <div class="glass" style="padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin-top:20px;">
            <h3 style="margin-top:0; margin-bottom:15px; color:var(--text-light);">Physical Characteristics</h3>
            ${renderTraitText('Hair', char.physicalCharacteristics ? char.physicalCharacteristics.hair : '', 'physicalCharacteristics', 'hair')}
            ${renderTraitText('Skin', char.physicalCharacteristics ? char.physicalCharacteristics.skin : '', 'physicalCharacteristics', 'skin')}
            ${renderTraitText('Eyes', char.physicalCharacteristics ? char.physicalCharacteristics.eyes : '', 'physicalCharacteristics', 'eyes')}
            ${renderTraitText('Height', char.physicalCharacteristics ? char.physicalCharacteristics.height : '', 'physicalCharacteristics', 'height')}
            ${renderTraitText('Weight', char.physicalCharacteristics ? char.physicalCharacteristics.weight : '', 'physicalCharacteristics', 'weight')}
            ${renderTraitText('Age', char.physicalCharacteristics ? char.physicalCharacteristics.age : '', 'physicalCharacteristics', 'age')}
            ${renderTraitText('Gender', char.physicalCharacteristics ? char.physicalCharacteristics.gender : '', 'physicalCharacteristics', 'gender')}
          </div>

          <div class="glass" style="padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin-top:20px;">
            <h3 style="margin-top:0; margin-bottom:15px; color:var(--text-light);">Character Story</h3>
            ${renderTraitText('Origins', char.characterStory ? char.characterStory.origins : '', 'characterStory', 'origins')}
            ${renderTraitText('Motivation', char.characterStory ? char.characterStory.motivation : '', 'characterStory', 'motivation')}
            ${renderTraitText('Allies', char.characterStory ? char.characterStory.allies : '', 'characterStory', 'allies')}
            ${renderTraitText('Rivals', char.characterStory ? char.characterStory.rivals : '', 'characterStory', 'rivals')}
            ${renderTraitText('Affiliations', char.characterStory ? char.characterStory.affiliations : '', 'characterStory', 'affiliations')}
            ${renderTraitText('Notes', char.characterStory ? char.characterStory.notes : '', 'characterStory', 'notes')}
          </div>

          <div class="glass" style="padding:15px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin-top:20px;">
            <h3 style="margin-top:0; margin-bottom:15px; color:var(--text-light);">Ancestry Details</h3>
            ${ancestryDetailsHtml || "<p style='color:#fff; font-size:0.95rem;'>No ancestry details found.</p>"}
          </div>
        </div>
      `;
    } else if (activeTab === "notes") {
      return `
        <div class="notes-tab-view" style="flex:1; display:flex; flex-direction:column;">
          <h2 style="margin-top:0; color:var(--amber); border-bottom:1px solid rgba(255,193,7,0.3); padding-bottom:5px;">Character Notes</h2>
          <textarea class="char-notes-input" style="flex:1; width:100%; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light); padding:15px; font-family:inherit; font-size:1rem; resize:vertical;">${char.notes || ""}</textarea>
        </div>
      `;
    }
  }

  function renderEquipSlot(label, val, dbKey, char, pdClass = "") {
    let itemTooltip = "";
    if (val) {
      const dbItems = window.BB_DATABASE.ITEMS || [];
      const miscItems = window.BB_DATABASE.MISC_ITEMS || [];
      let itemData = dbItems.find(x => x.name === val);
      if (itemData) {
        itemData = { ...itemData, category: "item" };
      } else {
        itemData = miscItems.find(x => x.name === val);
        if (itemData) itemData = { ...itemData, category: "misc" };
      }
      if (itemData && window.BB_COMPENDIUM && window.BB_COMPENDIUM.generateDetailHTML) {
        itemTooltip = window.BB_COMPENDIUM.generateDetailHTML(itemData).replace(/"/g, '&quot;');
      }
    }

    // Check if off hand should be disabled due to main hand grip
    let isDisabled = false;
    let disabledReason = "";
    if (label === "Off Hand" && char.equipment && char.equipment.mainHand) {
      const mainHandItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.mainHand);
      if (mainHandItem && ["Double", "Colossal"].includes(mainHandItem.grip)) {
        let isMighty = mainHandItem.grip === "Double" && (!mainHandItem.properties || !mainHandItem.properties.includes("Ranged")) && char.stances && char.stances.includes("Mighty Stance");
        if (!isMighty) {
          isDisabled = true;
          disabledReason = `Disabled by ${mainHandItem.grip} weapon in Main Hand`;
        }
      }
    }

    // Generate options from inventory
    let optionsHtml = `<option value="">-- Empty --</option>`;
    if (Array.isArray(char.inventorySlots)) {
      const invNames = char.inventorySlots.map(slot => {
        if (typeof slot === "object" && slot !== null) return slot.name;
        return slot;
      }).filter(Boolean);

      const uniqueNames = [...new Set(invNames)];
      uniqueNames.sort();

      uniqueNames.forEach(itemName => {
        // Prevent equipping the same single item in multiple slots
        let inventoryCount = 0;
        char.inventorySlots.forEach(slot => {
          if (slot === itemName) inventoryCount++;
          else if (slot && typeof slot === "object" && slot.name === itemName) inventoryCount += slot.quantity || 1;
        });

        let equippedElsewhere = 0;
        if (char.equipment) {
          for (const [key, eqItem] of Object.entries(char.equipment)) {
            if (eqItem === itemName && key !== dbKey) {
              equippedElsewhere++;
            }
          }
        }

        if (inventoryCount > equippedElsewhere || val === itemName) {
          const invItemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
          if (invItemData && (invItemData.slot === label || (invItemData.slot === "Off-hand" && label === "Off Hand") || (invItemData.slot === "Weapon" && (label === "Main Hand" || label === "Off Hand")) || (invItemData.slot === "Shield" && label === "Off Hand"))) {
            
            // Apply Off Hand grip restriction
            if (label === "Off Hand" && invItemData.slot === "Weapon") {
              if (["Single", "Double", "Colossal"].includes(invItemData.grip)) {
                return; // skip this item, it can't be put in the off hand
              }
              // If main hand is Single Grip (or Mighty Stance converted), you cannot equip ANY weapon in the off hand
              const mainHandItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.mainHand);
              if (mainHandItem) {
                let isMighty = mainHandItem.grip === "Double" && (!mainHandItem.properties || !mainHandItem.properties.includes("Ranged")) && char.stances && char.stances.includes("Mighty Stance");
                if (mainHandItem.grip === "Single" || isMighty) {
                  return; // skip all weapons if main hand is Single Grip
                }
              }
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
      <div class="pd-slot ${pdClass} ${itemTooltip ? 'info-tooltip-trigger' : ''}" ${itemTooltip ? `data-html="${itemTooltip}"` : ''}>
        <div class="equip-label">${label}</div>
        <div class="equip-input-wrapper">
          <select class="equip-slot-input" data-key="${dbKey}" ${isDisabled ? `disabled title="${disabledReason}"` : ""} style="position:relative; z-index:2; width:100%; background:rgba(0,0,0,0.8); border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:6px; color:#fff; font-size:0.85rem; text-align:center; margin-bottom:4px; ${isDisabled ? 'opacity:0.5; cursor:not-allowed;' : ''}">
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
    const btnEditBackground = document.getElementById("btn-edit-background");
    if (btnEditBackground) {
      btnEditBackground.addEventListener("click", () => {
        // Harvest any un-blurred changes before switching out of edit mode
        if (isEditingBackground) {
          document.querySelectorAll(".bg-inline-edit").forEach(input => {
            const cat = input.getAttribute("data-category");
            const field = input.getAttribute("data-field");
            if (!char[cat]) char[cat] = {};
            char[cat][field] = input.value;
          });
          window.BB_STATE.saveCharacter(char);
        }
        isEditingBackground = !isEditingBackground;
        render();
      });
    }

    document.querySelectorAll(".bg-inline-edit").forEach(input => {
      input.addEventListener("change", (e) => {
        const cat = e.target.getAttribute("data-category");
        const field = e.target.getAttribute("data-field");
        if (!char[cat]) char[cat] = {};
        char[cat][field] = e.target.value;
        window.BB_STATE.saveCharacter(char);
      });
    });

    // Dropdown active selector
    const selector = document.getElementById("active-char-selector");
    if (selector) {
      selector.addEventListener("change", (e) => {
        window.BB_STATE.setActiveCharacter(e.target.value);
      });
    }
    // Class Resource Trackers
    document.querySelectorAll(".tracker-cb").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const trackerName = e.target.getAttribute("data-tracker");
        const idx = parseInt(e.target.getAttribute("data-index"));
        char.trackers = char.trackers || {};
        if (e.target.checked) {
           char.trackers[trackerName] = Math.max(char.trackers[trackerName] || 0, idx);
        } else {
           char.trackers[trackerName] = idx - 1;
        }
        window.BB_STATE.saveCharacter(char);
        render(); // re-render to update checkbox states properly
      });
    });

    document.querySelectorAll(".tracker-num-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const trackerName = e.target.getAttribute("data-tracker");
        const change = parseInt(e.target.getAttribute("data-change"));
        char.trackers = char.trackers || {};
        let val = char.trackers[trackerName] || 0;
        let oldVal = val;
        val += change;

        const trackerDef = char.availableTrackers.find(t => t.name === trackerName);
        if (trackerDef) {
          val = Math.max(0, Math.min(trackerDef.max, val));
        } else {
          val = Math.max(0, val);
        }

        let actualChange = val - oldVal;
        if (trackerName === "Warp Points" && actualChange < 0 && char.class === "Archon" && char.level >= 3) {
           char.mp.current = Math.min(char.mp.total, (char.mp.current || 0) + (Math.abs(actualChange) * 2));
           window.BB_DICE.showToastNotification(`Feedback: Regained ${Math.abs(actualChange) * 2} MP!`);
        }

        char.trackers[trackerName] = val;
        window.BB_STATE.saveCharacter(char);
        render();
      });
    });

    document.querySelectorAll(".tracker-num-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const trackerName = e.target.getAttribute("data-tracker");
        char.trackers = char.trackers || {};
        let val = parseInt(e.target.value) || 0;
        let oldVal = char.trackers[trackerName] || 0;

        const trackerDef = char.availableTrackers.find(t => t.name === trackerName);
        if (trackerDef) {
          val = Math.max(0, Math.min(trackerDef.max, val));
        } else {
          val = Math.max(0, val);
        }

        let actualChange = val - oldVal;
        if (trackerName === "Warp Points" && actualChange < 0 && char.class === "Archon" && char.level >= 3) {
           char.mp.current = Math.min(char.mp.total, (char.mp.current || 0) + (Math.abs(actualChange) * 2));
           window.BB_DICE.showToastNotification(`Feedback: Regained ${Math.abs(actualChange) * 2} MP!`);
        }

        char.trackers[trackerName] = val;
        window.BB_STATE.saveCharacter(char);
        render();
      });
    });
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
        if (char.trackers) delete char.trackers["Further Beyond Used This Turn"];
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
        
        if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab(); // re-render to update the checkboxes and button opacity
      });
    });

    document.querySelectorAll(".inline-roll-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const label = btn.getAttribute("data-label");
        const rollStr = btn.getAttribute("data-roll");
        if (rollStr) {
          const match = rollStr.match(/(\d+)d(\d+)/);
          if (match) {
            const count = parseInt(match[1]);
            const type = parseInt(match[2]);
            if (label === "Arcane Instability") {
              window.BB_DICE.roll(label, count, type, 0, 0, 0, false, "", 0, "", false, (result) => {
                if (result >= 1 && result <= 3) {
                  setTimeout(() => {
                    window.BB_DICE.roll("Instability Effect", 1, 4, 0, 0, 0, false, "", 0, "", false, (d4Result) => {
                      let effect = "";
                      if (d4Result === 1) effect = "Expanding Blast: Area of effect increases by 5 ft.";
                      else if (d4Result === 2) effect = "Surging Power: Dice increases by 1 or DC by 2.";
                      else if (d4Result === 3) effect = "Elemental Echo: Spell repeats, dealing half damage.";
                      else if (d4Result === 4) effect = "Volatile Amplification: Apply Overcharge/Warp Effect free.";

                      window.BB_DICE.showToastNotification(`Instability Result: ${effect}`);
                    });
                  }, 500); // small delay to let first roll finish clearing or sit before starting next roll
                }
              });
            } else {
              window.BB_DICE.roll(label, count, type, 0, 0, 0, false);
            }
          }
        }
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
        const baseCrit = parseInt(btn.getAttribute("data-base-crit")) || 0;
        const charCritBonus = parseInt(btn.getAttribute("data-crit-bonus")) || 0;
        const maxCritCap = parseInt(btn.getAttribute("data-max-crit")) || 0;
        const bowmens = parseInt(btn.getAttribute("data-bowmens")) || 0;
        
        const critToggle = document.getElementById("crit-range-toggle");
        let dropDownCrit = 0;
        if (critToggle) dropDownCrit = parseInt(critToggle.value) || 0;
        
        let finalCritRange = Math.min(baseCrit + charCritBonus + dropDownCrit, maxCritCap);
        
        if (bowmens > 0) {
          mod += bowmens;
          label += " (+1 Bowmen's Bracers)";
        }
        
        let extraDice = null;
        const extraDiceStr = btn.getAttribute("data-extradice");
        if (extraDiceStr) {
          const parts = extraDiceStr.split(",");
          if (parts.length === 3) {
            extraDice = { count: parseInt(parts[0]), type: parseInt(parts[1]), label: parts[2] };
          }
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

        const ammo = btn.getAttribute("data-ammo");
        if (ammo && !(char.flags && char.flags.trackAmmo === false)) {
          const idx = char.inventorySlots.findIndex(s => {
            if (typeof s === "string") return s === ammo;
            if (s && typeof s === "object") return s.name === ammo;
            return false;
          });
          if (idx > -1) {
            const invSlot = char.inventorySlots[idx];
            if (typeof invSlot === "object" && invSlot.quantity > 1) {
              invSlot.quantity -= 1;
            } else {
              char.inventorySlots[idx] = "";
            }
          } else {
            window.BB_DICE.showToastNotification(`No ${ammo} left!`);
            return;
          }
        }

        window.BB_STATE.saveCharacter(char);
        
        let advDis = 0;
        if (grip === "Colossal") {
          let hasGiantStance = char.stances && char.stances.includes("Giant Stance");
          if (!hasGiantStance) advDis = -2;
        }

        if (slot === "consumable") {
          const itemName = label.replace("Damage: ", "").replace("Improvised ", "");
          const idx = char.inventorySlots.findIndex(s => {
            if (typeof s === "string") return s === itemName;
            if (s && typeof s === "object") return s.name === itemName;
            return false;
          });
          if (idx > -1) {
            const invSlot = char.inventorySlots[idx];
            if (typeof invSlot === "object" && invSlot.quantity > 1) {
              invSlot.quantity -= 1;
            } else {
              char.inventorySlots[idx] = "";
            }
            window.BB_STATE.saveCharacter(char);
            // Delay rendering so the dice roller can find its elements and start smoothly
            setTimeout(() => {
              if (window.BB_APP && window.BB_APP.renderActiveTab) {
                window.BB_APP.renderActiveTab();
              }
            }, 1000);
          }
        }
        
        window.BB_DICE.roll(label, count, type, mod, advDis, finalCritRange, true, grip, 0, "", false, null, extraDice); 
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

    document.querySelectorAll(".btn-berserk").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        char.combatState = char.combatState || { action: false, bonusAction: false, reaction: false, movement: false };
        
        if (char.combatState.bonusAction) {
          window.BB_DICE.showToastNotification("You lack the Bonus Action economy to enter Berserk!");
          return;
        }

        if ((char.trackers["Berserk Charges"] || 0) > 0) {
          char.trackers["Berserk Charges"] -= 1;

          char.combatState.bonusAction = true;
          const cb = document.querySelector('.action-cb[data-action="bonusAction"]');
          if (cb) cb.checked = true;

          let toastMsg = "Entered Berserk Trance!";

          if (char.level >= 6) {
            let dexMod = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Dex")) || 0;
            let spRecover = char.level + dexMod;
            char.sp = char.sp || { current: 0, total: 0, temp: 0 };

            if (char.sp.current < char.sp.total) {
              let missing = char.sp.total - char.sp.current;
              if (spRecover <= missing) {
                char.sp.current += spRecover;
              } else {
                char.sp.current = char.sp.total;
                char.sp.temp = Math.max(char.sp.temp || 0, spRecover - missing);
              }
            } else {
              char.sp.temp = Math.max(char.sp.temp || 0, spRecover);
            }
            toastMsg += `<br>Resurgent Fury: Regained ${spRecover} Stamina!`;
          }

          window.BB_STATE.saveCharacter(char);
          window.BB_DICE.showToastNotification(toastMsg);
          render();
        } else {
          window.BB_DICE.showToastNotification("No Berserk Charges remaining!");
        }
      });
    });

    document.querySelectorAll(".btn-retrograde").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        let currentRetro = char.trackers["In Retrograde"] !== undefined ? char.trackers["In Retrograde"] : 1;
        if (currentRetro <= 0) return;
        
        const recoveryAmount = Math.ceil(char.level / 2);
        const maxCovenant = char.level;

        let currentUses = char.trackers["Covenant Uses"] || 0;
        if (currentUses >= maxCovenant) {
          window.BB_DICE.showToastNotification("Covenant Uses are already at maximum!");
          return;
        }

        let recoverActual = Math.min(maxCovenant - currentUses, recoveryAmount);
        char.trackers["Covenant Uses"] = currentUses + recoverActual;
        char.trackers["In Retrograde"] = 0;
        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`In Retrograde: Recovered ${recoverActual} Covenant Uses.`);
        render();
      });
    });

    document.querySelectorAll(".btn-studious-meditation").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        let currentMed = char.trackers["Studious Meditation"] !== undefined ? char.trackers["Studious Meditation"] : 1;
        if (currentMed <= 0) return;

        const intMod = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Int"));
        const amount = char.level + intMod;

        let currentMp = char.mp ? (parseInt(char.mp.current) || 0) : 0;
        let maxMp = char.mp ? (parseInt(char.mp.total) || 0) : 0;
        let tempMp = char.mp ? (parseInt(char.mp.temp) || 0) : 0;

        if (currentMp >= maxMp) {
          if (!char.mp) char.mp = { current: maxMp, total: maxMp, temp: 0 };
          char.mp.temp = tempMp + amount;
          window.BB_DICE.showToastNotification(`Studious Meditation: Gained ${amount} Temporary MP.`);
        } else {
          let missingMp = maxMp - currentMp;
          let recoverAmount = Math.min(amount, missingMp);
          char.mp.current = currentMp + recoverAmount;
          window.BB_DICE.showToastNotification(`Studious Meditation: Regained ${recoverAmount} MP.`);
        }
        
        char.trackers["Studious Meditation"] = 0;
        window.BB_STATE.saveCharacter(char);
        render();
      });
    });

    document.querySelectorAll(".btn-dark-bargain").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        let currentUses = char.trackers["Dark Bargain Uses"] !== undefined ? char.trackers["Dark Bargain Uses"] : 2;
        if (currentUses <= 0) return;

        if (!char.hp) char.hp = { current: 0, total: 0 };
        let currentHp = parseInt(char.hp.current) || 0;
        let charLevel = parseInt(char.level) || 1;
        
        let targetExchange = charLevel;
        let exchangeAmount = Math.min(targetExchange, currentHp - 1);
        
        if (exchangeAmount <= 0) {
          window.BB_DICE.showToastNotification("Not enough HP to make a Dark Bargain.");
          return;
        }

        char.trackers["Dark Bargain Uses"] = currentUses - 1;
        char.hp.current = currentHp - exchangeAmount;
        
        if (!char.mp) char.mp = { current: 0, total: 0 };
        let currentMp = parseInt(char.mp.current) || 0;
        let maxMp = parseInt(char.mp.total) || 0;
        char.mp.current = Math.min(maxMp, currentMp + exchangeAmount);
        
        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`Dark Bargain: Sacrificed ${exchangeAmount} HP for ${exchangeAmount} MP.`);
        render();
      });
    });

    document.querySelectorAll(".btn-iron-lungs").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        let currentUses = char.trackers["Iron Lungs"] !== undefined ? char.trackers["Iron Lungs"] : 1;
        if (currentUses <= 0) return;
        
        char.trackers["Iron Lungs"] = currentUses - 1;
        
        let dex = window.BB_STATE.getComputedStat(char, "Dex");
        let die = 2;
        if (dex >= 20) die = 20;
        else if (dex >= 12) die = 12;
        else if (dex >= 10) die = 10;
        else if (dex >= 8) die = 8;
        else if (dex >= 6) die = 6;
        else if (dex >= 4) die = 4;
        
        window.BB_DICE.roll("Iron Lungs", 1, die, 0, 0, 0, false, "", 0, "", false, (rollRes) => {
          let recovered = rollRes;
          if (!char.sp) char.sp = { current: 0, total: 0, temp: 0 };
          
          let maxSp = parseInt(char.sp.total) || 0;
          let curSp = parseInt(char.sp.current) || 0;
          let tempSp = parseInt(char.sp.temp) || 0;
          
          if (curSp >= maxSp) {
             char.sp.temp = tempSp + recovered;
             window.BB_DICE.showToastNotification(`Iron Lungs: At max SP, gained ${recovered} Temp SP!`);
          } else {
             let missing = maxSp - curSp;
             let actualRecovered = Math.min(recovered, missing);
             char.sp.current = curSp + actualRecovered;
             let remainder = recovered - actualRecovered;
             if (remainder > 0) {
               char.sp.temp = tempSp + remainder;
               window.BB_DICE.showToastNotification(`Iron Lungs: Recovered ${actualRecovered} SP and gained ${remainder} Temp SP!`);
             } else {
               window.BB_DICE.showToastNotification(`Iron Lungs: Recovered ${actualRecovered} SP!`);
             }
          }
          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
        });
      });
    });

    document.querySelectorAll(".btn-further-beyond").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        char.combatState = char.combatState || { action: false, bonusAction: false, reaction: false, movement: false };
        
        let currentUses = char.trackers["Further Beyond"] !== undefined ? char.trackers["Further Beyond"] : 2;
        if (currentUses <= 0 || char.trackers["Further Beyond Used This Turn"]) return;

        if (!char.combatState.action) {
          window.BB_DICE.showToastNotification("Your action is already full!");
          return;
        }
        
        char.trackers["Further Beyond"] = currentUses - 1;
        char.trackers["Further Beyond Used This Turn"] = true;
        char.combatState.action = false;
        
        window.BB_DICE.showToastNotification("Further Beyond: Regained your Action for this turn!");
        window.BB_STATE.saveCharacter(char);
        if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
      });
    });

    document.querySelectorAll(".btn-exhilaration").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        char.combatState = char.combatState || { action: false, bonusAction: false, reaction: false, movement: false };
        
        let currentUses = char.trackers["Exhilaration"] !== undefined ? char.trackers["Exhilaration"] : 2;
        if (currentUses <= 0) return;

        if (char.combatState.bonusAction) {
          window.BB_DICE.showToastNotification("You lack the Bonus Action economy to use Exhilaration!");
          return;
        }
        
        char.trackers["Exhilaration"] = currentUses - 1;
        char.combatState.bonusAction = true;
        
        let die = 6;
        if (char.level >= 10) die = 20;
        else if (char.level >= 8) die = 12;
        else if (char.level >= 6) die = 10;
        else if (char.level >= 4) die = 8;
        
        let staticBonus = char.level;
        
        window.BB_DICE.roll("Exhilaration", 1, die, staticBonus, 0, 0, false, "", 0, `+${staticBonus} (Vanguard Level)`, false, (rollRes) => {
          let recovered = rollRes;
          if (!char.hp) char.hp = { current: 0, total: 0, temp: 0 };
          
          let maxHp = parseInt(char.hp.total) || 0;
          let curHp = parseInt(char.hp.current) || 0;
          let tempHp = parseInt(char.hp.temp) || 0;
          
          if (curHp >= maxHp) {
             char.hp.temp = tempHp + recovered;
             window.BB_DICE.showToastNotification(`Exhilaration: At max HP, gained ${recovered} Temp HP!`);
          } else {
             let missing = maxHp - curHp;
             let actualRecovered = Math.min(recovered, missing);
             char.hp.current = curHp + actualRecovered;
             let remainder = recovered - actualRecovered;
             if (remainder > 0) {
               char.hp.temp = tempHp + remainder;
               window.BB_DICE.showToastNotification(`Exhilaration: Recovered ${actualRecovered} HP and gained ${remainder} Temp HP!`);
             } else {
               window.BB_DICE.showToastNotification(`Exhilaration: Recovered ${actualRecovered} HP!`);
             }
          }
          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
        });
      });
    });

    document.querySelectorAll(".btn-exhilaration").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        char.combatState = char.combatState || { action: false, bonusAction: false, reaction: false, movement: false };
        
        let currentUses = char.trackers["Exhilaration"] !== undefined ? char.trackers["Exhilaration"] : 2;
        if (currentUses <= 0) return;

        if (char.combatState.bonusAction) {
          window.BB_DICE.showToastNotification("You lack the Bonus Action economy to use Exhilaration!");
          return;
        }
        
        char.trackers["Exhilaration"] = currentUses - 1;
        char.combatState.bonusAction = true;
        
        let die = 6;
        if (char.level >= 10) die = 20;
        else if (char.level >= 8) die = 12;
        else if (char.level >= 6) die = 10;
        else if (char.level >= 4) die = 8;
        
        let staticBonus = char.level;
        
        window.BB_DICE.roll("Exhilaration", 1, die, staticBonus, 0, 0, false, "", 0, `+${staticBonus} (Vanguard Level)`, false, (rollRes) => {
          let recovered = rollRes;
          if (!char.hp) char.hp = { current: 0, total: 0, temp: 0 };
          
          let maxHp = parseInt(char.hp.total) || 0;
          let curHp = parseInt(char.hp.current) || 0;
          let tempHp = parseInt(char.hp.temp) || 0;
          
          if (curHp >= maxHp) {
             char.hp.temp = tempHp + recovered;
             window.BB_DICE.showToastNotification(`Exhilaration: At max HP, gained ${recovered} Temp HP!`);
          } else {
             let missing = maxHp - curHp;
             let actualRecovered = Math.min(recovered, missing);
             char.hp.current = curHp + actualRecovered;
             let remainder = recovered - actualRecovered;
             if (remainder > 0) {
               char.hp.temp = tempHp + remainder;
               window.BB_DICE.showToastNotification(`Exhilaration: Recovered ${actualRecovered} HP and gained ${remainder} Temp HP!`);
             } else {
               window.BB_DICE.showToastNotification(`Exhilaration: Recovered ${actualRecovered} HP!`);
             }
          }
          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
        });
      });
    });

    document.querySelectorAll(".vanguard-stance-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        let index = parseInt(e.target.getAttribute("data-index"));
        char.stances = char.stances || [];
        char.stances[index] = e.target.value;
        
        if (char.equipment && char.equipment.mainHand && char.equipment.offHand) {
          const mainHandItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.mainHand);
          if (mainHandItem && ["Single", "Double", "Colossal"].includes(mainHandItem.grip)) {
            let forceUnequip = false;
            if (["Double", "Colossal"].includes(mainHandItem.grip)) {
              forceUnequip = true;
              let isMighty = mainHandItem.grip === "Double" && (!mainHandItem.properties || !mainHandItem.properties.includes("Ranged")) && char.stances.includes("Mighty Stance");
              if (isMighty) {
                forceUnequip = false;
                const offHandItemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.offHand);
                if (offHandItemData && offHandItemData.slot === "Weapon") {
                  forceUnequip = true;
                }
              }
            } else if (mainHandItem.grip === "Single") {
              const offHandItemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.offHand);
              if (offHandItemData && offHandItemData.slot === "Weapon") {
                forceUnequip = true;
              }
            }
            if (forceUnequip) {
              char.equipment.offHand = "";
              if (char.imbuedSpells && char.imbuedSpells.offHand) {
                delete char.imbuedSpells.offHand;
              }
            }
          }
        }

        window.BB_STATE.saveCharacter(char);
        render();
      });
    });

    document.querySelectorAll(".btn-archmage").forEach(btn => {
      btn.addEventListener("click", () => {
        char.trackers = char.trackers || {};
        let uses = char.trackers["archmageUses"] || 0;
        let costStr = uses === 0 ? "for Free" : `for ${Math.pow(2, uses)}x MP Cost`;

        char.trackers["archmageUses"] = uses + 1;
        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`Archmage: The next damage spell is maximized ${costStr}!`);
        render();
      });
    });


      // Dead btn-long-rest code removed



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
        if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
      });
    }

    // Inspiration Dice Listeners
    const addInspBtn = document.getElementById("add-insp-btn");
    const delInspBtn = document.getElementById("del-insp-btn");
    const useInspBtn = document.getElementById("use-insp-btn");
    const inspSelect = document.getElementById("char-inspiration-die-select");
    const addInspModal = document.getElementById("add-insp-modal");
    const addInspCancel = document.getElementById("add-insp-cancel");
    const addInspConfirm = document.getElementById("add-insp-confirm");
    const addInspSize = document.getElementById("add-insp-size");
    const addInspSource = document.getElementById("add-insp-source");

    if (inspSelect) {
      inspSelect.addEventListener("change", (e) => {
        // If they change the selection, turn off 'use' so it doesn't accidentally trigger with wrong die
        if (char.useInspirationId) {
          char.useInspirationId = null;
          window.BB_STATE.saveCharacter(char);
          render();
        }
      });
    }

    if (useInspBtn && inspSelect) {
      useInspBtn.addEventListener("click", () => {
        const selectedId = inspSelect.value;
        if (!selectedId) return;
        
        if (char.useInspirationId === selectedId) {
          char.useInspirationId = null; // Toggle off
        } else {
          char.useInspirationId = selectedId; // Toggle on
        }
        window.BB_STATE.saveCharacter(char);
        render();
      });
    }

    if (delInspBtn && inspSelect) {
      delInspBtn.addEventListener("click", () => {
        const selectedId = inspSelect.value;
        if (!selectedId) return;
        
        if (!char.inspirationDice) char.inspirationDice = [];
        char.inspirationDice = char.inspirationDice.filter(d => d.id !== selectedId);
        if (char.useInspirationId === selectedId) char.useInspirationId = null;
        
        window.BB_STATE.saveCharacter(char);
        render();
      });
    }

    if (addInspBtn) {
      addInspBtn.addEventListener("click", () => {
        addInspSize.value = "d6";
        addInspSource.value = "General";
        addInspModal.style.display = "flex";
      });
    }

    if (addInspCancel) {
      addInspCancel.addEventListener("click", () => {
        addInspModal.style.display = "none";
      });
    }

    if (addInspConfirm) {
      addInspConfirm.addEventListener("click", () => {
        const size = addInspSize.value;
        let source = addInspSource.value.trim() || "General";
        
        // Enforce Inspiring Performer Rule
        if (source.toLowerCase() === "inspiring performer") {
          source = "Inspiring Performer"; // Normalize capitalization
          const hasIP = (char.inspirationDice || []).find(d => d.source === "Inspiring Performer");
          if (hasIP) {
            window.BB_DICE.showToastNotification("You can only have one Inspiration Die from Inspiring Performer at a time.");
            return;
          }
        }

        if (!char.inspirationDice) char.inspirationDice = [];
        const uuid = 'insp-' + Math.random().toString(36).substr(2, 9);
        char.inspirationDice.push({ id: uuid, size, source });
        
        addInspModal.style.display = "none";
        window.BB_STATE.saveCharacter(char);
        render();
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
      if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
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

        let advMode = hasAdvantage ? 1 : 0;
        if (window.BB_DICE && window.BB_DICE.roll) {
           window.BB_DICE.roll("Fortune Roll", 1, 100, lckMod, advMode, 0, false);
        }
      });
    }

    const rollDeathSaveBtn = document.querySelector(".roll-death-save-btn");
    if (rollDeathSaveBtn) {
      rollDeathSaveBtn.addEventListener("click", () => {
        if (!char.deathSaves) char.deathSaves = { successes: 0, failures: 0 };

        if (char.class === "Vanguard" && char.level >= 10 && char.deathSaves.successes === 0 && char.deathSaves.failures === 0) {
          char.deathSaves.successes = 1;
          window.BB_DICE.showToastNotification("Defiance of Death: Automatic Death Save Success!");
          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
          return;
        }

        const evaluateRoll = (roll, isReroll = false) => {
          let message = `Rolled a ${roll} for Death Saving Throw. `;

          if (!isReroll && roll <= 9) {
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
              window.BB_DICE.showToastNotification("The Skull Band shatters to bone dust, granting a reroll!");

              setTimeout(() => {
                window.BB_DICE.roll("Death Save Reroll (Skull Band)", 1, 20, 0, 0, 0, false, "", 0, "", false, (newRoll) => {
                  evaluateRoll(newRoll, true);
                });
              }, 100);
              return;
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

          window.BB_DICE.showToastNotification(message);
          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
        };

        if (window.BB_DICE && window.BB_DICE.roll) {
          window.BB_DICE.roll("Death Saving Throw", 1, 20, 0, 0, 0, false, "", 0, "", false, (roll) => {
            evaluateRoll(roll);
          });
        }
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
        if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
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

    // Conditions Flyout Logic
    const openConditionsBtn = document.getElementById("open-conditions-btn");
    const conditionsFlyout = document.getElementById("conditions-flyout");

    const updateConditionBadges = () => {
      const container = document.getElementById("active-conditions-container");
      if (!container) return;
      let badges = "";
      const allConditions = Object.keys(window.BB_DATABASE.CONDITIONS).filter(c => c !== "Exhaustion");
      allConditions.forEach(c => {
        if (char.conditions[c]) {
          const styleInfo = window.getConditionIcon ? window.getConditionIcon(c) : { icon: "fa-skull", color: "#fff" };
          badges += `<i class="fas ${styleInfo.icon} info-tooltip-trigger" data-type="condition" data-name="${c}" style="color:${styleInfo.color}; font-size:1rem; margin-left:6px; cursor:help;" title="${c}"></i>`;
        }
      });
      if (char.conditions.exhaustion > 0) {
        badges += `<i class="fas fa-lungs-virus info-tooltip-trigger" data-type="condition" data-name="Exhaustion" style="color:#EF4444; font-size:1rem; margin-left:6px; cursor:help;" title="Exhaustion"></i><strong style="color:#EF4444; font-size:0.75rem; margin-left:2px;">${char.conditions.exhaustion}</strong>`;
      }
      container.innerHTML = badges || '<span style="color:#aaa; font-size:0.7rem; font-style:italic;">No active conditions</span>';
    };

    if (openConditionsBtn && conditionsFlyout) {
      openConditionsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        isConditionsFlyoutOpen = !isConditionsFlyoutOpen;
        conditionsFlyout.style.display = isConditionsFlyoutOpen ? "flex" : "none";
      });

      const closeConditionsBtn = document.getElementById("close-conditions-btn");
      if (closeConditionsBtn) {
        closeConditionsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          isConditionsFlyoutOpen = false;
          conditionsFlyout.style.display = "none";
        });
      }

      conditionsFlyout.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    document.querySelectorAll(".condition-toggle-cb").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const cond = e.target.getAttribute("data-condition");
        char.conditions[cond] = e.target.checked;
        window.BB_STATE.saveCharacter(char);
        updateConditionBadges();
      });
    });

    document.querySelectorAll(".exhaustion-level-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const level = parseInt(e.target.getAttribute("data-level"));
        char.conditions.exhaustion = level;
        window.BB_STATE.saveCharacter(char);
        updateConditionBadges();
        
        // Update button visual state
        document.querySelectorAll(".exhaustion-level-btn").forEach(b => {
          const l = parseInt(b.getAttribute("data-level"));
          if (l === 0) {
            b.classList.toggle("active", level === 0);
          } else {
            b.classList.toggle("active", level >= l);
          }
        });
        const exText = conditionsFlyout.querySelector(".exhaustion-tracker span:last-child");
        if (exText) exText.textContent = `Level ${level}`;
      });
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
        let val = parseInt(e.target.value) || 10;
        if (val > 30) val = 30;
        char.stats[stat] = val;
        window.BB_STATE.saveCharacter(char);
        render(); // Full re-render to update dependent mods & skills
      });
    });

    document.querySelectorAll(".btn-add-stat").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const stat = btn.getAttribute("data-stat");
        if ((char.stats[stat] || 10) >= 30) {
          window.BB_DICE.showToastNotification("Attributes cannot exceed 30!");
          return;
        }
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
    const doInitiativeRoll = (useBattleMeditation) => {
      let effectiveLck = (char.stats && char.stats.Lck !== undefined) ? char.stats.Lck : 10;
      if (char.equipment && char.equipment.hands === "Caspian Clutches" && effectiveLck < 18) effectiveLck = 18;
      let luckMod = window.BB_STATE.getModifier(effectiveLck) || 0;

      let extraModifier = 0;
      let extraBreakdown = "";

      if (char.equipment && char.equipment.feet === "Quick Steppers") {
        extraModifier += 2;
        extraBreakdown += "+2 (Quick Steppers) ";
      }

      // Alacrity Talent Bonus (1d4)
      if (char.talents && Array.isArray(char.talents) && char.talents.includes("Alacrity")) {
        const d4Roll = Math.floor(Math.random() * 4) + 1;
        extraModifier += d4Roll;
        extraBreakdown += `+${d4Roll} (Alacrity) `;
        window.BB_DICE.showToastNotification(`Alacrity Talent: +${d4Roll} to Initiative!`);
      }
      let initAdvantage = (char.equipment && Object.values(char.equipment).includes("Moxie Loop")) ? 1 : 0;

      // Berserker Level 8: Combat Instinct
      if (char.class === "Berserker" && char.level >= 8) {
        initAdvantage = 1;
        if (char.trackers && char.trackers["Berserk Charges"] !== undefined) {
          const maxBerserk = Math.floor(char.level / 2) + 1;
          if (char.trackers["Berserk Charges"] < maxBerserk) {
            char.trackers["Berserk Charges"] += 1;
            window.BB_STATE.saveCharacter(char);
            if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
            window.BB_DICE.showToastNotification("Combat Instinct: Regained 1 Berserk Charge!");
          }
        }
        
        let wantsToBerserk = window.confirm("Combat Instinct: Would you like to enter a Berserk state for free?");
        if (wantsToBerserk) {
          let toastMsg = "Entered Berserk Trance (Combat Instinct)!";
          let dexMod = window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Dex")) || 0;
          let spRecover = char.level + dexMod;
          char.sp = char.sp || { current: 0, total: 0, temp: 0 };

          if (char.sp.current < char.sp.total) {
            let missing = char.sp.total - char.sp.current;
            if (spRecover <= missing) {
              char.sp.current += spRecover;
            } else {
              char.sp.current = char.sp.total;
              char.sp.temp = Math.max(char.sp.temp || 0, spRecover - missing);
            }
          } else {
            char.sp.temp = Math.max(char.sp.temp || 0, spRecover);
          }
          toastMsg += `<br>Resurgent Fury: Regained ${spRecover} Stamina!`;
          window.BB_DICE.showToastNotification(toastMsg);
          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
        }
      }

      // Disciple Level 5: Battle Meditation
      if (useBattleMeditation && char.class === "Disciple" && char.level >= 5) {
        if (char.trackers && char.trackers["Battle Meditation Uses"] > 0) {
          char.trackers["Battle Meditation Uses"] -= 1;
          let diceType = 4;
          if (char.level >= 10) diceType = 20;
          else if (char.level >= 8) diceType = 12;
          else if (char.level >= 6) diceType = 10;
          else if (char.level >= 4) diceType = 8;
          else if (char.level >= 2) diceType = 6;

          let rollVal = Math.floor(Math.random() * diceType) + 1;
          let currentAP = char.trackers["Anima Points"] || 0;
          let maxAP = char.level * 2;
          char.trackers["Anima Points"] = Math.min(maxAP, currentAP + rollVal);

          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) window.BB_APP.renderActiveTab();
          window.BB_DICE.showToastNotification(`Battle Meditation: Rolled 1d${diceType} for ${rollVal} AP!`);

          // Push to dice log for visibility
          let logEntry = {
            timestamp: new Date().toISOString(),
            characterId: char.id,
            characterName: char.name,
            rollType: "Battle Meditation",
            total: rollVal,
            breakdown: `[1d${diceType}]`,
            isCrit: false,
            isFail: false
          };
          let currentLog = window.BB_STATE.getDiceLog();
          currentLog.unshift(logEntry);
          if (currentLog.length > 50) currentLog.pop();
          window.BB_STATE.publish('dice_log_changed');
        }
      }

      window.BB_DICE.roll('Initiative', 1, 20, luckMod, initAdvantage, 0, false, "", extraModifier, extraBreakdown.trim());
    };

    const btnInit = document.getElementById("btn-roll-initiative");
    if (btnInit) {
      btnInit.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        doInitiativeRoll(false);
      });
    }
    const btnBattleMed = document.getElementById("btn-battle-meditation");
    if (btnBattleMed) {
      btnBattleMed.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        doInitiativeRoll(true);
      });
    }

    const trackAmmoCb = document.getElementById("track-ammo-cb");
    if (trackAmmoCb) {
      trackAmmoCb.addEventListener("change", (e) => {
        if (!char.flags) char.flags = {};
        char.flags.trackAmmo = e.target.checked;
        window.BB_STATE.saveCharacter(char);
      });
    }

    // Tab buttons
    document.querySelectorAll(".sheet-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-tab");
        localStorage.setItem("bb_sheet_tab", activeTab);
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
            let temp = char[pool].temp || 0;
            
            if (char[pool].current + temp < totalCost) {
              if (window.BB_DICE && window.BB_DICE.showToastNotification) {
                window.BB_DICE.showToastNotification(`Out of ${poolName}!`);
              }
              return;
            }
            
            if (temp >= totalCost) {
              char[pool].temp -= totalCost;
            } else {
              let remainingCost = totalCost - temp;
              char[pool].temp = 0;
              char[pool].current = Math.max(0, char[pool].current - remainingCost);
            }
            
            window.BB_STATE.saveCharacter(char);
            if (window.BB_DICE && window.BB_DICE.showToastNotification) {
              let verb = spell.actionType === 'Ability' ? 'Performed' : 'Cast';
              window.BB_DICE.showToastNotification(`${verb} ${spell.name}${castType === 'overcharge' ? ' (Overcharged)' : ''}! Used ${totalCost} ${poolName}.`);
            }
            render();
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
        
        // Ogre Ancestry (Advantage Die on Diplomacy)
        if (name === "Diplomacy" && char.race === "Ogre") {
          advantageMode = 2; // Advantage Die
        }
        
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
        if (name === "Sleight of Hand" && char.equipment && char.equipment.hands === "Pickpocket's Pincers") {
          advantageMode = 2; // Advantage Die
        }

        // Myrlock's Monocle (Advantage Die on Investigation)
        if (name === "Investigation" && char.equipment && char.equipment.head === "Myrlock's Monocle") {
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
              const itemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
              if (itemData && itemData.sneakPenalty) {
                if (itemData.sneakPenalty.toLowerCase().includes("disadvantage")) {
                  advantageMode = -1;
                }
              }
            }
          });
        }
        
        window.BB_DICE.roll(`${name}`, 1, 20, mod, advantageMode, 0, false);
      });
    });



    // Equipment inputs changes
    document.querySelectorAll(".equip-slot-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const key = input.getAttribute("data-key");
        char.equipment[key] = e.target.value;

        // Clear imbued spell if equipment changes
        if (char.imbuedSpells && char.imbuedSpells[key]) {
          delete char.imbuedSpells[key];
        }

        // Automatically unequip offhand if equipping a 2-handed weapon or invalid Single Grip combo
        if (key === "mainHand" && char.equipment.mainHand && char.equipment.offHand) {
          const mainHandItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.mainHand);
          if (mainHandItem && ["Single", "Double", "Colossal"].includes(mainHandItem.grip)) {
            let forceUnequip = false;
            if (["Double", "Colossal"].includes(mainHandItem.grip)) {
              forceUnequip = true;
              let isMighty = mainHandItem.grip === "Double" && (!mainHandItem.properties || !mainHandItem.properties.includes("Ranged")) && char.stances && char.stances.includes("Mighty Stance");
              if (isMighty) {
                forceUnequip = false;
                const offHandItemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.offHand);
                if (offHandItemData && offHandItemData.slot === "Weapon") {
                  forceUnequip = true;
                }
              }
            } else if (mainHandItem.grip === "Single") {
              const offHandItemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.offHand);
              if (offHandItemData && offHandItemData.slot === "Weapon") {
                forceUnequip = true;
              }
            }
            if (forceUnequip) {
              char.equipment.offHand = "";
              if (char.imbuedSpells && char.imbuedSpells.offHand) {
                delete char.imbuedSpells.offHand;
              }
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
          if (char.attunement.used + window.BB_STATE.getSpellAttunementCost(char, spellData) > char.attunement.total) {
            window.BB_DICE.showToastNotification("Not enough attunement slots available!");
            return;
          }
          if (!char.spells) char.spells = [];
          char.spells.push(spellId);
          char.attunement.used += window.BB_STATE.getSpellAttunementCost(char, spellData);
          window.BB_STATE.saveCharacter(char);
          window.BB_DICE.showToastNotification(`Attuned to ${spellData.name}.`);
          render();
        }
      });
    }

    // Codex scribe trigger
    const btnCodexAttune = document.getElementById("btn-codex-attune");
    const codexSelector = document.getElementById("codex-attune-selector");
    if (btnCodexAttune && codexSelector) {
      btnCodexAttune.addEventListener("click", () => {
        const spellId = codexSelector.value;
        if (!spellId) return;

        if (char.scribingSpell && char.scribingSpell.spellId) {
          if (window.BB_DICE && window.BB_DICE.showToastNotification) {
            window.BB_DICE.showToastNotification("Already scribing a spell! Cancel current scribing first.");
          }
          return;
        }

        const spellData = window.BB_DATABASE.SPELLS.find(s => s.id === spellId);
        if (spellData) {
          if (char.attunement.used + window.BB_STATE.getSpellAttunementCost(char, spellData) > char.attunement.total) {
            if (window.BB_DICE && window.BB_DICE.showToastNotification) {
              window.BB_DICE.showToastNotification("Not enough attunement slots available!");
            }
            return;
          }

          let match = (spellData.cost || "").match(/(\d+)\s*Mana/i);
          if (!match) return; // Should not happen due to dropdown filter

          char.scribingSpell = {
            spellId: spellId,
            requiredRests: parseInt(match[1]),
            completedRests: 0,
            slotCost: window.BB_STATE.getSpellAttunementCost(char, spellData)
          };

          char.attunement.used += window.BB_STATE.getSpellAttunementCost(char, spellData);
          window.BB_STATE.saveCharacter(char);
          
          if (window.BB_DICE && window.BB_DICE.showToastNotification) {
            window.BB_DICE.showToastNotification(`Began scribing ${spellData.name} into your Codex.`);
          }
          render();
        }
      });
    }

    const btnCancelScribe = document.querySelector(".btn-cancel-scribe");
    if (btnCancelScribe) {
      btnCancelScribe.addEventListener("click", () => {
        if (char.scribingSpell) {
          char.attunement.used = Math.max(0, char.attunement.used - (char.scribingSpell.slotCost || 0));
          delete char.scribingSpell;
          window.BB_STATE.saveCharacter(char);
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
          char.attunement.used = Math.max(0, char.attunement.used - window.BB_STATE.getSpellAttunementCost(char, spellData));
          window.BB_STATE.saveCharacter(char);
          window.BB_DICE.showToastNotification(`Unattuned from ${spellData.name}.`);
          render();
        }
      });
    });

    // Imbue spell triggers
    document.querySelectorAll(".btn-imbue-spell").forEach(btn => {
      btn.addEventListener("click", () => {
        const slot = btn.getAttribute("data-slot");
        const selector = document.getElementById(`imbue-selector-${slot}`);
        if (!selector || !selector.value) return;
        char.imbuedSpells = char.imbuedSpells || {};
        char.imbuedSpells[slot] = selector.value;
        const spellData = window.BB_DATABASE.SPELLS.find(s => s.id === selector.value);
        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`Imbued ${spellData ? spellData.name : 'spell'}.`);
        render();
      });
    });

    // Unimbue spell triggers
    document.querySelectorAll(".btn-unimbue").forEach(btn => {
      btn.addEventListener("click", () => {
        const slot = btn.getAttribute("data-slot");
        if (char.imbuedSpells && char.imbuedSpells[slot]) {
          const spellData = window.BB_DATABASE.SPELLS.find(s => s.id === char.imbuedSpells[slot]);
          delete char.imbuedSpells[slot];
          window.BB_STATE.saveCharacter(char);
          window.BB_DICE.showToastNotification(`Removed imbued ${spellData ? spellData.name : 'spell'}.`);
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
        
        const matchedItems = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).filter(item => 
          item.name.toLowerCase().includes(query) ||
          (item.slot && item.slot.toLowerCase().includes(query)) ||
          (item.type && item.type.toLowerCase().includes(query))
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
            
            const itemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === item.name);
            const isStackable = (window.BB_DATABASE && window.BB_DATABASE.STACKABLE_ITEMS && window.BB_DATABASE.STACKABLE_ITEMS.includes(item.name)) || (itemData && itemData.type === "Medicine");
            let handled = false;

            if (isStackable) {
              const existingStackIdx = char.inventorySlots.findIndex(slot => slot && typeof slot === "object" && slot.name === item.name);
              if (existingStackIdx !== -1) {
                char.inventorySlots[existingStackIdx].quantity = (char.inventorySlots[existingStackIdx].quantity || 1) + 1;
                handled = true;
              }
            }

            if (!handled) {
              const emptyIdx = char.inventorySlots.findIndex(slot => slot === "");
              if (emptyIdx !== -1) {
                if (isStackable) {
                  char.inventorySlots[emptyIdx] = { name: item.name, quantity: 1 };
                } else {
                  char.inventorySlots[emptyIdx] = item.name;
                }
                handled = true;
              } else {
                if (window.BB_DICE && window.BB_DICE.showToastNotification) {
                  window.BB_DICE.showToastNotification("Inventory is full!");
                }
              }
            }

            if (handled) {
              window.BB_STATE.saveCharacter(char);
              render();
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
        const slot = char.inventorySlots && char.inventorySlots[idx];
        if (slot) {
          let deletedItemName = typeof slot === "object" ? slot.name : slot;
          if (typeof slot === "object" && slot.quantity > 1) {
            slot.quantity -= 1;
          } else {
            char.inventorySlots[idx] = "";
            let count = 0;
            char.inventorySlots.forEach(s => {
              if (s === deletedItemName) count++;
              else if (s && typeof s === "object" && s.name === deletedItemName) count += s.quantity;
            });
            if (count === 0) {
              for (let key in char.equipment) {
                if (char.equipment[key] === deletedItemName) {
                  char.equipment[key] = "";
                }
              }
            }
          }
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
          const slot = char.inventorySlots[draggedSlotIndex];
          let deletedItemName = typeof slot === "object" ? slot.name : slot;
          char.inventorySlots[draggedSlotIndex] = "";
          
          let count = 0;
          char.inventorySlots.forEach(s => {
            if (s === deletedItemName) count++;
            else if (s && typeof s === "object" && s.name === deletedItemName) count += s.quantity;
          });
          if (count === 0) {
            for (let key in char.equipment) {
              if (char.equipment[key] === deletedItemName) {
                char.equipment[key] = "";
              }
            }
          }
          
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

    const customRollBtn = document.getElementById("sheet-custom-roll-btn");
    const customRollInput = document.getElementById("sheet-custom-dice");
    if (customRollBtn && customRollInput) {
      customRollBtn.addEventListener("click", () => {
        const input = customRollInput.value;
        if (!input) return;

        const cleaned = input.replace(/,/g, '+').replace(/\s+/g, '');
        const terms = cleaned.match(/[+-]?[^+-]+/g);

        if (!terms) {
          if(window.BB_DICE) window.BB_DICE.showToastNotification("Invalid format.");
          return;
        }

        let diceList = [];
        let totalMod = 0;
        let isValid = true;

        for (let term of terms) {
          const sign = term.startsWith('-') ? -1 : 1;
          const val = term.replace(/[+-]/, '');

          const lVal = val.toLowerCase();
          const attrMap = {
            "str": "Str", "strength": "Str",
            "dex": "Dex", "dexterity": "Dex",
            "con": "Con", "constitution": "Con",
            "int": "Int", "intelligence": "Int",
            "wis": "Wis", "wisdom": "Wis",
            "cha": "Cha", "charisma": "Cha",
            "lck": "Lck", "luck": "Lck"
          };

          if (attrMap[lVal]) {
            const char = window.BB_STATE && window.BB_STATE.getActiveCharacter ? window.BB_STATE.getActiveCharacter() : null;
            if (char) {
              let statVal = window.BB_STATE.getComputedStat(char, attrMap[lVal]);
              let modVal = window.BB_STATE.getModifier(statVal);
              totalMod += modVal * sign;
            } else {
              isValid = false;
            }
          } else if (val.includes('d') || val.includes('D')) {
            const parts = val.toLowerCase().split('d');
            const count = parts[0] === "" ? 1 : parseInt(parts[0]);
            const type = parseInt(parts[1]);
            if (!isNaN(type) && !isNaN(count)) {
              diceList.push({ count, type, sign });
            } else {
              isValid = false;
            }
          } else {
            const modVal = parseInt(val);
            if (!isNaN(modVal)) {
              totalMod += modVal * sign;
            } else {
              isValid = false;
            }
          }
        }

        if (isValid && diceList.length > 0) {
          const critToggle = document.getElementById("crit-range-toggle");
          let dropDownCrit = 0;
          if (critToggle) dropDownCrit = parseInt(critToggle.value) || 0;

          if (diceList.length === 1 && diceList[0].sign === 1) {
            const first = diceList[0];
            window.BB_DICE.roll(`Custom (${input})`, first.count, first.type, totalMod, 0, dropDownCrit, true);
          } else if (window.BB_DICE.rollMixed) {
            window.BB_DICE.rollMixed(`Custom (${input})`, diceList, totalMod);
          } else {
            const first = diceList[0];
            window.BB_DICE.roll(`Custom (${input})`, first.count, first.type, totalMod, 0, dropDownCrit, true);
          }
          setTimeout(() => { if(typeof renderRollLog === "function") renderRollLog(); }, 100);
        } else {
          if(window.BB_DICE) window.BB_DICE.showToastNotification("Invalid format. Use XdY+Z (e.g., 1d4 + 1d6 + 2)");
        }
      });
      customRollInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") customRollBtn.click();
      });
    }

    const btnShortRest = document.getElementById("btn-short-rest");
    if (btnShortRest) {
      btnShortRest.addEventListener("click", () => {
        if (!char.combatState) char.combatState = {};
        char.combatState.action = false;
        char.combatState.bonusAction = false;
        char.combatState.reaction = false;
        char.combatState.movement = false;
        if (char.trackers) delete char.trackers["Further Beyond Used This Turn"];
        
        if (char.availableTrackers) {
          char.trackers = char.trackers || {};
          char.availableTrackers.forEach(t => {
            if (t.shortRestRecover) {
              let amount = 0;
              let srrStr = String(t.shortRestRecover).toLowerCase();
              
              if (srrStr.includes("level")) {
                try {
                  let evalRes = eval(srrStr.replace(/level/g, char.level));
                  if (!evalRes) return;
                  srrStr = String(evalRes).toLowerCase();
                } catch(e) {}
              }

              if (srrStr === "half_up") {
                amount = Math.ceil(t.max / 2);
              } else if (srrStr === "half_down") {
                amount = Math.floor(t.max / 2);
              } else if (srrStr === "full" || srrStr === "all") {
                amount = t.max;
              } else if (srrStr === "one") {
                amount = 1;
              } else {
                amount = parseInt(srrStr) || 0;
              }
              
              if (amount > 0) {
                char.trackers[t.name] = Math.min(t.max, (char.trackers[t.name] || 0) + amount);
              }
            }
          });
        }

        // Indomitable Spirit Logic
        const raceData = window.BB_DATABASE.SPECIES.find(r => r.name === char.race);
        const hasIndomitableSpirit = raceData && raceData.ancestralFeat && raceData.ancestralFeat.name === "Indomitable Spirit";
        if (hasIndomitableSpirit) {
          if (!char.inspirationDice) char.inspirationDice = [];
          const indomDie = char.inspirationDice.find(d => d.source === "Indomitable Spirit");
          if (!indomDie) {
            char.inspirationDice.push({ id: 'insp-' + Math.random().toString(36).substr(2, 9), size: "d4", source: "Indomitable Spirit" });
          } else {
            const steps = ["d4", "d6", "d8", "d10", "d12", "d20"];
            let currentStep = steps.indexOf(indomDie.size);
            if (currentStep !== -1 && currentStep < steps.length - 1) {
              indomDie.size = steps[currentStep + 1];
            }
          }
        }
        // Codex Scribing Progress (Short Rest, Fast Learner)
        // Codex Scribing Progress (Short Rest, Fast Learner)
        if (char.class === "Mage" && char.level >= 7 && char.scribingSpell && char.scribingSpell.spellId) {
          char.scribingSpell.completedRests = (parseInt(char.scribingSpell.completedRests) || 0) + 1;
          if (char.scribingSpell.completedRests >= char.scribingSpell.requiredRests) {
            if (!char.spells) char.spells = [];
            char.spells.push(char.scribingSpell.spellId);
            const scribedSpellName = window.BB_DATABASE.SPELLS.find(s => s.id === char.scribingSpell.spellId)?.name || "Spell";
            delete char.scribingSpell;
            if (window.BB_DICE && window.BB_DICE.showToastNotification) {
              setTimeout(() => {
                window.BB_DICE.showToastNotification(`Codex: Finished scribing ${scribedSpellName}!`);
              }, 1500);
            }
          } else {
            const spellId = char.scribingSpell.spellId;
            const completed = char.scribingSpell.completedRests;
            const required = char.scribingSpell.requiredRests;
            if (window.BB_DICE && window.BB_DICE.showToastNotification) {
              setTimeout(() => {
                const spellName = window.BB_DATABASE.SPELLS.find(s => s.id === spellId)?.name || "Spell";
                window.BB_DICE.showToastNotification(`Codex: Scribing ${spellName} progress: ${completed}/${required}`);
              }, 1500);
            }
          }
        }

        window.BB_STATE.saveCharacter(char);
        if (window.BB_DICE && window.BB_DICE.showToastNotification) {
            window.BB_DICE.showToastNotification(`${char.name} took a Short Rest.`);
        }
        const pnl = document.getElementById("short-rest-panel");
        if (pnl) pnl.style.display = "none";
        render();
      });
    }

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

    const handleRestDieConsume = (pool, titlePrefix, callback) => {
        if (!char.restDice) char.restDice = { used: 0 };
        if (char.restDice.used >= char.level) return false;

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
          baseMod = Math.max(0, window.BB_STATE.getModifier(window.BB_STATE.getComputedStat(char, "Dex")));
          poolName = "Stamina Points";
          statName = "Dex";
        }

        let hasRestful = char.talents && char.talents.includes("Restful");
        let extraMod = hasRestful ? 1 : 0;
        let extraBreakdown = hasRestful ? " + 1 (Restful)" : "";
        let advMode = char.race === "Troll" ? 1 : 0;
        
        let label = `${titlePrefix} (${poolName})`;
        
        let isProphet = char.class === "Invoker" && char.level >= 10;
        if (pool === "hp" && isProphet) {
            let maxVal = restDieSize + baseMod + extraMod;
            let logEntry = {
              timestamp: new Date().toISOString(),
              characterId: char.id,
              characterName: char.name,
              rollType: label,
              total: maxVal,
              breakdown: `Prophet Maximized [1d${restDieSize}] + ${baseMod}${extraBreakdown}`,
              isCrit: false,
              isFail: false
            };
            let currentLog = window.BB_STATE.getDiceLog();
            currentLog.unshift(logEntry);
            if (currentLog.length > 50) currentLog.pop();
            window.BB_STATE.publish('dice_log_changed');
            if (window.BB_DICE && window.BB_DICE.showToastNotification) {
                window.BB_DICE.showToastNotification(`Prophet: Restored maximum ${maxVal} ${poolName}!`);
            }

            char[pool].current = Math.min(char[pool].current + maxVal, char[pool].total);
            char.restDice.used += 1;
            window.BB_STATE.saveCharacter(char);
            render();
            if (callback) callback(maxVal, poolName);
            return true;
        }
        
        if (window.BB_DICE && window.BB_DICE.roll) {
           window.BB_DICE.roll(label, 1, restDieSize, baseMod, advMode, 0, false, "", extraMod, extraBreakdown, false, (totalRestored) => {
              totalRestored = Math.max(0, totalRestored);
              char[pool].current = Math.min(char[pool].current + totalRestored, char[pool].total);
              char.restDice.used += 1;

              window.BB_STATE.saveCharacter(char);
              render();
              if (callback) callback(totalRestored, poolName);
           });
           return true;
        }
        return false;
    };

    document.querySelectorAll(".short-rest-option").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const pool = btn.getAttribute("data-pool");
        handleRestDieConsume(pool, "Short Rest", (totalRestored, poolName) => {
          // The function saves and renders internally
          // window.BB_DICE.showToastNotification(`Restored ${totalRestored} ${poolName}!`);
        });
      });
    });

    document.querySelectorAll(".use-potion-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (!char.combatState) char.combatState = {};
        let hasDipso = char.talents && char.talents.includes("Dipsomaniac");
        let consumedBonus = false;
        let consumedAction = false;

        if (hasDipso && !char.combatState.bonusAction) {
          consumedBonus = true;
        } else if (!char.combatState.action) {
          consumedAction = true;
        } else {
          window.BB_DICE.showToastNotification(hasDipso ? "You lack the Action or Bonus Action economy to use a potion!" : "You lack the Action economy to use an item!");
          return;
        }

        if (!char.restDice) char.restDice = { used: 0 };
        if (char.restDice.used >= char.level) {
          window.BB_DICE.showToastNotification("No Rest Dice remaining!");
          return;
        }

        const pool = btn.getAttribute("data-pool");
        const potionName = btn.getAttribute("data-name");
        
        const index = char.inventorySlots.findIndex(slot => {
          if (typeof slot === "string") return slot === potionName;
          if (slot && typeof slot === "object") return slot.name === potionName;
          return false;
        });

        if (index > -1) {
          const slot = char.inventorySlots[index];
          if (typeof slot === "object" && slot.quantity > 1) {
            slot.quantity -= 1;
          } else {
            char.inventorySlots[index] = ""; // Consume
          }
          
          if (consumedBonus) {
            char.combatState.bonusAction = true;
            const cb = document.querySelector('.action-cb[data-action="bonusAction"]');
            if (cb) cb.checked = true;
          } else if (consumedAction) {
            char.combatState.action = true;
            const cb = document.querySelector('.action-cb[data-action="action"]');
            if (cb) cb.checked = true;
          }

          const wasConsumed = handleRestDieConsume(pool, `Used ${potionName}`, (totalRestored, poolName) => {
             // window.BB_DICE.showToastNotification(`Used ${potionName}, restored ${totalRestored} ${poolName}!`);
          });
          if (!wasConsumed) {
            window.BB_DICE.showToastNotification("No Rest Dice remaining!");
          }
        }
      });
    });

    const longRestBtn = document.getElementById("long-rest-btn");
    if (longRestBtn) {
      longRestBtn.addEventListener("click", () => {
        if (char.trackers) {
          if (char.trackers["archmageFreeUseUsed"]) delete char.trackers["archmageFreeUseUsed"];
          if (char.trackers["archmageUses"]) delete char.trackers["archmageUses"];
        }
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

        // Restore Action Economy
        if (!char.combatState) char.combatState = {};
        char.combatState.action = false;
        char.combatState.bonusAction = false;
        char.combatState.reaction = false;
        char.combatState.movement = false;
        if (char.trackers) delete char.trackers["Further Beyond Used This Turn"];

        // Restore Class Trackers
        if (char.availableTrackers) {
          char.trackers = char.trackers || {};
          char.availableTrackers.forEach(tracker => {
            if (tracker.type === "number") {
              char.trackers[tracker.name] = tracker.max;
            } else if (tracker.type === "checkboxes") {
              char.trackers[tracker.name] = 0; // 0 uses expended
            }
          });
        }

        // Indomitable Spirit Logic
        const raceData = window.BB_DATABASE.SPECIES.find(r => r.name === char.race);
        const hasIndomitableSpirit = raceData && raceData.ancestralFeat && raceData.ancestralFeat.name === "Indomitable Spirit";
        if (hasIndomitableSpirit) {
          if (!char.inspirationDice) char.inspirationDice = [];
          const indomDie = char.inspirationDice.find(d => d.source === "Indomitable Spirit");
          if (!indomDie) {
            char.inspirationDice.push({ id: 'insp-' + Math.random().toString(36).substr(2, 9), size: "d4", source: "Indomitable Spirit" });
          } else {
            const steps = ["d4", "d6", "d8", "d10", "d12", "d20"];
            let currentStep = steps.indexOf(indomDie.size);
            if (currentStep !== -1 && currentStep < steps.length - 1) {
              indomDie.size = steps[currentStep + 1];
            }
          }
        }
        // Codex Scribing Progress (Long Rest)
        // Codex Scribing Progress (Long Rest)
        if (char.class === "Mage" && char.scribingSpell && char.scribingSpell.spellId) {
          const progressInc = char.level >= 7 ? 2 : 1;
          char.scribingSpell.completedRests = (parseInt(char.scribingSpell.completedRests) || 0) + progressInc;
          
          if (char.scribingSpell.completedRests >= char.scribingSpell.requiredRests) {
            if (!char.spells) char.spells = [];
            char.spells.push(char.scribingSpell.spellId);
            const scribedSpellName = window.BB_DATABASE.SPELLS.find(s => s.id === char.scribingSpell.spellId)?.name || "Spell";
            delete char.scribingSpell;
            if (window.BB_DICE && window.BB_DICE.showToastNotification) {
              setTimeout(() => {
                window.BB_DICE.showToastNotification(`Codex: Finished scribing ${scribedSpellName}!`);
              }, 1500);
            }
          } else {
            const spellId = char.scribingSpell.spellId;
            const completed = char.scribingSpell.completedRests;
            const required = char.scribingSpell.requiredRests;
            if (window.BB_DICE && window.BB_DICE.showToastNotification) {
              setTimeout(() => {
                const spellName = window.BB_DATABASE.SPELLS.find(s => s.id === spellId)?.name || "Spell";
                window.BB_DICE.showToastNotification(`Codex: Scribing ${spellName} progress: ${completed}/${required}`);
              }, 1500);
            }
          }
        }

        window.BB_STATE.saveCharacter(char);
        window.BB_DICE.showToastNotification(`Long Rest complete. Fully restored resources and Action Economy!`);
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
              if (type === "spell") meta = `Attunement: ${window.BB_STATE.getSpellAttunementCost(char, item)} | Cost: ${item.cost} | Range: ${item.range}`;
              if (type === "feat" || type === "talent") meta = `Requirement: ${item.requirement}`;
              
              tooltip.innerHTML = `
                <h4>${item.name}</h4>
                <div class="tooltip-meta">${meta}</div>
                <p>${item.description}</p>
                ${item.use ? `<h4>Use</h4><p>${item.use}</p>` : ""}
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
            
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            if (left < scrollX + 10) left = scrollX + 10;
            if (top < scrollY + 10) top = scrollY + 10;
            
            tooltip.style.left = left + "px";
            tooltip.style.top = top + "px";
          }
        });
        el.addEventListener("mouseleave", () => {
          tooltip.style.display = "none";
        });
      });
    }

    // Restore scroll positions
    const scrollableElementsToRestore = document.querySelectorAll('*');
    scrollableElementsToRestore.forEach(el => {
      let key = el.id;
      if (!key && el.className) key = el.className;
      if (key && lastScrollPositions.has(key)) {
        const pos = lastScrollPositions.get(key);
        el.scrollTop = pos.top;
        el.scrollLeft = pos.left;
      }
    });
    if (lastScrollPositions.has('window')) {
      const pos = lastScrollPositions.get('window');
      window.scrollTo(pos.left, pos.top);
    }
  }

  return {
    init
  };
})();









