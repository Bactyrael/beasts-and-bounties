document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const charId = urlParams.get('id');
  
  if (!charId) {
      document.getElementById("print-root").innerHTML = "<div style='text-align:center; padding:50px;'><h2>No character ID provided.</h2><p>Please open this page from the character sheet Print button.</p></div>";
      return;
  }

  const characters = window.BB_STATE.getSavedCharacters();
  const char = characters.find(c => c.id === charId);

  if (!char) {
      document.getElementById("print-root").innerHTML = "<div style='text-align:center; padding:50px;'><h2>Character not found.</h2></div>";
      return;
  }

  // Force recalculation to ensure derived stats are present
  if (window.BB_STATE.recalculateCharacter) {
      window.BB_STATE.recalculateCharacter(char);
  }

  // Helper for modifiers
  const getModStr = (val) => {
      const mod = window.BB_STATE.getModifier ? window.BB_STATE.getModifier(val) : Math.floor((val - 10) / 2);
      return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const getStat = (statKey) => {
      return window.BB_STATE.getComputedStat ? window.BB_STATE.getComputedStat(char, statKey) : char.stats[statKey];
  };

  // Build Stats HTML
  const stats = [
    { key: "Str", label: "Strength" },
    { key: "Dex", label: "Dexterity" },
    { key: "Con", label: "Constitution" },
    { key: "Int", label: "Intelligence" },
    { key: "Wis", label: "Wisdom" },
    { key: "Lck", label: "Luck" }
  ];

  let statsHTML = `<div class="stats-row">`;
  stats.forEach(s => {
      const val = getStat(s.key) || 0;
      statsHTML += `
          <div class="stat-box">
              <div class="stat-label">${s.label}</div>
              <div class="stat-val">${getModStr(val)}</div>
              <div style="font-size:8pt; color:#666;">Score: ${val}</div>
          </div>
      `;
  });
  statsHTML += `</div>`;

  // Build Skills HTML
  const skillsList = [
    { name: "Acrobatics", attr: "Dex" }, { name: "Athletics", attr: "Str" }, { name: "Awareness", attr: "Wis" },
    { name: "Brawn", attr: "Str" }, { name: "Browbeat", attr: "Str" }, { name: "Bushcraft", attr: "Wis" },
    { name: "Commerce", attr: "Lck" }, { name: "Concentration", attr: "Con" }, { name: "Diplomacy", attr: "Lck" },
    { name: "Endurance", attr: "Con" }, { name: "Investigation", attr: "Int" }, { name: "Knowledge", attr: "Int" },
    { name: "Linguistics", attr: "Int" }, { name: "Medicine", attr: "Wis" }, { name: "Performance", attr: "Lck" },
    { name: "Sleight of Hand", attr: "Dex" }, { name: "Sneak", attr: "Dex" }, { name: "Tolerance", attr: "Con" }
  ];
  let skillsHTML = `<div class="section"><div class="section-title">Skills</div>`;
  skillsList.forEach(sk => {
      const isTrained = char.skills && char.skills[sk.name];
      const attrVal = getStat(sk.attr) || 0;
      const baseMod = window.BB_STATE.getModifier ? window.BB_STATE.getModifier(attrVal) : Math.floor((attrVal - 10)/2);
      const profBonus = Math.max(1, Math.floor((char.level || 1) / 4) + 1);
      const totalMod = baseMod + (isTrained ? profBonus : 0);
      const modStr = totalMod >= 0 ? `+${totalMod}` : `${totalMod}`;
      skillsHTML += `
          <div class="skill-item">
              <span class="skill-name">${isTrained ? '&#9679;' : '&#9675;'} ${sk.name} <span style="font-size:7pt; color:#666;">(${sk.attr})</span></span>
              <span class="skill-mod">${modStr}</span>
          </div>
      `;
  });
  skillsHTML += `</div>`;

  // Combat Stats HTML
  let combatHTML = `
      <div class="section">
          <div class="section-title">Combat & Vitals</div>
          <div class="combat-stats">
              <div class="combat-box">
                  <div class="combat-label">HP Max</div>
                  <div class="combat-val">${char.hp ? char.hp.total : 0}</div>
              </div>
              <div class="combat-box">
                  <div class="combat-label">Stamina</div>
                  <div class="combat-val">${char.sp ? char.sp.total : 0}</div>
              </div>
              <div class="combat-box">
                  <div class="combat-label">Mana</div>
                  <div class="combat-val">${char.mp ? char.mp.total : 0}</div>
              </div>
              <div class="combat-box">
                  <div class="combat-label">Speed</div>
                  <div class="combat-val">${char.movement || 30} ft</div>
              </div>
              <div class="combat-box">
                  <div class="combat-label">Defense (DEF)</div>
                  <div class="combat-val">${char.defense || 10}</div>
              </div>
              <div class="combat-box">
                  <div class="combat-label">Resilience (RES)</div>
                  <div class="combat-val">${char.resilience || 10}</div>
              </div>
          </div>
      </div>
  `;

  // Talents & Feats HTML (with descriptions)
  let talentsHTML = `<div class="section"><div class="section-title">Talents & Feats</div>`;
  if (char.talents) {
      char.talents.forEach(tName => {
          if (!tName) return;
          const tData = window.BB_DATABASE.TALENTS.find(t => t.name === tName || tName.startsWith(t.name + " ("));
          const desc = tData ? tData.description : "Talent description not found.";
          talentsHTML += `<div class="text-item"><div class="text-title">${tName}</div><div class="text-desc">${desc}</div></div>`;
      });
  }
  if (char.feats) {
      char.feats.forEach(fName => {
          if (!fName) return;
          const fData = window.BB_DATABASE.FEATS.find(f => f.name === fName || fName.startsWith(f.name + " ("));
          const desc = fData ? fData.description : "Feat description not found.";
          talentsHTML += `<div class="text-item"><div class="text-title">${fName}</div><div class="text-desc">${desc}</div></div>`;
      });
  }
  talentsHTML += `</div>`;

  // Page 1 Layout (Replaced Class Features with Talents & Feats)
  let page1 = `
      <div class="print-page">
          <div class="print-header">
              <div>
                  <div class="char-name">${char.name || 'Unnamed Character'}</div>
                  <div class="char-subtitle">Level ${char.level} ${char.race || ''} ${char.class || ''}</div>
              </div>
          </div>
          ${statsHTML}
          <div class="grid-container">
              <div>${skillsHTML}</div>
              <div>${combatHTML}</div>
              <div>${talentsHTML}</div>
          </div>
      </div>
  `;

  // Inventory & Traits (Page 2)
  let equipHTML = `<div class="section"><div class="section-title">Equipment</div>`;
  if (char.equipment) {
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
                  equipHTML += `<div class="text-item"><span class="text-title">Coins:</span> <span class="text-desc">${coinStrs.join(', ')}</span></div>`;
              }
              return;
          }
          if (char.equipment[slot]) {
              equipHTML += `
                  <div class="text-item">
                      <span class="text-title" style="text-transform:capitalize;">${slot}:</span> 
                      <span class="text-desc">${char.equipment[slot]}</span>
                  </div>
              `;
          }
      });
  }
  equipHTML += `</div>`;

  let bagHTML = `<div class="section"><div class="section-title">Inventory (Bag)</div>`;
  if (char.inventory && char.inventory.length > 0) {
      char.inventory.forEach(item => {
          bagHTML += `<div class="text-item"><span class="text-desc">${item.qty}x ${item.name}</span></div>`;
      });
  } else {
      bagHTML += `<div class="text-item"><span class="text-desc">Bag is empty.</span></div>`;
  }
  bagHTML += `</div>`;

  let notesHTML = `<div class="section"><div class="section-title">Background & Notes</div>`;
  if (char.backgroundTraits) {
      notesHTML += `<div class="text-item"><div class="text-title">Trait</div><div class="text-desc">${char.backgroundTraits.trait || ''}</div></div>`;
      notesHTML += `<div class="text-item"><div class="text-title">Ideal</div><div class="text-desc">${char.backgroundTraits.ideal || ''}</div></div>`;
      notesHTML += `<div class="text-item"><div class="text-title">Bond</div><div class="text-desc">${char.backgroundTraits.bond || ''}</div></div>`;
      notesHTML += `<div class="text-item"><div class="text-title">Flaw</div><div class="text-desc">${char.backgroundTraits.flaw || ''}</div></div>`;
  }
  notesHTML += `<div class="text-item" style="margin-top:10px;"><div class="text-title">Notes</div><div class="text-desc">${(char.notes || '').replace(/\n/g, "<br>")}</div></div>`;
  notesHTML += `</div>`;


  // Page 2 Layout (Now 2 columns instead of 3 since Talents moved)
  let page2 = `
      <div class="page-break"></div>
      <div class="print-page">
          <div class="print-header">
              <div>
                  <div class="char-name">${char.name || 'Unnamed Character'} - Continued</div>
              </div>
          </div>
          <div class="grid-container" style="grid-template-columns: 1fr 1fr;">
              <div>${equipHTML}${bagHTML}</div>
              <div>${notesHTML}</div>
          </div>
      </div>
  `;

  document.getElementById("print-root").innerHTML = page1 + page2;

  // Auto-print
  setTimeout(() => {
      window.print();
  }, 500);

});
