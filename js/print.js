document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const charId = urlParams.get('id');
  
  if (!charId) {
      document.getElementById("print-root").innerHTML = "<div style='text-align:center; padding:50px;'><h2>No character ID provided.</h2></div>";
      return;
  }

  const characters = window.BB_STATE.getSavedCharacters();
  const char = characters.find(c => c.id === charId);

  if (!char) {
      document.getElementById("print-root").innerHTML = "<div style='text-align:center; padding:50px;'><h2>Character not found.</h2></div>";
      return;
  }

  if (window.BB_STATE.recalculateCharacter) window.BB_STATE.recalculateCharacter(char);

  const getModStr = (val) => {
      const mod = window.BB_STATE.getModifier ? window.BB_STATE.getModifier(val) : Math.floor((val - 10) / 2);
      return mod >= 0 ? `+${mod}` : `${mod}`;
  };
  const getStat = (key) => window.BB_STATE.getComputedStat ? window.BB_STATE.getComputedStat(char, key) : (char.stats[key] || 10);

  // 1. STATS (Vertical)
  const statsList = [
    { key: "Str", label: "Strength" }, { key: "Dex", label: "Dexterity" }, { key: "Con", label: "Constitution" },
    { key: "Int", label: "Intelligence" }, { key: "Wis", label: "Wisdom" }, { key: "Lck", label: "Luck" }
  ];
  let statsHTML = ``;
  statsList.forEach(s => {
      const val = getStat(s.key);
      statsHTML += `
          <div class="stat-block">
              <div class="stat-title">${s.label}</div>
              <div class="stat-mod">${getModStr(val)}</div>
              <div class="stat-score">${val}</div>
          </div>
      `;
  });

  // 2. SKILLS (Rows)
  const skillsList = [
    { name: "Acrobatics", attr: "Dex" }, { name: "Athletics", attr: "Str" }, { name: "Awareness", attr: "Wis" },
    { name: "Brawn", attr: "Str" }, { name: "Browbeat", attr: "Str" }, { name: "Bushcraft", attr: "Wis" },
    { name: "Commerce", attr: "Lck" }, { name: "Concentration", attr: "Con" }, { name: "Diplomacy", attr: "Lck" },
    { name: "Endurance", attr: "Con" }, { name: "Investigation", attr: "Int" }, { name: "Knowledge", attr: "Int" },
    { name: "Linguistics", attr: "Int" }, { name: "Medicine", attr: "Wis" }, { name: "Performance", attr: "Lck" },
    { name: "Sleight of Hand", attr: "Dex" }, { name: "Sneak", attr: "Dex" }, { name: "Tolerance", attr: "Con" }
  ];
  let skillsHTML = ``;
  skillsList.forEach(sk => {
      const isTrained = char.skills && char.skills[sk.name];
      const attrVal = getStat(sk.attr) || 10;
      const baseMod = window.BB_STATE.getModifier ? window.BB_STATE.getModifier(attrVal) : Math.floor((attrVal - 10)/2);
      const profBonus = Math.max(1, Math.floor((char.level || 1) / 4) + 1);
      const totalMod = baseMod + (isTrained ? profBonus : 0);
      const modStr = totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
      skillsHTML += `
          <div class="skill-row">
              <div class="skill-dot ${isTrained ? 'trained' : ''}"></div>
              <div class="skill-mod-box">${modStr}</div>
              <div class="skill-name">${sk.name}</div>
              <div class="skill-attr">(${sk.attr})</div>
          </div>
      `;
  });

  // 3. ATTACKS
  let attacksHTML = `<table class="attacks-table"><tr><th>NAME</th><th>ATK BONUS</th><th>DAMAGE / TYPE</th></tr>`;
  const weps = [];
  if (char.equipment && char.equipment.mainHand) weps.push(char.equipment.mainHand);
  if (char.equipment && char.equipment.offHand) weps.push(char.equipment.offHand);
  
  if (weps.length === 0) {
      attacksHTML += `<tr><td class="atk-name">Unarmed Strike</td><td>-</td><td>-</td></tr>`;
  } else {
      weps.forEach(w => {
          attacksHTML += `<tr><td class="atk-name">${w}</td><td>(See Weapon)</td><td>(See Weapon)</td></tr>`;
      });
  }
  attacksHTML += `</table>`;

  // 4. TALENTS & FEATS
  let talentsHTML = ``;
  if (char.talents) {
      char.talents.forEach(tName => {
          if (!tName) return;
          const tData = window.BB_DATABASE.TALENTS.find(t => t.name === tName || tName.startsWith(t.name + " ("));
          talentsHTML += `<div class="text-entry"><strong>${tName} (Talent)</strong><span>${tData ? tData.description : ''}</span></div>`;
      });
  }
  if (char.feats) {
      char.feats.forEach(fName => {
          if (!fName) return;
          const fData = window.BB_DATABASE.FEATS.find(f => f.name === fName || fName.startsWith(f.name + " ("));
          talentsHTML += `<div class="text-entry"><strong>${fName} (Feat)</strong><span>${fData ? fData.description : ''}</span></div>`;
      });
  }

  // 5. INVENTORY & EQUIPMENT
  let equipHTML = ``;
  if (char.equipment) {
      equipHTML += `<table class="inv-table"><tr><th>Equipped Item</th><th>Slot</th></tr>`;
      Object.keys(char.equipment).forEach(slot => {
          if (slot === 'coins') {
              const coins = char.equipment.coins;
              const coinStrs = [];
              if (coins.gold) coinStrs.push(`${coins.gold} GP`);
              if (coins.silver) coinStrs.push(`${coins.silver} SP`);
              if (coins.bronze) coinStrs.push(`${coins.bronze} BP`);
              if (coins.platinum) coinStrs.push(`${coins.platinum} PP`);
              if (coins.crystal) coinStrs.push(`${coins.crystal} CP`);
              if (coinStrs.length > 0) {
                  equipHTML += `<tr><td><strong>Coins</strong></td><td>${coinStrs.join(', ')}</td></tr>`;
              }
              return;
          }
          if (char.equipment[slot]) {
              equipHTML += `<tr><td style="font-weight:bold;">${char.equipment[slot]}</td><td style="text-transform:capitalize;">${slot}</td></tr>`;
          }
      });
      equipHTML += `</table><br>`;
  }

  let bagHTML = `<table class="inv-table"><tr><th>QTY</th><th>Bag Item</th></tr>`;
  let hasItems = false;
  if (char.inventorySlots && char.inventorySlots.length > 0) {
      char.inventorySlots.forEach(item => {
          if (!item || item === "") return;
          hasItems = true;
          if (typeof item === "string") {
              bagHTML += `<tr><td>1</td><td>${item}</td></tr>`;
          } else {
              bagHTML += `<tr><td>${item.quantity || 1}</td><td>${item.name}</td></tr>`;
          }
      });
  }
  if (!hasItems) bagHTML += `<tr><td colspan="2">Bag is empty.</td></tr>`;
  bagHTML += `</table>`;

  // 6. BACKGROUND
  let backgroundHTML = ``;
  if (char.backgroundTraits) {
      backgroundHTML += `
        <div class="section-box" style="margin-bottom:20px; padding-bottom:25px;"><div class="section-label-top">PERSONALITY TRAIT</div><div style="padding:10px 5px;">${char.backgroundTraits.trait || ''}</div></div>
        <div class="section-box" style="margin-bottom:20px; padding-bottom:25px;"><div class="section-label-top">IDEAL</div><div style="padding:10px 5px;">${char.backgroundTraits.ideal || ''}</div></div>
        <div class="section-box" style="margin-bottom:20px; padding-bottom:25px;"><div class="section-label-top">BOND</div><div style="padding:10px 5px;">${char.backgroundTraits.bond || ''}</div></div>
        <div class="section-box" style="margin-bottom:20px; padding-bottom:25px;"><div class="section-label-top">FLAW</div><div style="padding:10px 5px;">${char.backgroundTraits.flaw || ''}</div></div>
      `;
  }
  backgroundHTML += `<div class="section-box" style="min-height:200px;"><div class="section-label-top">NOTES / APPEARANCE</div><div style="padding:10px 5px;">${(char.notes || '').replace(/\n/g, '<br>')}</div></div>`;


  // PAGE 1 ASSEMBLY
  let page1 = `
      <div class="print-page">
          <div class="header-container">
              <div class="char-name-box">
                  <h1>${char.name || 'Unnamed'}</h1>
                  <label>CHARACTER NAME</label>
              </div>
              <div class="header-details">
                  <div class="header-field"><span>${char.class || ''} ${char.level || 1}</span><label>CLASS & LEVEL</label></div>
                  <div class="header-field"><span>${char.race || ''}</span><label>SPECIES</label></div>
                  <div class="header-field"><span></span><label>BACKGROUND</label></div>
                  <div class="header-field"><span></span><label>PLAYER NAME</label></div>
              </div>
          </div>
          
          <div class="main-body">
              <div class="col-stats">${statsHTML}</div>
              
              <div class="col-skills">
                  <div class="section-box">
                      <div class="section-label-top">SKILLS</div>
                      <div style="margin-top:10px;">${skillsHTML}</div>
                  </div>
              </div>
              
              <div class="col-main">
                  <div class="vitals-grid">
                      <div class="shield-border"><div class="vital-value">${char.defense || 10}</div><div class="vital-label">Armor<br>Class</div></div>
                      <div class="vital-box"><div class="vital-value">${char.hp ? char.hp.total : 0}</div><div class="vital-label">HP Max</div></div>
                      <div class="vital-box"><div class="vital-value">${char.sp ? char.sp.total : 0}</div><div class="vital-label">Stamina</div></div>
                      
                      <div class="shield-border"><div class="vital-value">${char.resilience || 10}</div><div class="vital-label">Resilience</div></div>
                      <div class="vital-box"><div class="vital-value">${char.mp ? char.mp.total : 0}</div><div class="vital-label">Mana</div></div>
                      <div class="vital-box"><div class="vital-value">${char.movement || 30} ft</div><div class="vital-label">Speed</div></div>
                  </div>
                  
                  <div class="section-box">
                      <div class="section-label-top">Weapon Attacks</div>
                      <div style="margin-top:5px;">${attacksHTML}</div>
                  </div>
                  
                  <div class="section-box">
                      <div class="section-label-top">Features & Traits</div>
                      <div style="margin-top:5px;">${talentsHTML}</div>
                  </div>
              </div>
          </div>
      </div>
  `;

  // PAGE 2 ASSEMBLY
  let page2 = `
      <div class="page-break"></div>
      <div class="print-page">
          <div class="header-container" style="padding:10px; justify-content:center;">
              <h2 style="font-size:16pt; margin:0;">${char.name || 'Unnamed'} - Continued</h2>
          </div>
          <div class="main-body">
              <div class="col-half">
                  <div class="section-box">
                      <div class="section-label-top">Equipment & Inventory</div>
                      <div style="margin-top:10px;">${equipHTML}${bagHTML}</div>
                  </div>
              </div>
              <div class="col-half">
                  ${backgroundHTML}
              </div>
          </div>
      </div>
  `;

  document.getElementById("print-root").innerHTML = page1 + page2;

  setTimeout(() => window.print(), 500);
});
