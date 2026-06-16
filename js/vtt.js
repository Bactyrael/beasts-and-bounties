// B&B Virtual Tabletop (VTT) Module
window.BB_VTT = (() => {
  let container = null;
  let canvas = null;
  let ctx = null;
  
  // State
  let activeMap = null;
  let currentTool = "Select"; // Select, Reveal, Hide
  const TILE_SIZE = 40;

  // Interaction State
  let isInteracting = false;
  let draggedToken = null; // { originalX, originalY, type }
  let draggedPath = null; // Currently computed path
  let draggedPathEnd = { x: -1, y: -1 };
  let mousePos = { x: 0, y: 0 };
  let mouseDownPos = null; // Track where mousedown happened to differentiate click vs drag
  let pendingAttack = null; // { rawChar, label, weaponName, count, type, mod, slot, grip, critRange }
  let pendingInteract = false;
  let currentZoom = 1.0;
  
  // Selection State
  let selectedToken = null; // { x, y }

  // Combat State
  let combatAttacker = null;
  let combatTarget = null;
  
  // Initiative State
  let initiativeOrder = []; // Array of { x, y, token, roll }
  let currentTurnIndex = 0;
  let roundNumber = 1;

  const TOOLS = {
    "Grass": "#40c057",
    "Water": "#339af0",
    "Stone": "#868e96",
    "Wood":  "#854d0e",
    "Dirt":  "#a0522d",
    "Wall":  "#212529"
  };

  function init(mapId) {
    container = document.getElementById("main-view-container");
    if (!container) return;

    if (!mapId) {
      // Render full map selection landing page
      const maps = window.BB_STATE.getMaps ? window.BB_STATE.getMaps() : [];

      let mapCardsHTML = '';
      if (maps.length === 0) {
        mapCardsHTML = `
          <div style="text-align: center; padding: 60px 20px;">
            <div style="font-size: 3rem; margin-bottom: 15px;">🗺️</div>
            <h3 style="color: #fff; margin-bottom: 10px;">No Maps Available</h3>
            <p style="color: var(--text-light); margin-bottom: 20px;">Create a map in the Map Editor first, then come back here to play.</p>
            <a href="#/map-editor" class="btn btn-primary" style="text-decoration: none;">Open Map Editor</a>
          </div>
        `;
      } else {
        mapCardsHTML = `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; padding: 10px 0;">
            ${maps.map(m => `
              <div class="glass hover-lift" style="padding: 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: border-color 0.3s ease;" 
                   onmouseenter="this.style.borderColor='var(--amber)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.1)'"
                   onclick="window.BB_VTT.init('${m.id}')">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                  <div style="width: 48px; height: 48px; border-radius: 8px; background: linear-gradient(135deg, #40c057, #339af0); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">🗺️</div>
                  <div style="overflow: hidden;">
                    <h4 style="margin: 0; color: #fff; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.name || 'Untitled Map'}</h4>
                    <p style="margin: 2px 0 0 0; color: var(--text-light); font-size: 0.8rem;">${m.width || '?'}×${m.height || '?'} tiles</p>
                  </div>
                </div>
                <button class="btn btn-primary btn-xs" style="width: 100%; background: var(--amber); border: none; font-weight: 600; padding: 8px;" onclick="event.stopPropagation(); window.BB_VTT.init('${m.id}')">▶ Play</button>
              </div>
            `).join('')}
          </div>
        `;
      }

      container.innerHTML = `
        <div style="max-width: 1000px; margin: 0 auto; padding: 30px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 15px;">
            <div>
              <h2 style="margin: 0; color: var(--amber); font-family: 'Outfit', sans-serif; font-size: 1.8rem;">⚔️ Virtual Tabletop</h2>
              <p style="margin: 5px 0 0 0; color: var(--text-light); font-size: 0.9rem;">Select a map to begin your session</p>
            </div>
            <a href="#/map-editor" class="btn btn-secondary btn-xs" style="text-decoration: none;">+ Create Map</a>
          </div>
          ${mapCardsHTML}
        </div>
      `;
      return;
    }

    const map = window.BB_STATE.getMap(mapId);
    if (!map) {
      container.innerHTML = `<div style="padding: 20px; color: #fff;">Map not found. <a href="#/vtt" style="color:var(--amber);">Return to Map Selection</a></div>`;
      return;
    }

    // Deep copy to prevent mutating the original until saved
    activeMap = JSON.parse(JSON.stringify(map));
    
    // Initialize fog array if missing
    if (!activeMap.fog) {
      activeMap.fog = Array(activeMap.height).fill().map(() => Array(activeMap.width).fill(false)); // default revealed
    }
    // Ensure tokens array exists
    if (!activeMap.tokens) {
      activeMap.tokens = Array(activeMap.height).fill().map(() => Array(activeMap.width).fill(null));
    }
    if (!activeMap.doorsHorizontal) {
      activeMap.doorsHorizontal = Array(activeMap.height + 1).fill().map(() => Array(activeMap.width).fill(null));
    }
    if (!activeMap.doorsVertical) {
      activeMap.doorsVertical = Array(activeMap.height).fill().map(() => Array(activeMap.width + 1).fill(null));
    }

    renderLayout();
  }

  function renderLayout() {
    container.innerHTML = `
      <div style="display: flex; height: calc(100vh - 90px); width: 100%; max-width: none; margin: 0 auto; gap: 20px; padding: 10px 20px; position: relative; box-sizing: border-box;">
        
        <!-- Sidebar -->
        <div class="glass" style="width: 250px; flex-shrink: 0; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; overflow-y: auto;">
          <h2 style="margin-top: 0; color: #ff6b6b; border-bottom: 1px solid rgba(255,107,107,0.3); padding-bottom: 10px;">VTT Mode</h2>
          <h4 style="color: #fff; margin-top: 0;">${activeMap.name}</h4>
          
          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
            <button class="btn vtt-tool-btn" data-tool="Select" onclick="window.BB_VTT.selectTool('Select')" style="background: rgba(0,0,0,0.5); border: 2px solid var(--amber); text-align: left;">🖐 Select Token</button>
            <button class="btn vtt-tool-btn" data-tool="Spawn Monster" onclick="window.BB_VTT.selectTool('Spawn Monster')" style="background: rgba(0,0,0,0.5); border: 2px solid transparent; text-align: left;">👹 Spawn Monster</button>
            <div id="vtt-monster-spawn-ui" style="display: none; flex-direction: column; gap: 5px; margin-left: 10px;">
              <select id="vtt-monster-select" class="form-control" style="background: rgba(0,0,0,0.6); color: #fff; border: 1px solid var(--amber);">
                ${window.BB_DATABASE.MONSTERS.map(m => `<option value="${m.name}">${m.name}</option>`).join('')}
              </select>
              <small style="color: #aaa;">Click on the map to spawn.</small>
            </div>
            <button class="btn vtt-tool-btn" data-tool="Reveal" onclick="window.BB_VTT.selectTool('Reveal')" style="background: rgba(0,0,0,0.5); border: 2px solid transparent; text-align: left;">👁 Reveal Fog (Brush)</button>
            <button class="btn vtt-tool-btn" data-tool="Hide" onclick="window.BB_VTT.selectTool('Hide')" style="background: rgba(0,0,0,0.5); border: 2px solid transparent; text-align: left;">☁ Hide Fog (Brush)</button>
          </div>

          <div style="display: flex; gap: 5px; margin-bottom: 20px;">
            <button class="btn btn-secondary btn-xs" onclick="window.BB_VTT.fillFog(false)" style="flex: 1;">Reveal All</button>
            <button class="btn btn-secondary btn-xs" onclick="window.BB_VTT.fillFog(true)" style="flex: 1;">Hide All</button>
          </div>

          <button class="btn btn-secondary btn-xs" onclick="window.BB_VTT.resetMovement()" style="width:100%; margin-bottom:10px;">Reset Movement</button>
          
          <button class="btn" style="width:100%; margin-bottom:20px; background: rgba(0,0,0,0.5); border: 1px solid var(--amber); color: var(--amber); font-weight:bold;" onclick="window.BB_VTT.toggleDicePanel()">🗡️ Combat Panel</button>

          <!-- Initiative Tracker -->
          <div id="vtt-initiative-tracker" style="border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; margin-bottom:10px; flex-shrink:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="margin:0; color:#ff6b6b;">Initiative</h4>
              <button class="btn btn-primary btn-xs" onclick="window.BB_VTT.startCombat()">Roll All</button>
            </div>
            <div id="vtt-initiative-list" style="display:flex; flex-direction:column; gap:5px; max-height:150px; overflow-y:auto; margin-bottom:10px;"></div>
            <div style="display:none; gap:5px;" id="vtt-initiative-controls">
              <button class="btn btn-secondary btn-xs" style="flex:1;" onclick="window.BB_VTT.nextTurn()">Next Turn</button>
              <button class="btn btn-danger btn-xs" style="flex:1;" onclick="window.BB_VTT.endCombat()">End Combat</button>
            </div>
          </div>

          <!-- Selected Token Info Panel -->
          <div id="vtt-selected-info" style="display:none; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; margin-bottom:10px; flex-shrink:0;"></div>

          <button class="btn btn-primary" onclick="window.BB_VTT.saveVTTState()" style="margin-top: auto; margin-bottom: 10px;">Save Session State</button>
          <a href="#/vtt" class="btn btn-danger" style="text-align: center; text-decoration: none;">Exit VTT</a>
        </div>

        <!-- Canvas Area -->
        <div class="glass" style="flex: 1; min-width: 0; min-height: 0; border-radius: 8px; overflow: auto; display: flex; background: rgba(0,0,0,0.7); position: relative; cursor: grab;" id="vtt-canvas-container">
          <canvas id="vtt-canvas" style="background: #000; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin: auto;"></canvas>
          <div id="mini-statblock" style="display:none; position:absolute; z-index:100; pointer-events:none; padding:10px; border-radius:6px; background:rgba(0,0,0,0.85); border:1px solid var(--amber); width:180px; box-shadow:0 4px 10px rgba(0,0,0,0.5);"></div>
          
          <div style="position:absolute; bottom:15px; right:15px; z-index:150; background:rgba(0,0,0,0.8); border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:5px; display:flex; gap:5px; align-items:center;">
             <button class="btn btn-secondary btn-xs" onclick="window.BB_VTT.zoomOut()" style="width:24px; height:24px; padding:0; display:flex; justify-content:center; align-items:center;">-</button>
             <span id="vtt-zoom-display" style="color:#fff; font-size:0.8rem; font-family:var(--font-mono); width:40px; text-align:center;">100%</span>
             <button class="btn btn-secondary btn-xs" onclick="window.BB_VTT.zoomIn()" style="width:24px; height:24px; padding:0; display:flex; justify-content:center; align-items:center;">+</button>
          </div>
        </div>

        <!-- Combat / Dice Roller Sidebar (Right) -->
        <div id="vtt-dice-panel" class="glass" style="display:none; width: 350px; flex-shrink: 0; padding: 15px; border-radius: 8px; flex-direction: column; overflow-y: auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 10px; margin-bottom:10px;">
            <h2 style="margin: 0; color: var(--amber);">🗡️ Combat Panel</h2>
            <button class="btn btn-secondary btn-xs" onclick="window.BB_VTT.toggleDicePanel()">Close</button>
          </div>

          <div id="vtt-dynamic-combat-ui">
            <div style="font-size:0.85rem; color:#aaa; text-align:center; padding:10px 0;">Select a token to view combat options.</div>
          </div>
          
          <h4 style="margin: 15px 0 10px 0; color: var(--amber); font-size: 0.9rem; border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 4px;">Quick Dice</h4>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:15px;">
            <button class="btn btn-secondary btn-xs vtt-quick-dice-btn" data-die="4">d4</button>
            <button class="btn btn-secondary btn-xs vtt-quick-dice-btn" data-die="6">d6</button>
            <button class="btn btn-secondary btn-xs vtt-quick-dice-btn" data-die="8">d8</button>
            <button class="btn btn-secondary btn-xs vtt-quick-dice-btn" data-die="10">d10</button>
            <button class="btn btn-secondary btn-xs vtt-quick-dice-btn" data-die="12">d12</button>
            <button class="btn btn-secondary btn-xs vtt-quick-dice-btn" data-die="20">d20</button>
            <button class="btn btn-secondary btn-xs vtt-quick-dice-btn" style="grid-column: span 3;" data-die="100">d100</button>
          </div>

          <div style="margin-bottom:15px;">
            <div style="font-size:0.8rem; text-transform:uppercase; color:var(--amber); margin-bottom:5px;">Custom Roll</div>
            <div style="display:flex; gap:5px;">
              <input type="text" id="vtt-custom-dice" class="form-control" placeholder="e.g. 2d6+4" style="flex:1; background:rgba(0,0,0,0.6); color:#fff; border:1px solid rgba(255,255,255,0.2);">
              <button class="btn btn-primary btn-xs" onclick="window.BB_VTT.performVttCustomRoll()">Roll</button>
            </div>
            <label style="display:flex; align-items:center; gap:5px; margin-top:8px; font-size:0.8rem; cursor:pointer; color:#ccc;">
              <input type="checkbox" id="vtt-dice-private"> Private Roll
            </label>
          </div>

          <div style="font-size:0.8rem; text-transform:uppercase; color:var(--amber); margin-bottom:8px; border-top:1px solid rgba(255,255,255,0.2); padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
            <span>Roll History</span>
            <button class="btn btn-secondary btn-xs" id="vtt-clear-dice-log-btn" style="padding: 2px 6px; font-size: 0.65rem;">Clear</button>
          </div>
          <div id="vtt-dice-history" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:5px; min-height:100px;">
            <!-- History populated dynamically -->
          </div>
        </div>

        <!-- Combat Log Sidebar (Right-most) -->
        <div id="vtt-combat-log-panel" class="glass" style="display:flex; width: 280px; flex-shrink: 0; padding: 15px; border-radius: 8px; flex-direction: column; overflow-y: auto;">
          <h2 style="margin: 0; color: var(--amber); border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 10px; margin-bottom:10px;">📜 Combat Log</h2>
          <div id="vtt-combat-log-content" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:10px;">
            <div style="font-size:0.85rem; color:#aaa; text-align:center; padding:20px 0;">Combat events will appear here.</div>
          </div>
        </div>

      </div>
    `;

    canvas = document.getElementById("vtt-canvas");
    ctx = canvas.getContext("2d");
    
    canvas.width = activeMap.width * TILE_SIZE * currentZoom;
    canvas.height = activeMap.height * TILE_SIZE * currentZoom;

    // Canvas Events
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", (e) => {
      handleMouseUp(e);
      hideMiniStatblock();
    });

    // Combat Panel Listeners
    const dicePanel = document.getElementById("vtt-dice-panel");
    if (dicePanel) {
      dicePanel.addEventListener("click", handleCombatPanelClick);
      dicePanel.addEventListener("change", handleCombatPanelChange);
    }
    const clearLogBtn = document.getElementById("vtt-clear-dice-log-btn");
    if (clearLogBtn) {
      clearLogBtn.addEventListener("click", () => {
        if (window.BB_DICE && window.BB_DICE.clearHistory) {
          window.BB_DICE.clearHistory();
          renderDiceHistory();
        }
      });
    }

    const canvasContainer = document.getElementById("vtt-canvas-container");
    if (canvasContainer) {
      canvasContainer.addEventListener("wheel", (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.deltaY < 0) zoomIn();
          else zoomOut();
        }
      }, { passive: false });
    }

    drawCanvas();
  }

  function selectTool(tool) {
    currentTool = tool;
    
    // Reset combat state if leaving combat tool
    if (tool !== "Combat") {
      combatAttacker = null;
      combatTarget = null;
    }

    // Clear selection when switching tools
    if (tool !== "Select") {
      selectedToken = null;
      renderSelectedTokenInfo();
    }
    
    document.querySelectorAll(".vtt-tool-btn").forEach(btn => {
      btn.style.borderColor = btn.getAttribute("data-tool") === tool ? 'var(--amber)' : 'transparent';
    });
    
    const monsterUi = document.getElementById("vtt-monster-spawn-ui");
    if (monsterUi) {
      monsterUi.style.display = tool === "Spawn Monster" ? "flex" : "none";
    }

    const container = document.getElementById("vtt-canvas-container");
    if (tool === "Select") {
      container.style.cursor = "pointer";
    } else {
      container.style.cursor = "crosshair";
    }

    drawCanvas();
  }

  function fillFog(isHidden) {
    activeMap.fog = Array(activeMap.height).fill().map(() => Array(activeMap.width).fill(isHidden));
    drawCanvas();
  }

  function getMouseCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / currentZoom;
    const rawY = (e.clientY - rect.top) / currentZoom;
    const x = Math.floor(rawX / TILE_SIZE);
    const y = Math.floor(rawY / TILE_SIZE);
    return { x, y, rawX, rawY };
  }

  function brushFog(x, y) {
    if (x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
      const isHidden = currentTool === "Hide";
      if (activeMap.fog[y][x] !== isHidden) {
        activeMap.fog[y][x] = isHidden;
        drawCanvas();
      }
    }
  }

  function getEquipStatBonus(charObj, statKey) {
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
  }

  function hydrateCharacterStats(char) {
    const c = JSON.parse(JSON.stringify(char));

    let effectiveCon = c.stats.Con + getEquipStatBonus(c, "Con");
    if (c.equipment && c.equipment.armor === "Heartcord" && effectiveCon < 18) effectiveCon = 18;
    const conMod = window.BB_STATE.getModifier(effectiveCon);
    c.hp.total = (effectiveCon + conMod) * 5;
    if (c.talents && c.talents.includes("Vitality")) c.hp.total += conMod;
    if (c.equipment && Object.values(c.equipment).includes("Bull's Amulet")) c.hp.total += 5;

    let effectiveInt = c.stats.Int + getEquipStatBonus(c, "Int");
    if (c.equipment && c.equipment.head === "Starveil" && effectiveInt < 18) effectiveInt = 18;
    const intMod = window.BB_STATE.getModifier(effectiveInt);
    if (!c.mp) c.mp = { current: 0, total: 0 };
    c.mp.total = effectiveInt + intMod;
    if (c.talents && c.talents.includes("Acuity")) c.mp.total += intMod;
    if (c.equipment && Object.values(c.equipment).includes("Lizard's Amulet")) c.mp.total += 5;

    let effectiveDex = c.stats.Dex + getEquipStatBonus(c, "Dex");
    if (c.equipment && c.equipment.feet === "Dragon Riders" && effectiveDex < 18) effectiveDex = 18;
    const dexMod = window.BB_STATE.getModifier(effectiveDex);
    if (!c.sp) c.sp = { current: 0, total: 0 };
    c.sp.total = effectiveDex + dexMod;
    if (c.talents && c.talents.includes("Vigor")) c.sp.total += dexMod;
    if (c.equipment && Object.values(c.equipment).includes("Rabbit's Amulet")) c.sp.total += 5;

    let baseDefStat = (c.equipment && !!c.equipment.armor) ? "Str" : null;
    let baseResStat = (c.equipment && !!c.equipment.armor) ? "Wis" : null;
    let defBonus = 0;
    let resBonus = 0;

    let hasArmor = false;
    if (c.equipment && c.equipment.armor) {
      const armorItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === c.equipment.armor);
      if (armorItem && armorItem.type !== "Clothing") hasArmor = true;
    }

    if (c.class === "Disciple" && !hasArmor) {
      baseDefStat = "Str"; baseResStat = "Wis";
      defBonus += 3; resBonus += 3;
    }

    if (c.equipment) {
      Object.values(c.equipment).forEach(itemName => {
        if (itemName) {
          const itemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
          if (itemData) {
            if (itemData.defense !== undefined) {
              const text = itemData.defense.toString().toLowerCase();
              if (text.includes("dexterity")) baseDefStat = "Dex";
              else if (text.includes("constitution")) baseDefStat = "Con";
              else if (text.includes("intelligence")) baseDefStat = "Int";
              else if (text.includes("wisdom")) baseDefStat = "Wis";
              else if (text.includes("charisma")) baseDefStat = "Cha";
              else if (text.includes("strength")) baseDefStat = "Str";
              const match = text.match(/([+-]?\s*\d+)/);
              if (match) defBonus += parseInt(match[1].replace(/\s/g, ''));
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
              if (match) resBonus += parseInt(match[1].replace(/\s/g, ''));
            }
          }
        }
      });
    }

    const finalDefStatBonus = baseDefStat ? window.BB_STATE.getModifier(c.stats[baseDefStat]) : 0;
    const finalResStatBonus = baseResStat ? window.BB_STATE.getModifier(c.stats[baseResStat]) : 0;

    c.defense = defBonus + finalDefStatBonus;
    c.resilience = resBonus + finalResStatBonus;

    let baseMovement = 30;
    let movementBonus = 0;
    if (c.class === "Disciple") movementBonus += 15;
    if (c.equipment && c.equipment.feet === "Boots of Swiftness") movementBonus += 5;
    if (c.equipment) {
      Object.values(c.equipment).forEach(itemName => {
        if (itemName) {
          const itemData = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
          if (itemData && itemData.movementPenalty) {
             const match = itemData.movementPenalty.toString().match(/([+-]\s*\d+)/);
             if (match) movementBonus += parseInt(match[1].replace(/\s/g, ''));
             else movementBonus += parseInt(itemData.movementPenalty.toString()) || 0;
          }
        }
      });
    }
    c.speed = baseMovement + movementBonus;
    
    // Encumbrance
    let inventoryWeight = 0;
    if (Array.isArray(c.inventorySlots)) {
      c.inventorySlots.forEach(slotItem => {
        let name = typeof slotItem === "string" ? slotItem : (slotItem ? slotItem.name : null);
        let qty = typeof slotItem === "object" && slotItem ? (slotItem.quantity || 1) : 1;
        if (name) {
          const item = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === name);
          if (item && item.weight) inventoryWeight += (parseFloat(item.weight) || 0) * qty;
        }
      });
    }
    const encumbMax = effectiveCon * 10;
    if (inventoryWeight >= encumbMax * 2) c.speed = 0;
    else if (inventoryWeight > encumbMax) c.speed -= 10;
    if (c.speed < 0) c.speed = 0;

    return c;
  }

  function showMiniStatblock(tokenObj, rawX, rawY) {
    const sb = document.getElementById("mini-statblock");
    if (!sb) return;

    if (tokenObj.monsterId) {
      if (tokenObj.movementRemaining === undefined) {
        tokenObj.movementRemaining = parseInt(tokenObj.movementRemaining) || 30; // fallback if needed, but we init it
      }
      sb.innerHTML = `
        <h4 style="margin:0 0 5px 0; color:#ff6b6b; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:3px; font-size:1rem;">${tokenObj.monsterId}</h4>
        <div style="font-size:0.85rem; color:#fff;">
          <div style="margin-bottom:3px;"><strong>Type:</strong> Enemy Token</div>
          <div style="margin-bottom:3px;"><strong style="color:#ff6b6b;">HP:</strong> ${tokenObj.currentHp} / ${tokenObj.maxHp}</div>
          <div style="margin-bottom:3px;"><strong style="color:#fcc419;">DEF:</strong> ${tokenObj.defense}</div>
          <div style="margin-bottom:3px;"><strong style="color:#20c997;">RES:</strong> ${tokenObj.resilience}</div>
          <div><strong>Speed:</strong> ${tokenObj.movementRemaining} ft</div>
        </div>
      `;
    } else {
      const chars = window.BB_STATE.getSavedCharacters() || [];
      let rawChar = chars.find(c => c.id === tokenObj.charId);
      if (!rawChar) return;
      
      const char = hydrateCharacterStats(rawChar);
      
      if (rawChar.movementRemaining === undefined) {
        rawChar.movementRemaining = char.speed || 30;
      }

      sb.innerHTML = `
        <h4 style="margin:0 0 5px 0; color:var(--amber); border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:3px; font-size:1rem;">${char.name}</h4>
        <div style="font-size:0.85rem; color:#fff;">
          <div style="margin-bottom:3px;"><strong>Lvl:</strong> ${char.level} ${char.class}</div>
          <div style="margin-bottom:3px;"><strong style="color:#ff6b6b;">HP:</strong> ${char.hp.current} / ${char.hp.total}</div>
          <div style="margin-bottom:3px;"><strong style="color:#4dabf7;">SP:</strong> ${char.sp ? char.sp.current + " / " + char.sp.total : "0 / 0"}</div>
          <div style="margin-bottom:3px;"><strong style="color:#ae3ec9;">MP:</strong> ${char.mp ? char.mp.current + " / " + char.mp.total : "0 / 0"}</div>
          <div style="margin-bottom:3px;"><strong style="color:#fcc419;">DEF:</strong> ${char.defense || 0}</div>
          <div style="margin-bottom:3px;"><strong style="color:#20c997;">RES:</strong> ${char.resilience || 0}</div>
          <div><strong>Speed:</strong> ${rawChar.movementRemaining} / ${char.speed || 30} ft</div>
        </div>
      `;
    }
    
    // Position within container (since container is flex center, canvas top-left isn't 0,0 of container)
    // Actually, mouse rawX and rawY are relative to canvas.
    // The container centers the canvas. We should append mini-statblock relative to canvas.
    // Since canvas is centered, we calculate the canvas offset inside container.
    const containerRect = document.getElementById("vtt-canvas-container").getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    sb.style.left = (offsetX + (rawX * currentZoom) + 15) + "px";
    sb.style.top = (offsetY + (rawY * currentZoom) + 15) + "px";
    sb.style.display = "block";
  }

  function hideMiniStatblock() {
    const sb = document.getElementById("mini-statblock");
    if (sb) sb.style.display = "none";
  }

  function handleMouseDown(e) {
    isInteracting = true;
    const { x, y, rawX, rawY } = getMouseCoords(e);
    mousePos = { x: rawX, y: rawY };

    if (currentTool === "Combat") {
      if (x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
        const token = activeMap.tokens[y][x];
        if (token) {
          if (!combatAttacker) {
            combatAttacker = { x, y, token };
            if (window.BB_DICE) window.BB_DICE.showToastNotification("Attacker selected. Select a target.");
          } else if (combatAttacker.x === x && combatAttacker.y === y) {
            // Deselect
            combatAttacker = null;
            combatTarget = null;
            hideCombatModal();
          } else {
            combatTarget = { x, y, token };
            showCombatModal();
          }
          drawCanvas();
        } else {
          combatAttacker = null;
          combatTarget = null;
          hideCombatModal();
          drawCanvas();
        }
      }
    } else if (currentTool === "Select") {
      // Record mousedown position for click vs drag detection
      mouseDownPos = { x, y };

      // Pick up token for potential drag
      if (x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
        const token = activeMap.tokens[y][x];
        if (token) {
          draggedToken = { originalX: x, originalY: y, type: token };
          
          activeMap.tokens[y][x] = null; // Remove from board temporarily
          document.getElementById("vtt-canvas-container").style.cursor = "grabbing";
          drawCanvas();
        }
      }
    } else if (currentTool === "Spawn Monster") {
      if (x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
        if (!activeMap.tokens[y][x] && !(activeMap.collision && activeMap.collision[y][x])) {
          const select = document.getElementById("vtt-monster-select");
          if (select && select.value) {
            const monsterName = select.value;
            const monster = window.BB_DATABASE.MONSTERS.find(m => m.name === monsterName);
            if (monster) {
              const stats = monster.stats || {};
              const sumStats = (stats.Str || 10) + (stats.Dex || 10) + (stats.Con || 10) + (stats.Int || 10) + (stats.Wis || 10) + (stats.Lck || 10);
              const level = Math.round(sumStats / 3);
              const conScore = stats.Con || 10;
              const rawConMod = Math.floor((conScore - 10) / 2);
              const effectiveConMod = rawConMod < 0 ? 0 : rawConMod;
              const computedHp = (level * 5) + ((conScore + effectiveConMod) * 5);

              activeMap.tokens[y][x] = {
                type: "Enemy Token",
                monsterId: monster.name,
                initial: monster.name.charAt(0).toUpperCase(),
                currentHp: computedHp,
                maxHp: computedHp,
                defense: monster.defense || 0,
                resilience: monster.resilience || 0,
                resistances: monster.resistances || [],
                vulnerabilities: monster.vulnerabilities || [],
                movementRemaining: parseInt(monster.speed) || 30
              };
              drawCanvas();
            }
          }
        }
      }
    } else if (currentTool === "Reveal" || currentTool === "Hide") {
      brushFog(x, y);
    }
  }

  function handleMouseMove(e) {
    const { x, y, rawX, rawY } = getMouseCoords(e);
    mousePos = { x: rawX, y: rawY };

    if (!isInteracting) {
      // Hover logic for stat block
      if (currentTool === "Select" && !draggedToken) {
        if (x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
          const token = activeMap.tokens[y][x];
          if (typeof token === "object" && (token.charId || token.monsterId)) {
            showMiniStatblock(token, rawX, rawY);
          } else {
            hideMiniStatblock();
          }
        } else {
          hideMiniStatblock();
        }
      }
      return;
    }

    if (currentTool === "Select" && draggedToken) {
      if (x !== draggedPathEnd.x || y !== draggedPathEnd.y) {
         draggedPathEnd = { x, y };
         draggedPath = findPath(draggedToken.originalX, draggedToken.originalY, x, y, draggedToken);
      }

      // Redraw continuously so the dragged token follows the mouse
      drawCanvas();
      
      const sb = document.getElementById("mini-statblock");
      if (sb && sb.style.display === "block") {
        const containerRect = document.getElementById("vtt-canvas-container").getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        sb.style.left = (canvasRect.left - containerRect.left + (rawX * currentZoom) + 15) + "px";
        sb.style.top = (canvasRect.top - containerRect.top + (rawY * currentZoom) + 15) + "px";
      }
    } else if (currentTool === "Reveal" || currentTool === "Hide") {
      brushFog(x, y);
    }
  }

  function getTokenAllegiance(tokenObj) {
    if (!tokenObj) return "Unknown";
    if (tokenObj.charId) return "Player";
    const typeStr = typeof tokenObj === "string" ? tokenObj : tokenObj.type;
    if (typeStr === "Player Token") return "Player";
    if (typeStr === "NPC Token") return "NPC";
    return "Monster";
  }

  function getTokenReach(token) {
    if (!token || typeof token !== "object") return 5;
    let maxReach = 5;
    
    if (token.charId && window.BB_STATE) {
      const chars = window.BB_STATE.getSavedCharacters() || [];
      const char = chars.find(c => c.id === token.charId);
      if (char && char.equipment) {
        const items = window.BB_DATABASE && window.BB_DATABASE.ITEMS ? window.BB_DATABASE.ITEMS : [];
        const wNames = [char.equipment.mainHand, char.equipment.offHand].filter(Boolean);
        wNames.forEach(wName => {
          const item = items.find(i => i.name === wName);
          if (item && item.range) {
            let r = 5;
            const maxMatch = item.range.match(/\d+\/(\d+)\s*ft/i);
            if (!maxMatch) {
              const match = item.range.match(/(\d+)\s*ft/i);
              if (match) r = parseInt(match[1]);
            } else {
              r = 0; // Ranged weapons do not threaten
            }
            if (r > maxReach) maxReach = r;
          }
        });
      }
    } else if ((token.classId || token.monsterId) && window.BB_DATABASE && window.BB_DATABASE.MONSTERS) {
      const monsterName = token.classId || token.monsterId;
      const monster = window.BB_DATABASE.MONSTERS.find(m => m.name === monsterName);
      if (monster && monster.attacks) {
        monster.attacks.forEach(atk => {
          const match = atk.desc.match(/reach\s+(\d+)\s*ft/i);
          if (match) {
            const r = parseInt(match[1]);
            if (r > maxReach) maxReach = r;
          }
        });
      }
    }
    return maxReach;
  }

  function handleMouseUp(e) {
    if (!isInteracting) return;
    isInteracting = false;
    
    const { x, y, rawX, rawY } = getMouseCoords(e);
    const wasClick = mouseDownPos && mouseDownPos.x === x && mouseDownPos.y === y;
    mouseDownPos = null;

    if (wasClick && pendingInteract) {
      if (!selectedToken) {
        if (window.BB_DICE) window.BB_DICE.showToastNotification("No active token to interact with.");
      } else {
        const distance = Math.max(Math.abs(selectedToken.x - x), Math.abs(selectedToken.y - y)) * 5;
        if (distance > 5) {
          if (window.BB_DICE) window.BB_DICE.showToastNotification("Target is too far away to interact! (Must be adjacent)");
        } else {
          let interacted = false;
          
          // 1. Check for Doodads
          if (activeMap.doodads) {
             const doodad = activeMap.doodads.find(d => d.x === x && d.y === y);
             if (doodad) {
                if (window.BB_DICE) window.BB_DICE.showToastNotification(doodad.interactionText || "You examine the object, but find nothing of note.");
                interacted = true;
             }
          }
          
          // 2. Check for Tokens
          if (!interacted) {
             const targetToken = activeMap.tokens[y][x];
             if (targetToken && typeof targetToken === "object") {
                if (targetToken.currentHp !== undefined && targetToken.currentHp <= 0) {
                   if (window.BB_DICE) window.BB_DICE.showToastNotification("You search the corpse...");
                   interacted = true;
                } else if (targetToken.charId) {
                   const c = (window.BB_STATE.getSavedCharacters()||[]).find(ch => ch.id === targetToken.charId);
                   if (c && c.hp && c.hp.current <= 0) {
                      if (window.BB_DICE) window.BB_DICE.showToastNotification("You search the fallen companion...");
                      interacted = true;
                   } else {
                      if (window.BB_DICE) window.BB_DICE.showToastNotification("You interact with " + (c ? c.name : "them") + ".");
                      interacted = true;
                   }
                } else {
                   if (window.BB_DICE) window.BB_DICE.showToastNotification("You interact with the creature.");
                   interacted = true;
                }
             }
          }
          
          // 3. Check for Doors
          if (!interacted) {
             let minDoorDist = Infinity;
             let closestDoor = null;
             let closestDoorSegment = null;

             const pointToSegmentDist = (px, py, x1, y1, x2, y2) => {
               const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
               if (l2 === 0) return Math.hypot(px - x1, py - y1);
               let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
               t = Math.max(0, Math.min(1, t));
               return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
             };

             if (activeMap.doorsHorizontal) {
               for (let dy = 0; dy <= activeMap.height; dy++) {
                 for (let dx = 0; dx < activeMap.width; dx++) {
                   const door = activeMap.doorsHorizontal[dy][dx];
                   if (door) {
                     let x1 = dx * TILE_SIZE, y1 = dy * TILE_SIZE;
                     let x2 = x1 + TILE_SIZE, y2 = y1;
                     if (door.isOpen) {
                       x2 = x1 + TILE_SIZE * 0.7;
                       y2 = y1 - TILE_SIZE * 0.7;
                     }
                     const dist = pointToSegmentDist(rawX, rawY, x1, y1, x2, y2);
                     if (dist < minDoorDist) { 
                       minDoorDist = dist; 
                       closestDoor = door; 
                       closestDoorSegment = {x1, y1, x2, y2};
                     }
                   }
                 }
               }
             }
             
             if (activeMap.doorsVertical) {
               for (let dy = 0; dy < activeMap.height; dy++) {
                 for (let dx = 0; dx <= activeMap.width; dx++) {
                   const door = activeMap.doorsVertical[dy][dx];
                   if (door) {
                     let x1 = dx * TILE_SIZE, y1 = dy * TILE_SIZE;
                     let x2 = x1, y2 = y1 + TILE_SIZE;
                     if (door.isOpen) {
                       x2 = x1 + TILE_SIZE * 0.7;
                       y2 = y1 + TILE_SIZE * 0.7;
                     }
                     const dist = pointToSegmentDist(rawX, rawY, x1, y1, x2, y2);
                     if (dist < minDoorDist) { 
                       minDoorDist = dist; 
                       closestDoor = door; 
                       closestDoorSegment = {x1, y1, x2, y2};
                     }
                   }
                 }
               }
             }

             if (closestDoor && minDoorDist <= 12) {
               const px = selectedToken.x * TILE_SIZE + TILE_SIZE / 2;
               const py = selectedToken.y * TILE_SIZE + TILE_SIZE / 2;
               const distToPlayer = pointToSegmentDist(px, py, closestDoorSegment.x1, closestDoorSegment.y1, closestDoorSegment.x2, closestDoorSegment.y2);
               
               if (distToPlayer <= TILE_SIZE * 1.1) {
                 closestDoor.isOpen = !closestDoor.isOpen;
                 if (window.BB_DICE) window.BB_DICE.showToastNotification(closestDoor.isOpen ? "You open the door." : "You close the door.");
                 drawCanvas();
                 interacted = true;
               } else {
                 if (window.BB_DICE) window.BB_DICE.showToastNotification("That door is too far away to interact with.");
                 interacted = true;
               }
             }
          }
          
          if (!interacted) {
             if (window.BB_DICE) window.BB_DICE.showToastNotification("Nothing there to interact with.");
          }
        }
      }
      
      pendingInteract = false;
      document.getElementById("vtt-canvas-container").style.cursor = "default";
      if (draggedToken) {
        activeMap.tokens[draggedToken.originalY][draggedToken.originalX] = draggedToken.type;
        draggedToken = null;
      }
      drawCanvas();
      return;
    }

    if (wasClick && pendingAttack) {
      if (draggedToken) {
        activeMap.tokens[draggedToken.originalY][draggedToken.originalX] = draggedToken.type;
        draggedToken = null;
        drawCanvas();
      }
      
      const targetToken = activeMap.tokens[y][x];
      
      // Parse description for teleport AoE logic
      let atkDesc = "";
      if (pendingAttack.weaponName) {
         if (window.BB_DATABASE && window.BB_DATABASE.SPELLS) {
            const sp = window.BB_DATABASE.SPELLS.find(s => s.name === pendingAttack.weaponName);
            if (sp && sp.description) atkDesc = sp.description;
         }
         if (!atkDesc && pendingAttack.slot === "monster" && window.BB_DATABASE && window.BB_DATABASE.MONSTERS) {
            const mName = pendingAttack.token.classId || pendingAttack.token.monsterId;
            const m = window.BB_DATABASE.MONSTERS.find(m => m.name === mName);
            if (m) {
               const act = (m.actions || []).concat(m.attacks || []).find(a => a.name === pendingAttack.weaponName);
               if (act && act.desc) atkDesc = act.desc;
            }
         }
      }
      
      const isTeleportAoe = atkDesc.toLowerCase().includes("teleport to an unoccupied location");

      if (!targetToken && !isTeleportAoe) {
         if (window.BB_DICE) window.BB_DICE.showToastNotification("Targeting cancelled.");
         pendingAttack = null;
         document.getElementById("vtt-canvas-container").style.cursor = "default";
         return;
      }

      if (isTeleportAoe) {
         const distance = Math.max(Math.abs(selectedToken.x - x), Math.abs(selectedToken.y - y)) * 5;
         if (distance > 30) {
            if (window.BB_DICE) window.BB_DICE.showToastNotification("Target location is out of reach! (Max 30ft)");
            pendingAttack = null;
            document.getElementById("vtt-canvas-container").style.cursor = "default";
            drawCanvas();
            return;
         }
         
         if (targetToken && typeof targetToken === "object") {
            if (window.BB_DICE) window.BB_DICE.showToastNotification("You must target an unoccupied location.");
            pendingAttack = null;
            document.getElementById("vtt-canvas-container").style.cursor = "default";
            drawCanvas();
            return;
         }
         
         // Consume action
         const { rawChar, token: pendingToken } = pendingAttack;
         let sourceObj = rawChar || pendingToken;
         if (!sourceObj.combatState) sourceObj.combatState = {};
         sourceObj.combatState.action = true;
         if (rawChar) window.BB_STATE.saveCharacter(rawChar);
         
         // Gather targets around START
         let targets = [];
         for (let ty = 0; ty < activeMap.height; ty++) {
           for (let tx = 0; tx < activeMap.width; tx++) {
             if (tx === selectedToken.x && ty === selectedToken.y) continue;
             const t = activeMap.tokens[ty][tx];
             if (t && typeof t === "object") {
                const startDist = Math.max(Math.abs(tx - selectedToken.x), Math.abs(ty - selectedToken.y)) * 5;
                if (startDist <= 5) targets.push({x: tx, y: ty, token: t});
             }
           }
         }
         
         // Move token
         const movingToken = activeMap.tokens[selectedToken.y][selectedToken.x];
         activeMap.tokens[y][x] = movingToken;
         activeMap.tokens[selectedToken.y][selectedToken.x] = null;
         selectedToken.x = x;
         selectedToken.y = y;
         
         // Gather targets around END
         for (let ty = 0; ty < activeMap.height; ty++) {
           for (let tx = 0; tx < activeMap.width; tx++) {
             if (tx === x && ty === y) continue;
             const t = activeMap.tokens[ty][tx];
             if (t && typeof t === "object") {
                const endDist = Math.max(Math.abs(tx - x), Math.abs(ty - y)) * 5;
                if (endDist <= 5) {
                   if (!targets.some(tgt => tgt.x === tx && tgt.y === ty)) {
                      targets.push({x: tx, y: ty, token: t});
                   }
                }
             }
           }
         }
         
         if (targets.length === 0) {
             if (window.BB_DICE) window.BB_DICE.showToastNotification("You teleport, but no creatures are caught in the rift.");
         } else {
             const attackerTokenCache = { x: x, y: y, token: movingToken };
             targets.forEach(tgt => {
                combatAttacker = Object.assign({}, attackerTokenCache);
                combatTarget = tgt;
                executeSaveAction(pendingAttack.saveStat, pendingAttack.saveDc, `${pendingAttack.count}d${pendingAttack.type} ${pendingAttack.dmgType}`, pendingAttack.weaponName);
             });
         }
         
         pendingAttack = null;
         document.getElementById("vtt-canvas-container").style.cursor = "default";
         drawCanvas();
         renderSelectedTokenInfo();
         return;
      }

      if (targetToken) {
        const distance = Math.max(Math.abs(selectedToken.x - x), Math.abs(selectedToken.y - y)) * 5;
        
        let shortRange = 5;
        let longRange = 5;
        
        if (pendingAttack.weaponName && window.BB_DATABASE && window.BB_DATABASE.ITEMS) {
          const item = window.BB_DATABASE.ITEMS.find(i => i.name === pendingAttack.weaponName);
          if (item && item.range) {
            const maxMatch = item.range.match(/(\d+)\/(\d+)\s*ft/i);
            if (maxMatch) {
              shortRange = parseInt(maxMatch[1]);
              longRange = parseInt(maxMatch[2]);
            } else {
              const match = item.range.match(/(\d+)\s*ft/i);
              if (match) {
                shortRange = parseInt(match[1]);
                longRange = shortRange;
              }
            }
          }
        }

        // Parse range for monster actions/abilities
        if (pendingAttack.slot === "monster" && window.BB_DATABASE.MONSTERS) {
           const monsterName = pendingAttack.token.classId || pendingAttack.token.monsterId;
           const m = window.BB_DATABASE.MONSTERS.find(m => m.name === monsterName);
           if (m) {
              const atkList = (m.attacks || []).concat(m.actions || []);
              const atkInfo = atkList.find(a => a.name === pendingAttack.weaponName);
              if (atkInfo && atkInfo.desc) {
                 const rMatch = atkInfo.desc.match(/reach\s+(\d+)\s*ft|range\s+(?:of\s+)?(\d+)\s*ft|within\s+(\d+)\s*f[e]*t/i);
                 if (rMatch) {
                    const r = parseInt(rMatch[1] || rMatch[2] || rMatch[3]);
                    shortRange = r;
                    longRange = r;
                 }
              }
           }
        }
        
        let advMode = 0;
        if (distance > longRange) {
          if (window.BB_DICE) window.BB_DICE.showToastNotification(`Target is out of reach! (Distance: ${distance}ft, Max Range: ${longRange}ft)`);
          pendingAttack = null;
          document.getElementById("vtt-canvas-container").style.cursor = "default";
          return;
        } else {
          if (distance > shortRange && distance <= longRange) {
            advMode = -1; // Disadvantage
          }
          
          // Consume action and roll
          const { rawChar, token: pendingToken, label, count, type, mod, slot, grip, critRange } = pendingAttack;
          let sourceObj = rawChar || pendingToken;
          if (!sourceObj.combatState) sourceObj.combatState = {};
          if (slot === "offHand" && grip === "Dual") {
            sourceObj.combatState.bonusAction = true;
          } else {
            sourceObj.combatState.action = true;
          }
          if (rawChar) window.BB_STATE.saveCharacter(rawChar);
          renderSelectedTokenInfo();
          
          let targetName = "Target";
          if (typeof targetToken === "string") {
            targetName = targetToken;
          } else if (targetToken.charId) {
            const chars = window.BB_STATE.getSavedCharacters() || [];
            const tChar = chars.find(c => c.id === targetToken.charId);
            if (tChar) targetName = tChar.name;
          } else if (targetToken.classId || targetToken.monsterId) {
            targetName = targetToken.classId || targetToken.monsterId;
          }
          
          let finalCritRange = critRange;
          let finalLabel = label;
          
          // Exploit Check: Melee Attack && Engaged (Distance 5) && Target Threatened by Ally
          if (shortRange === longRange && distance === 5) {
            const attackerToken = activeMap.tokens[selectedToken.y][selectedToken.x];
            const myAllegiance = getTokenAllegiance(attackerToken);
            let isThreatened = false;
            
            for (let ty = 0; ty < activeMap.height; ty++) {
              for (let tx = 0; tx < activeMap.width; tx++) {
                const otherToken = activeMap.tokens[ty][tx];
                if (otherToken && typeof otherToken === "object") {
                  // Skip attacker and target
                  if ((tx === selectedToken.x && ty === selectedToken.y) || (tx === x && ty === y)) continue;
                  
                  if (getTokenAllegiance(otherToken) === myAllegiance) {
                    const distToTarget = Math.max(Math.abs(tx - x), Math.abs(ty - y)) * 5;
                    const otherReach = getTokenReach(otherToken);
                    if (distToTarget <= otherReach) {
                      isThreatened = true;
                      break;
                    }
                  }
                }
              }
              if (isThreatened) break;
            }
            if (isThreatened) {
              finalCritRange += 1;
              finalLabel += " (Exploit!)";
            }
          }
          
          if (pendingAttack.isSave) {
             // Handle as a Saving Throw
             combatAttacker = { x: selectedToken.x, y: selectedToken.y, token: activeMap.tokens[selectedToken.y][selectedToken.x] };
             combatTarget = { x, y, token: targetToken };
             executeSaveAction(pendingAttack.saveStat, pendingAttack.saveDc, `${pendingAttack.count}d${pendingAttack.type} ${pendingAttack.dmgType}`, pendingAttack.weaponName);
             pendingAttack = null;
             document.getElementById("vtt-canvas-container").style.cursor = "default";
             drawCanvas();
             return;
          }

          if (window.BB_DICE) {
            const attackWeaponName = pendingAttack.weaponName;
            const attackDmgType = pendingAttack.dmgType;
            const attackerRawChar = rawChar;
            const attackerToken = pendingToken;
            
            let onComplete = (totalDamage) => {
              // Determine Damage Type
              let dmgType = attackDmgType || "Physical";
              if (!attackDmgType && attackWeaponName && window.BB_DATABASE && window.BB_DATABASE.ITEMS) {
                 const item = window.BB_DATABASE.ITEMS.find(i => i.name === attackWeaponName);
                 if (item && item.damageType) dmgType = item.damageType;
              }
              
              const magicalTypes = ["air", "earth", "fire", "ice", "lightning", "thunder", "water", "elemental", "dark", "holy", "magic", "nature", "divine"];
              let isMagical = false;
              for (let t of magicalTypes) {
                if (dmgType.toLowerCase().includes(t)) {
                  isMagical = true;
                  break;
                }
              }

              // Target Stats
              let tgtDef = 0;
              let tgtRes = 0;
              let tgtResStr = "";
              let tgtVulnStr = "";
              let isPlayer = false;
              let targetRawChar = null;

              if (targetToken.charId) {
                const chars = window.BB_STATE.getSavedCharacters() || [];
                targetRawChar = chars.find(c => c.id === targetToken.charId);
                if (targetRawChar) {
                  isPlayer = true;
                  const hydratedTarget = hydrateCharacterStats(targetRawChar);
                  tgtDef = hydratedTarget.defense || 0;
                  tgtRes = hydratedTarget.resilience || 0;
                  tgtResStr = (targetRawChar.resistances || []).join(", ").toLowerCase();
                  tgtVulnStr = (targetRawChar.vulnerabilities || []).join(", ").toLowerCase();
                }
              } else {
                tgtDef = targetToken.defense || 0;
                tgtRes = targetToken.resilience || 0;
                tgtResStr = typeof targetToken.resistances === "string" ? targetToken.resistances.toLowerCase() : (targetToken.resistances || []).join(", ").toLowerCase();
                tgtVulnStr = typeof targetToken.vulnerabilities === "string" ? targetToken.vulnerabilities.toLowerCase() : (targetToken.vulnerabilities || []).join(", ").toLowerCase();
              }

              // 1. Mitigation
              let mitigation = isMagical ? tgtRes : tgtDef;
              let finalDamage = Math.max(0, totalDamage - mitigation);

              // 2. Elemental Affinities
              let isResistant = false;
              let isVulnerable = false;
              if (dmgType.toLowerCase() !== "physical") {
                 isResistant = tgtResStr.includes(dmgType.toLowerCase());
                 isVulnerable = tgtVulnStr.includes(dmgType.toLowerCase());
              }

              if (isResistant && isVulnerable) {
                // Cancel out
              } else if (isResistant) {
                finalDamage = Math.floor(finalDamage / 2);
              } else if (isVulnerable) {
                finalDamage += Math.ceil(finalDamage / 2);
              }

              // 3. Apply HP
              if (isPlayer && targetRawChar) {
                targetRawChar.hp.current = Math.max(0, targetRawChar.hp.current - finalDamage);
                window.BB_STATE.saveCharacter(targetRawChar);
              } else if (targetToken) {
                targetToken.currentHp = Math.max(0, targetToken.currentHp - finalDamage);
                if (window.BB_STATE.saveSession) window.BB_STATE.saveSession();
              }
              
              drawCanvas();
              renderSelectedTokenInfo();

              // Notify
              let notif = `[Damage Applied] ${targetName} took ${finalDamage} damage!`;
              let subNotifs = [];
              if (mitigation > 0) subNotifs.push(`Mitigated ${mitigation} via ${isMagical ? "Resilience" : "Defense"}`);
              if (isResistant && !isVulnerable) subNotifs.push(`Resisted ${dmgType}`);
              if (isVulnerable && !isResistant) subNotifs.push(`Vulnerable to ${dmgType}`);
              if (subNotifs.length > 0) notif += ` (${subNotifs.join(", ")})`;
              
              setTimeout(() => {
                window.BB_DICE.showToastNotification(notif);
                window.BB_STATE.addDiceRoll("Combat Resolution", 0, 0, 0, 0, notif);
                
                // Slime Passive: Acidic Dissolution
                if (targetToken && targetToken.monsterId === "Slime" && distance <= 5) {
                  let isMelee = false;
                  if (attackWeaponName && window.BB_DATABASE && window.BB_DATABASE.ITEMS) {
                     let w = window.BB_DATABASE.ITEMS.find(i=>i.name===attackWeaponName);
                     if (w && (!w.properties || !w.properties.includes("Ranged"))) isMelee = true;
                  }
                  if (!attackWeaponName) isMelee = true; // Default monster attacks to melee if at 5ft
                  
                  if (isMelee) {
                    let atkName = attackerRawChar ? attackerRawChar.name : (attackerToken ? (attackerToken.monsterId || "Attacker") : "Attacker");
                    setTimeout(() => {
                       window.BB_DICE.showToastNotification(`Acidic Dissolution triggered! Slime deals 1d6 Nature damage to ${atkName}...`);
                       let onAdComplete = (adDmg) => {
                          let attackerRes = 0;
                          if (attackerRawChar) {
                            attackerRes = hydrateCharacterStats(attackerRawChar).resilience || 0;
                          } else if (attackerToken) {
                            attackerRes = attackerToken.resilience || 0;
                          }
                          let finalAdDmg = Math.max(0, adDmg - attackerRes);
                          
                          if (attackerRawChar) {
                            attackerRawChar.hp.current = Math.max(0, attackerRawChar.hp.current - finalAdDmg);
                            window.BB_STATE.saveCharacter(attackerRawChar);
                          } else if (attackerToken) {
                            attackerToken.currentHp = Math.max(0, attackerToken.currentHp - finalAdDmg);
                            if (window.BB_STATE.saveSession) window.BB_STATE.saveSession();
                          }
                          drawCanvas();
                          renderSelectedTokenInfo();
                          
                          let adNotif = `[Acidic Dissolution] ${atkName} took ${finalAdDmg} damage! (Mitigated ${Math.min(adDmg, attackerRes)} via Resilience)`;
                          setTimeout(() => {
                             window.BB_DICE.showToastNotification(adNotif);
                             window.BB_STATE.addDiceRoll("Passive Resolution", 0, 0, 0, 0, adNotif);
                          }, 600);
                       };
                       window.BB_DICE.roll(`Acidic Dissolution vs ${atkName}`, 1, 6, 0, 0, 0, true, "Single", 0, "", false, onAdComplete);
                       setTimeout(renderDiceHistory, 1000);
                    }, 1000);
                  }
                }
              }, 600);
            };

            window.BB_DICE.roll(`${finalLabel} vs ${targetName}`, count, type, mod, advMode, finalCritRange, true, grip, 0, "", false, onComplete); 
            setTimeout(renderDiceHistory, 1000);
          }
        }
      } else {
        if (window.BB_DICE) window.BB_DICE.showToastNotification("Attack cancelled.");
      }
      
      if (draggedToken) {
        activeMap.tokens[draggedToken.originalY][draggedToken.originalX] = draggedToken.type;
        draggedToken = null;
      }
      pendingAttack = null;
      document.getElementById("vtt-canvas-container").style.cursor = "default";
      drawCanvas();
      return;
    }

    if (currentTool === "Select" && draggedToken) {
      document.getElementById("vtt-canvas-container").style.cursor = "pointer";

      if (wasClick) {
        // Put the token back — this was a click, not a drag
        activeMap.tokens[draggedToken.originalY][draggedToken.originalX] = draggedToken.type;
        draggedToken = null;

        // Select/deselect the token
        const token = activeMap.tokens[y][x];
        if (token && typeof token === "object") {
          if (selectedToken && selectedToken.x === x && selectedToken.y === y) {
            // Clicking same token deselects
            selectedToken = null;
          } else {
            selectedToken = { x, y };
          }
        } else {
          selectedToken = null;
        }
        renderSelectedTokenInfo();
        drawCanvas();
        return;
      }
      
      let distance = 0;
      let allowedMovement = true;
      let sourceObj = null;
      let rawChar = null;
      let hasOA = false;
      
      if (typeof draggedToken.type === "object") {
        if (draggedToken.type.charId) {
          rawChar = (window.BB_STATE.getSavedCharacters() || []).find(c => c.id === draggedToken.type.charId);
          sourceObj = rawChar || draggedToken.type;
        } else if (draggedToken.type.monsterId) {
          sourceObj = draggedToken.type;
        }
      }

      if (draggedPath) {
         for (const node of draggedPath) {
            distance += node.isDifficult ? 10 : 5;
            if (node.provokesOA) hasOA = true;
         }
      } else {
         allowedMovement = false; // Blocked or invalid path
      }

      if (sourceObj && allowedMovement) {
        if (sourceObj.movementRemaining !== undefined && distance > sourceObj.movementRemaining) {
          allowedMovement = false;
          if (window.BB_DICE) window.BB_DICE.showToastNotification("Not enough movement remaining!");
        }
      }

      // Drop token
      if (allowedMovement && x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
        // Only drop if space is empty AND passable
        if (!activeMap.tokens[y][x] && !(activeMap.collision && activeMap.collision[y][x])) {
          if (sourceObj) {
            sourceObj.movementRemaining -= distance;
            if (sourceObj.movementRemaining <= 0) {
              sourceObj.movementRemaining = 0;
              if (!sourceObj.combatState) sourceObj.combatState = {};
              sourceObj.combatState.movement = true;
              if (rawChar) {
                 window.BB_STATE.saveCharacter(rawChar);
              }
            }
          }
          activeMap.tokens[y][x] = draggedToken.type;
          
          if (hasOA && window.BB_DICE) {
             window.BB_DICE.showToastNotification("Movement provoked an Opportunity Attack!");
          }

          // Update selection to follow the token
          if (selectedToken && selectedToken.x === draggedToken.originalX && selectedToken.y === draggedToken.originalY) {
            selectedToken = { x, y };
            renderSelectedTokenInfo();
          }
        } else {
          // Space occupied or impassable, bounce back
          activeMap.tokens[draggedToken.originalY][draggedToken.originalX] = draggedToken.type;
        }
      } else {
        // Dropped out of bounds or out of movement, bounce back
        activeMap.tokens[draggedToken.originalY][draggedToken.originalX] = draggedToken.type;
      }
      
      draggedToken = null;
      drawCanvas();
      
      // Re-evaluate hover immediately
      if (x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
        const token = activeMap.tokens[y][x];
        if (token && typeof token === "object" && (token.charId || token.monsterId)) {
          showMiniStatblock(token, rawX, rawY);
        } else {
          hideMiniStatblock();
        }
      } else {
        hideMiniStatblock();
      }
    } else if (currentTool === "Select" && !draggedToken) {
      // Clicked on empty space — deselect
      const { x, y } = getMouseCoords(e);
      if (x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
        if (!activeMap.tokens[y][x]) {
          selectedToken = null;
          renderSelectedTokenInfo();
          drawCanvas();
        }
      }
      mouseDownPos = null;
    }
  }

  function parseSize(sizeStr) {
    if (!sizeStr) return 3;
    const s = sizeStr.toLowerCase();
    if (s.includes("tiny")) return 1;
    if (s.includes("small")) return 2;
    if (s.includes("medium")) return 3;
    if (s.includes("large")) return 4;
    if (s.includes("huge")) return 5;
    if (s.includes("gargantuan")) return 6;
    return 3;
  }

  function findPath(startX, startY, endX, endY, draggedToken) {
    if (startX === endX && startY === endY) return [];

    const moverAllegiance = getTokenAllegiance(draggedToken.type);
    let moverSize = 3;
    if (typeof draggedToken.type === "object") {
       if (draggedToken.type.charId) {
          const c = (window.BB_STATE.getSavedCharacters()||[]).find(x => x.id === draggedToken.type.charId);
          if (c) moverSize = parseSize(c.size);
       } else if (draggedToken.type.monsterId) {
          const m = window.BB_DATABASE.MONSTERS.find(x => x.name === draggedToken.type.monsterId);
          if (m) moverSize = parseSize(m.size);
       }
    }

    const hostiles = [];
    for (let ty = 0; ty < activeMap.height; ty++) {
       for (let tx = 0; tx < activeMap.width; tx++) {
          const hToken = activeMap.tokens[ty][tx];
          if (hToken && typeof hToken === "object" && getTokenAllegiance(hToken) !== moverAllegiance) {
             hostiles.push({ x: tx, y: ty, reach: getTokenReach(hToken) / 5 });
          }
       }
    }

    const openSet = [];
    const closedSet = new Set();
    const nodeMap = new Map();

    const startNode = { x: startX, y: startY, g: 0, h: Math.max(Math.abs(startX - endX), Math.abs(startY - endY)), f: 0, parent: null, isDifficult: false, provokesOA: false };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);
    nodeMap.set(`${startX},${startY}`, startNode);

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();

      if (current.x === endX && current.y === endY) {
         const path = [];
         let curr = current;
         while (curr.parent) {
            path.unshift({ x: curr.x, y: curr.y, provokesOA: curr.provokesOA, isDifficult: curr.isDifficult });
            curr = curr.parent;
         }
         return path;
      }

      closedSet.add(`${current.x},${current.y}`);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = current.x + dx;
          const ny = current.y + dy;

          if (nx < 0 || nx >= activeMap.width || ny < 0 || ny >= activeMap.height) continue;
          if (activeMap.collision && activeMap.collision[ny][nx]) continue;

          // Orthogonal Edge Wall Checks
          if (dx === 1 && dy === 0 && activeMap.wallsVertical && activeMap.wallsVertical[current.y][current.x + 1]) continue;
          if (dx === -1 && dy === 0 && activeMap.wallsVertical && activeMap.wallsVertical[current.y][current.x]) continue;
          if (dx === 0 && dy === 1 && activeMap.wallsHorizontal && activeMap.wallsHorizontal[current.y + 1][current.x]) continue;
          if (dx === 0 && dy === -1 && activeMap.wallsHorizontal && activeMap.wallsHorizontal[current.y][current.x]) continue;

          // Orthogonal Edge Door Checks
          if (dx === 1 && dy === 0 && activeMap.doorsVertical && activeMap.doorsVertical[current.y][current.x + 1] && !activeMap.doorsVertical[current.y][current.x + 1].isOpen) continue;
          if (dx === -1 && dy === 0 && activeMap.doorsVertical && activeMap.doorsVertical[current.y][current.x] && !activeMap.doorsVertical[current.y][current.x].isOpen) continue;
          if (dx === 0 && dy === 1 && activeMap.doorsHorizontal && activeMap.doorsHorizontal[current.y + 1][current.x] && !activeMap.doorsHorizontal[current.y + 1][current.x].isOpen) continue;
          if (dx === 0 && dy === -1 && activeMap.doorsHorizontal && activeMap.doorsHorizontal[current.y][current.x] && !activeMap.doorsHorizontal[current.y][current.x].isOpen) continue;

          // No Cut Rule: Cannot move diagonally if an adjacent orthogonal square or intersection corner is blocked
          if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
             let blocked = false;
             // 1. Tile Collision
             if (activeMap.collision && activeMap.collision[current.y][current.x + dx]) blocked = true;
             if (activeMap.collision && activeMap.collision[current.y + dy][current.x]) blocked = true;
             
             // 2. Edge Wall Corners
             const cx = current.x + (dx === 1 ? 1 : 0);
             const cy = current.y + (dy === 1 ? 1 : 0);
             if (activeMap.wallsHorizontal) {
                if (cx - 1 >= 0 && cx - 1 < activeMap.width && activeMap.wallsHorizontal[cy] && activeMap.wallsHorizontal[cy][cx - 1]) blocked = true;
                if (cx >= 0 && cx < activeMap.width && activeMap.wallsHorizontal[cy] && activeMap.wallsHorizontal[cy][cx]) blocked = true;
             }
             if (activeMap.wallsVertical) {
                if (cy - 1 >= 0 && cy - 1 < activeMap.height && activeMap.wallsVertical[cy - 1] && activeMap.wallsVertical[cy - 1][cx]) blocked = true;
                if (cy >= 0 && cy < activeMap.height && activeMap.wallsVertical[cy] && activeMap.wallsVertical[cy][cx]) blocked = true;
             }
             if (activeMap.doorsHorizontal) {
                if (cx - 1 >= 0 && cx - 1 < activeMap.width && activeMap.doorsHorizontal[cy] && activeMap.doorsHorizontal[cy][cx - 1] && !activeMap.doorsHorizontal[cy][cx - 1].isOpen) blocked = true;
                if (cx >= 0 && cx < activeMap.width && activeMap.doorsHorizontal[cy] && activeMap.doorsHorizontal[cy][cx] && !activeMap.doorsHorizontal[cy][cx].isOpen) blocked = true;
             }
             if (activeMap.doorsVertical) {
                if (cy - 1 >= 0 && cy - 1 < activeMap.height && activeMap.doorsVertical[cy - 1] && activeMap.doorsVertical[cy - 1][cx] && !activeMap.doorsVertical[cy - 1][cx].isOpen) blocked = true;
                if (cy >= 0 && cy < activeMap.height && activeMap.doorsVertical[cy] && activeMap.doorsVertical[cy][cx] && !activeMap.doorsVertical[cy][cx].isOpen) blocked = true;
             }

             if (blocked) continue;
          }

          let isDifficult = false;
          let passable = true;
          let provokesOA = false;
          const otherToken = activeMap.tokens[ny][nx];

          if (otherToken && typeof otherToken === "object") {
             if (nx === draggedToken.originalX && ny === draggedToken.originalY) {
                // Ignore self
             } else {
                isDifficult = true;
                const otherAllegiance = getTokenAllegiance(otherToken);
                let otherSize = 3;
                if (otherToken.monsterId) {
                   const m = window.BB_DATABASE.MONSTERS.find(x => x.name === otherToken.monsterId);
                   if (m) otherSize = parseSize(m.size);
                } else if (otherToken.charId) {
                   const c = (window.BB_STATE.getSavedCharacters()||[]).find(x => x.id === otherToken.charId);
                   if (c) otherSize = parseSize(c.size);
                }

                if (otherAllegiance !== moverAllegiance) {
                   if (otherSize === 1 || Math.abs(moverSize - otherSize) >= 2) {
                      passable = true;
                   } else {
                      passable = false;
                   }
                }
             }
          }

          if (!passable) continue;

          let threatenedAtCurrent = false;
          for (const h of hostiles) {
              const distToCurrent = Math.max(Math.abs(h.x - current.x), Math.abs(h.y - current.y));
              if (distToCurrent <= h.reach) {
                 threatenedAtCurrent = true;
                 break;
              }
          }
          if (threatenedAtCurrent) provokesOA = true;

          const isDiagonal = dx !== 0 && dy !== 0;
          const baseCost = isDiagonal ? 1.001 : 1;
          const gCost = current.g + (isDifficult ? baseCost * 2 : baseCost);
          
          // Use slight Euclidean tie-breaker in heuristic to prefer straight lines
          const dxEnd = Math.abs(nx - endX);
          const dyEnd = Math.abs(ny - endY);
          const hCost = Math.max(dxEnd, dyEnd) + 0.0001 * Math.sqrt(dxEnd*dxEnd + dyEnd*dyEnd);
          const fCost = gCost + hCost;

          const neighborId = `${nx},${ny}`;
          if (closedSet.has(neighborId)) continue;

          let neighborNode = nodeMap.get(neighborId);
          if (!neighborNode) {
             neighborNode = { x: nx, y: ny, g: gCost, h: hCost, f: fCost, parent: current, isDifficult, provokesOA };
             openSet.push(neighborNode);
             nodeMap.set(neighborId, neighborNode);
          } else if (gCost < neighborNode.g) {
             neighborNode.g = gCost;
             neighborNode.f = fCost;
             neighborNode.parent = current;
             neighborNode.isDifficult = isDifficult;
             neighborNode.provokesOA = provokesOA;
          }
        }
      }
    }
    return null;
  }

  function drawCanvas() {
    if (!canvas || !ctx || !activeMap) return;

    // Adjust canvas dimensions for zoom
    canvas.width = activeMap.width * TILE_SIZE * currentZoom;
    canvas.height = activeMap.height * TILE_SIZE * currentZoom;

    ctx.save();
    ctx.scale(currentZoom, currentZoom);

    ctx.clearRect(0, 0, activeMap.width * TILE_SIZE, activeMap.height * TILE_SIZE);
    ctx.fillStyle = "#111"; // Deep black background for out of bounds/base
    ctx.fillRect(0, 0, activeMap.width * TILE_SIZE, activeMap.height * TILE_SIZE);

    // 1. Draw Tiles
    for (let y = 0; y < activeMap.height; y++) {
      for (let x = 0; x < activeMap.width; x++) {
        const tileType = activeMap.tiles[y][x];
        if (tileType) {
          if (typeof tileType === "object" && tileType.assetId) {
             const assetMeta = window.BB_ASSETS ? window.BB_ASSETS.getAsset(tileType.assetId) : null;
             if (assetMeta && assetMeta.isAutotile) {
                const auto = window.BB_ASSETS.calculateAutotile(activeMap, x, y, tileType.assetId);
                if (auto && auto.img) {
                   ctx.drawImage(auto.img, auto.sx, auto.sy, auto.sw, auto.sh, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
             } else {
                const img = window.BB_ASSETS ? window.BB_ASSETS.getImage(tileType.assetId) : null;
                if (img) {
                   ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else {
                   ctx.fillStyle = "#ff00ff";
                   ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
             }
          } else if (typeof tileType === "string" && TOOLS[tileType]) {
             ctx.fillStyle = TOOLS[tileType];
             ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    // 2. Draw Grid
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= activeMap.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_SIZE, 0);
      ctx.lineTo(x * TILE_SIZE, activeMap.height * TILE_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= activeMap.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_SIZE);
      ctx.lineTo(activeMap.width * TILE_SIZE, y * TILE_SIZE);
      ctx.stroke();
    }

    // Draw Edge Walls
    ctx.strokeStyle = "#212529";
    ctx.lineWidth = 4;
    if (activeMap.wallsHorizontal) {
       for (let y = 0; y <= activeMap.height; y++) {
          for (let x = 0; x < activeMap.width; x++) {
             if (activeMap.wallsHorizontal[y][x]) {
                ctx.beginPath();
                ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE);
                ctx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE);
                ctx.stroke();
             }
          }
       }
    }
    if (activeMap.wallsVertical) {
       for (let y = 0; y < activeMap.height; y++) {
          for (let x = 0; x <= activeMap.width; x++) {
             if (activeMap.wallsVertical[y][x]) {
                ctx.beginPath();
                ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE);
                ctx.lineTo(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
                ctx.stroke();
             }
          }
       }
    }

    // Draw Edge Doors
    ctx.lineWidth = 4;
    if (activeMap.doorsHorizontal) {
       for (let y = 0; y <= activeMap.height; y++) {
          for (let x = 0; x < activeMap.width; x++) {
             const door = activeMap.doorsHorizontal[y][x];
             if (door) {
                ctx.strokeStyle = door.isMagicallyLocked ? "#7b1fa2" : (door.isLocked ? "#d32f2f" : "#8B4513");
                ctx.beginPath();
                if (door.isOpen) {
                   ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE);
                   ctx.lineTo(x * TILE_SIZE + TILE_SIZE * 0.7, y * TILE_SIZE - TILE_SIZE * 0.7);
                } else {
                   ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE);
                   ctx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE);
                }
                ctx.stroke();
             }
          }
       }
    }
    if (activeMap.doorsVertical) {
       for (let y = 0; y < activeMap.height; y++) {
          for (let x = 0; x <= activeMap.width; x++) {
             const door = activeMap.doorsVertical[y][x];
             if (door) {
                ctx.strokeStyle = door.isMagicallyLocked ? "#7b1fa2" : (door.isLocked ? "#d32f2f" : "#8B4513");
                ctx.beginPath();
                if (door.isOpen) {
                   ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE);
                   ctx.lineTo(x * TILE_SIZE + TILE_SIZE * 0.7, y * TILE_SIZE + TILE_SIZE * 0.7);
                } else {
                   ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE);
                   ctx.lineTo(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
                }
                ctx.stroke();
             }
          }
       }
    }

    // Draw Doodads
    if (activeMap.doodads) {
      activeMap.doodads.forEach(d => {
        const img = window.BB_ASSETS ? window.BB_ASSETS.getImage(d.assetId) : null;
        if (img) {
          ctx.drawImage(img, d.x * TILE_SIZE, d.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      });
    }

    // 3. Draw Placed Tokens
    for (let y = 0; y < activeMap.height; y++) {
      for (let x = 0; x < activeMap.width; x++) {
        const token = activeMap.tokens[y][x];
        if (token) {
          drawTokenAt(token, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);
          
          // Draw Active Turn Highlight (golden ring)
          if (initiativeOrder.length > 0 && initiativeOrder[currentTurnIndex]) {
             const activeEntry = initiativeOrder[currentTurnIndex];
             if (activeEntry.token === token) {
                ctx.strokeStyle = "rgba(255, 193, 7, 0.8)";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2 + 2, 0, Math.PI * 2);
                ctx.stroke();
             }
          }

          // Draw Selected Token Highlight (white outline)
          if (selectedToken && selectedToken.x === x && selectedToken.y === y) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2 - 1, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Draw Combat Highlights
          if (currentTool === "Combat") {
            if (combatAttacker && combatAttacker.x === x && combatAttacker.y === y) {
              ctx.strokeStyle = "#4dabf7";
              ctx.lineWidth = 3;
              ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
            if (combatTarget && combatTarget.x === x && combatTarget.y === y) {
              ctx.strokeStyle = "#ff6b6b";
              ctx.lineWidth = 3;
              ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
          }
        }
      }
    }

    // 4. Draw Dragged Token
      if (draggedToken) {
        ctx.globalAlpha = 0.8;
        drawTokenAt(draggedToken.type, mousePos.x, mousePos.y);
        ctx.globalAlpha = 1.0;
  
        // Path rendering
        if (draggedPath && draggedPath.length > 0) {
          ctx.beginPath();
          const origCx = draggedToken.originalX * TILE_SIZE + TILE_SIZE / 2;
          const origCy = draggedToken.originalY * TILE_SIZE + TILE_SIZE / 2;
          ctx.moveTo(origCx, origCy);

          let totalCost = 0;
          let hasOA = false;
          let lastPoint = { x: origCx, y: origCy };

          for (const node of draggedPath) {
             const nx = node.x * TILE_SIZE + TILE_SIZE / 2;
             const ny = node.y * TILE_SIZE + TILE_SIZE / 2;
             ctx.lineTo(nx, ny);
             totalCost += (node.isDifficult ? 10 : 5);
             if (node.provokesOA) hasOA = true;
             lastPoint = { x: nx, y: ny };
          }
          
          ctx.strokeStyle = hasOA ? "rgba(255, 100, 100, 0.8)" : "rgba(255, 255, 255, 0.6)";
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw OA highlights
          for (const node of draggedPath) {
             if (node.provokesOA) {
                const nx = node.x * TILE_SIZE + TILE_SIZE / 2;
                const ny = node.y * TILE_SIZE + TILE_SIZE / 2;
                ctx.fillStyle = "rgba(255, 50, 50, 0.6)";
                ctx.beginPath();
                ctx.arc(nx, ny, 6, 0, Math.PI * 2);
                ctx.fill();
             }
          }

          ctx.fillStyle = hasOA ? "#ff6b6b" : "#fff";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(totalCost + " ft", lastPoint.x + 37, lastPoint.y - 15);
        } else {
           // Invalid Path (Blocked)
           ctx.fillStyle = "#ff6b6b";
           ctx.font = "bold 12px sans-serif";
           ctx.textAlign = "center";
           ctx.textBaseline = "middle";
           ctx.fillText("Blocked", mousePos.x + 37, mousePos.y - 15);
        }
      }

    // 5. Draw Fog of War
    ctx.fillStyle = "rgba(0,0,0,0.95)";
    for (let y = 0; y < activeMap.height; y++) {
      for (let x = 0; x < activeMap.width; x++) {
        if (activeMap.fog[y][x]) {
          // If DM is hovering over a fog tile, maybe show it slightly lighter? No, keep it solid for now.
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
    
    ctx.restore();
  }

  function drawTokenAt(tokenObj, centerX, centerY) {
    let isDead = false;
    if (typeof tokenObj === "object") {
       if (tokenObj.currentHp !== undefined && tokenObj.currentHp <= 0) {
          isDead = true;
       } else if (tokenObj.charId) {
          const rawChar = (window.BB_STATE.getSavedCharacters() || []).find(c => c.id === tokenObj.charId);
          if (rawChar && rawChar.hp && rawChar.hp.current <= 0) {
             isDead = true;
          }
       }
    }

    if (isDead) {
       ctx.globalAlpha = 0.4;
    }

    if (typeof tokenObj === "object" && tokenObj.assetId) {
       const img = window.BB_ASSETS ? window.BB_ASSETS.getImage(tokenObj.assetId) : null;
       if (img) {
          ctx.drawImage(img, centerX - TILE_SIZE/2, centerY - TILE_SIZE/2, TILE_SIZE, TILE_SIZE);
       } else {
          ctx.fillStyle = "#ff00ff";
          ctx.beginPath();
          ctx.arc(centerX, centerY, TILE_SIZE/2 - 4, 0, Math.PI * 2);
          ctx.fill();
       }
       if (isDead) ctx.globalAlpha = 1.0;
       return;
    }
    
    const typeStr = typeof tokenObj === "string" ? tokenObj : tokenObj.type;
    if (typeStr === "Player Token") {
       ctx.fillStyle = "#4dabf7";
    } else if (typeStr === "Enemy Token" || typeStr === "Monster Token") {
       ctx.fillStyle = "#ff6b6b";
    } else if (typeStr === "NPC Token") {
       ctx.fillStyle = "#fcc419";
    } else {
       ctx.fillStyle = "#fff";
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, TILE_SIZE/2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (typeof tokenObj === "object" && tokenObj.initial) {
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tokenObj.initial, centerX, centerY + 1);
    }

    if (isDead) {
       ctx.globalAlpha = 1.0;
    }
  }

  function saveVTTState() {
    window.BB_STATE.saveMap(activeMap);
    alert("Session saved successfully!");
  }

  function renderSelectedTokenInfo() {
    const infoPanel = document.getElementById("vtt-selected-info");
    if (!infoPanel) return;

    if (!selectedToken) {
      infoPanel.style.display = "none";
      infoPanel.innerHTML = "";
      renderVttCombatPanel();
      return;
    }

    const token = activeMap.tokens[selectedToken.y][selectedToken.x];
    if (!token || typeof token !== "object") {
      infoPanel.style.display = "none";
      infoPanel.innerHTML = "";
      selectedToken = null;
      renderVttCombatPanel();
      return;
    }

    let html = '';

    if (token.monsterId) {
      // Monster token info
      const monster = window.BB_DATABASE.MONSTERS.find(m => m.name === token.monsterId);
      html = `
        <h4 style="margin:0 0 8px 0; color:#ff6b6b; font-size:1rem;">👹 ${token.monsterId}</h4>
        <div style="font-size:0.8rem; color:#fff; display:flex; flex-direction:column; gap:4px;">
          <div><strong style="color:#ff6b6b;">HP:</strong> ${token.currentHp} / ${token.maxHp}</div>
          <div><strong style="color:#fcc419;">DEF:</strong> ${token.defense}</div>
          <div><strong style="color:#20c997;">RES:</strong> ${token.resilience}</div>
          <div><strong>Speed:</strong> ${token.movementRemaining !== undefined ? token.movementRemaining : (parseInt(monster?.speed) || 30)} ft</div>
          ${monster && monster.resistances ? `<div><strong style="color:#74c0fc;">Resist:</strong> ${monster.resistances}</div>` : ''}
          ${monster && monster.vulnerabilities ? `<div><strong style="color:#ffa94d;">Vuln:</strong> ${monster.vulnerabilities}</div>` : ''}
          ${monster && monster.attacks ? `<div style="margin-top:4px; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;"><strong>Attacks:</strong><div style="color:#ccc; font-size:0.75rem; margin-top:2px;">${monster.attacks.map(a => `<b>${a.name}</b>: ${a.desc}`).join('<br>')}</div></div>` : ''}
          ${monster && monster.abilities ? `<div style="margin-top:4px; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;"><strong>Abilities:</strong><div style="color:#ccc; font-size:0.75rem; margin-top:2px;">${Array.isArray(monster.abilities) ? monster.abilities.map(a => `<b>${a.name}</b>: ${a.desc}`).join('<br>') : monster.abilities}</div></div>` : ''}
        </div>
      `;
    } else if (token.charId) {
      // Player character token info
      const chars = window.BB_STATE.getSavedCharacters() || [];
      const rawChar = chars.find(c => c.id === token.charId);
      if (!rawChar) {
        html = `<div style="color:#aaa; font-size:0.8rem;">Character data not found.</div>`;
      } else {
        const char = hydrateCharacterStats(rawChar);
        const stats = char.stats || {};
        const getMod = (val) => { const m = Math.floor((val - 10) / 2); return m >= 0 ? '+' + m : '' + m; };

        html = `
          <h4 style="margin:0 0 4px 0; color:var(--amber); font-size:1rem;">⚔️ ${char.name}</h4>
          <div style="font-size:0.75rem; color:#aaa; margin-bottom:8px;">Lvl ${char.level} ${char.class} (${char.species || ''})</div>
          <div style="font-size:0.8rem; color:#fff; display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; justify-content:space-between;"><span><strong style="color:#ff6b6b;">HP:</strong> ${char.hp.current} / ${char.hp.total}</span></div>
            <div style="display:flex; justify-content:space-between;"><span><strong style="color:#ae3ec9;">MP:</strong> ${char.mp ? char.mp.current + ' / ' + char.mp.total : '—'}</span></div>
            <div style="display:flex; justify-content:space-between;"><span><strong style="color:#4dabf7;">SP:</strong> ${char.sp ? char.sp.current + ' / ' + char.sp.total : '—'}</span></div>
            <div style="display:flex; gap:12px; margin-top:4px;">
              <span><strong style="color:#fcc419;">DEF:</strong> ${char.defense || 0}</span>
              <span><strong style="color:#20c997;">RES:</strong> ${char.resilience || 0}</span>
            </div>
            <div><strong>Speed:</strong> ${rawChar.movementRemaining !== undefined ? rawChar.movementRemaining + ' / ' : ''}${char.speed || 30} ft</div>
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
            ${['Str','Dex','Con','Int','Wis','Lck'].map(s => `
              <div style="text-align:center; background:rgba(0,0,0,0.3); border-radius:4px; padding:3px;">
                <div style="font-size:0.65rem; color:#aaa; text-transform:uppercase;">${s}</div>
                <div style="font-size:0.9rem; font-weight:bold; color:#fff;">${stats[s] || 10}</div>
                <div style="font-size:0.65rem; color:var(--amber);">${getMod(stats[s] || 10)}</div>
              </div>
            `).join('')}
          </div>
          ${char.skills && char.skills.length > 0 ? `
            <div style="margin-top:6px; font-size:0.7rem; color:#aaa;">
              <strong style="color:#fff;">Skills:</strong> ${char.skills.join(', ')}
            </div>
          ` : ''}
        `;
      }
    }

    infoPanel.innerHTML = html;
    infoPanel.style.display = "block";
    renderVttCombatPanel();
  }

  function renderVttCombatPanel() {
    const combatUi = document.getElementById("vtt-dynamic-combat-ui");
    if (!combatUi) return;

    if (!selectedToken) {
      combatUi.innerHTML = `<div style="font-size:0.85rem; color:#aaa; text-align:center; padding:10px 0;">Select a token to view combat options.</div>`;
      return;
    }

    const token = activeMap.tokens[selectedToken.y][selectedToken.x];
    if (!token || typeof token !== "object") {
      combatUi.innerHTML = `<div style="font-size:0.85rem; color:#aaa; text-align:center; padding:10px 0;">Select a token to view combat options.</div>`;
      return;
    }

      function getActionEconomyHTML(sourceObj, isPlayer, rawChar) {
        if (!sourceObj.combatState) sourceObj.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
        
        let html = `
          <div class="card action-economy-card glass" style="padding:15px; margin:0; margin-bottom:15px; border:1px solid rgba(255,255,255,0.1);">
            <h3 class="card-header-sm" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <span>Action Economy</span>
              <button class="btn btn-xs btn-secondary" id="vtt-reset-actions-btn" style="font-size:0.7rem; padding:2px 6px;">Reset Turn</button>
            </h3>
        `;

        if (isPlayer && rawChar && rawChar.inventorySlots) {
          const countPotion = (name) => {
            return (rawChar.inventorySlots || []).reduce((acc, slot) => {
              if (typeof slot === "string" && slot === name) return acc + 1;
              if (slot && typeof slot === "object" && slot.name === name) return acc + (slot.quantity || 1);
              return acc;
            }, 0);
          };
          let hpPotionCount = countPotion("Health Potion");
          let mpPotionCount = countPotion("Mana Potion");
          let spPotionCount = countPotion("Stamina Potion");
          if (hpPotionCount > 0 || mpPotionCount > 0 || spPotionCount > 0) {
             html += `<div style="margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:center;">`;
             if (hpPotionCount > 0) html += `<button class="btn btn-xs use-potion-btn" data-pool="hp" data-name="Health Potion" style="background:var(--hp-red, #ff6b6b); border:1px solid #c92a2a; color:#fff; font-size:0.7rem; padding:2px 6px;">Health Potion (${hpPotionCount})</button>`;
             if (mpPotionCount > 0) html += `<button class="btn btn-xs use-potion-btn" data-pool="mp" data-name="Mana Potion" style="background:var(--mana-blue, #4dabf7); border:1px solid #1864ab; color:#fff; font-size:0.7rem; padding:2px 6px;">Mana Potion (${mpPotionCount})</button>`;
             if (spPotionCount > 0) html += `<button class="btn btn-xs use-potion-btn" data-pool="sp" data-name="Stamina Potion" style="background:var(--sp-green, #40c057); border:1px solid #2b8a3e; color:#fff; font-size:0.7rem; padding:2px 6px;">Stamina Potion (${spPotionCount})</button>`;
             html += `</div>`;
          }
        }

        let baseSpeed = 30;
        if (isPlayer && rawChar) {
           baseSpeed = hydrateCharacterStats(rawChar).speed || 30;
        } else if (sourceObj && sourceObj.monsterId) {
           const m = window.BB_DATABASE.MONSTERS.find(x => x.name === sourceObj.monsterId);
           if (m && m.speed) {
               const match = m.speed.match(/(\d+)/);
               if (match) baseSpeed = parseInt(match[1]);
           }
        }
        let displaySpeed = sourceObj.movementRemaining !== undefined ? sourceObj.movementRemaining : baseSpeed;

        html += `
            <div class="action-economy-row" style="display:flex; justify-content:space-between; gap:5px; font-size:0.8rem; color:var(--text-light); margin-bottom:12px;">
              <label class="action-cb-wrapper" style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="action-cb" data-action="action" ${sourceObj.combatState?.action ? "checked" : ""}><span class="action-cb-indicator"></span> Action</label>
              <label class="action-cb-wrapper" style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="action-cb" data-action="bonusAction" ${sourceObj.combatState?.bonusAction ? "checked" : ""}><span class="action-cb-indicator"></span> Bonus</label>
              <label class="action-cb-wrapper" style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="action-cb" data-action="reaction" ${sourceObj.combatState?.reaction ? "checked" : ""}><span class="action-cb-indicator"></span> Reaction</label>
              <label class="action-cb-wrapper" style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" class="action-cb" data-action="movement" ${sourceObj.combatState?.movement ? "checked" : ""}><span class="action-cb-indicator"></span> Move</label>
            </div>
            <div style="font-size:0.85rem; color:var(--amber); text-align:center; margin-bottom:12px; font-family:var(--font-mono); border:1px solid rgba(255,255,255,0.1); padding:4px; border-radius:4px; background:rgba(0,0,0,0.3);">
              Speed: ${displaySpeed} / ${baseSpeed} ft
            </div>
            <div style="font-size:0.75rem; color:#fff; text-align:center; line-height:1.6;">
        `;

        const getStyle = (actionName) => {
          let consumesBonus = isPlayer && rawChar ? (actionName === "Help" && rawChar.talents && rawChar.talents.includes("Accomplice")) : false;
          let isConsumed = consumesBonus ? (sourceObj.combatState?.bonusAction === true || sourceObj.combatState?.bonusAction === "true") : (sourceObj.combatState?.action === true || sourceObj.combatState?.action === "true");
          return `cursor:${isConsumed ? 'not-allowed' : 'pointer'}; opacity:${isConsumed ? '0.4' : '1'}; border-bottom:1px dashed var(--text-muted); transition:all 0.2s;`;
        };
        
        html += `
                  <span class="vtt-interact-btn info-tooltip-trigger" style="cursor:pointer; font-weight:bold; color:var(--mana-blue); border-bottom:1px dashed var(--mana-blue);" data-html="<h4>Interact</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>Interact with a door, object, or token within 5ft.</p>">Interact</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Attack')}" data-action-name="Attack" data-type="ability" data-html="<h4>Attack</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>The most direct way to harm an opponent is to take the Attack action.</p>">Attack</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Dash')}" data-action-name="Dash" data-type="ability" data-html="<h4>Dash</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Dash action, you push yourself to move farther than usual during your turn.</p>">Dash</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Disengage')}" data-action-name="Disengage" data-type="ability" data-html="<h4>Disengage</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Disengage action, you move with deliberate caution.</p>">Disengage</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Dodge')}" data-action-name="Dodge" data-type="ability" data-html="<h4>Dodge</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Dodge action, you devote your full attention to defense.</p>">Dodge</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Help')}" data-action-name="Help" data-type="ability" data-html="<h4>Help</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>You can use your action to assist another creature in completing a task.</p>">Help</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Hide')}" data-action-name="Hide" data-type="ability" data-html="<h4>Hide</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Hide action, you attempt to slip from sight or otherwise conceal your presence.</p>">Hide</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Ready')}" data-action-name="Ready" data-type="ability" data-html="<h4>Ready</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>The Ready action lets you prepare an action or movement that you can use later in the round.</p>">Ready</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Search')}" data-action-name="Search" data-type="ability" data-html="<h4>Search</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When you take the Search action, you carefully examine your surroundings.</p>">Search</span> &bull; 
                  <span class="info-tooltip-trigger action-quick-btn" style="${getStyle('Use an Object')}" data-action-name="Use an Object" data-type="ability" data-html="<h4>Use an Object</h4><p style='margin:0; font-size:0.85rem; color:#fff;'>When an object requires your full attention to operate, you take the Use an Object action.</p>">Use Object</span>
        `;
        html += `</div></div>`;
        return html;
      }

    if (token.charId) {
      // Player Token
      const chars = window.BB_STATE.getSavedCharacters() || [];
      const rawChar = chars.find(c => c.id === token.charId);
      if (!rawChar) return;
      const char = hydrateCharacterStats(rawChar);

      let html = getActionEconomyHTML(rawChar, true, rawChar);

      // Attacks Section
      html += `
        <div class="card combat-stats-card glass" style="padding:15px; margin:0; margin-bottom:15px; border:1px solid rgba(255,255,255,0.1);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0; color:var(--amber); font-size:0.9rem;">Weapon Attacks</h4>
            <button class="btn btn-sm vtt-btn-roll-initiative" style="background:var(--mana-blue); color:white; border:none; font-weight:bold; padding:4px 12px; font-size:0.8rem; cursor:pointer;">Roll Initiative</button>
          </div>
          <div class="attacks-list" style="display:flex; flex-direction:column; gap:8px;">
            ${(function() {
              if (!char.equipment) return `<div style="font-size:0.85rem; color:#fff; text-align:center;">No weapons equipped.</div>`;
              let attacksHtml = "";
              for (const [slot, itemName] of Object.entries(char.equipment)) {
                if (!itemName) continue;
                if (slot === 'offHand' && char.equipment.mainHand) {
                    const mainHandItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment.mainHand);
                    if (mainHandItem && ["Double", "Colossal"].includes(mainHandItem.grip)) continue;
                }
                const item = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === itemName);
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
                  let count = 1; let type = 4;

                  if (!hasTraining) {
                    isImprovised = true; count = 1; type = 4; useDamageBonus = "Strength";
                  } else {
                    const match = item.damageDie.match(/(\d+)d(\d+)/i);
                    if (match) { count = parseInt(match[1]); type = parseInt(match[2]); }
                  }

                  if (isImprovised && char.talents && char.talents.includes("Makeshift")) useDamageBonus = "Finesse";

                  if (useDamageBonus === "Strength") { modVal = window.BB_STATE.getModifier(char.stats.Str); modStat = "STR"; }
                  else if (useDamageBonus === "Dexterity") { modVal = window.BB_STATE.getModifier(char.stats.Dex); modStat = "DEX"; }
                  
                  if (useDamageBonus === "Finesse") { 
                    if (!char.finesseOverrides) char.finesseOverrides = {};
                    let currentOverride = char.finesseOverrides[slot] || "Auto";
                    if (currentOverride === "STR") { modVal = window.BB_STATE.getModifier(char.stats.Str); modStat = "STR"; }
                    else if (currentOverride === "DEX") { modVal = window.BB_STATE.getModifier(char.stats.Dex); modStat = "DEX"; }
                    else {
                      const strMod = window.BB_STATE.getModifier(char.stats.Str);
                      const dexMod = window.BB_STATE.getModifier(char.stats.Dex);
                      if (strMod >= dexMod) { modVal = strMod; modStat = "STR"; }
                      else { modVal = dexMod; modStat = "DEX"; }
                    }
                  }
                  
                  if (item.grip === "Dual" && slot === "offHand") { modVal = 0; modStat = "None"; }
                  if (item.grip === "Single") {
                    let hasOtherWeapon = false;
                    ['mainHand', 'offHand', 'sling'].forEach(s => {
                      if (s !== slot && char.equipment && char.equipment[s]) {
                        const otherItem = ((window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || [])).find(i => i.name === char.equipment[s]);
                        if (otherItem && otherItem.slot === "Weapon" && !otherItem.type.includes("Shield") && !otherItem.type.includes("Implement") && !otherItem.type.includes("Focus")) {
                          hasOtherWeapon = true;
                        }
                      }
                    });
                    if (!hasOtherWeapon) { modVal += 2; modStat += " + Single Grip"; }
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
                  if (!isImprovised && item.grip === "Single" && char.talents && char.talents.includes("Unfettered") && !char.equipment.offHand) {
                    maxCritCap += 1;
                  }
                  let finalCritRange = Math.min(totalCritRange, maxCritCap);
                  let labelPrefix = isImprovised ? "Improvised " : "";
                  
                  attacksHtml += `<button class="btn btn-secondary vtt-attack-roll-btn" data-slot="${slot}" data-grip="${isImprovised ? '' : (item.grip || '')}" data-label="Damage: ${labelPrefix}${item.name}" data-weapon="${item.name}" data-count="${count}" data-type="${type}" data-mod="${modVal}" data-crit="${finalCritRange}" data-bowmens="${bowmensBonus}" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer;"><span>${labelPrefix}${item.name} <span style="color:#fff; font-size:0.75rem;">(${slot})</span></span><span style="color:var(--amber); display:flex; align-items:center;">${count}d${type} ${modVal >= 0 ? '+'+modVal : modVal} ${item.damageType || ""} <span style="font-size:0.7rem; color:#fff; margin-left:4px;">(${modStat})</span></span></button>`;
                }
              }
              return attacksHtml || `<div style="font-size:0.85rem; color:#fff; text-align:center;">No weapons equipped.</div>`;
            })()}
          </div>
        </div>
      `;

      // Spells Section
      if (char.spells && char.spells.length > 0) {
        html += `
          <div class="card combat-stats-card glass" style="padding:15px; margin:0; margin-bottom:15px; border:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="margin:0; color:var(--amber); font-size:0.9rem;">Prepared Spells</h4>
            </div>
            <div class="attacks-list" style="display:flex; flex-direction:column; gap:8px;">
        `;
        char.spells.forEach(spellName => {
           const sp = window.BB_DATABASE.SPELLS.find(s => s.name === spellName);
           if (!sp) return;
           
           let count = 0; let type = 0; let dmgType = "Magic";
           let isSave = false; let saveStat = ""; let saveDc = 0;
           
           const saveMatch = sp.description.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving throw.*?dc.*?(\d+).*?(\d+d\d+(?:\s*\+\s*[a-z]+ modifier)?\s+[a-z]+)\s+damage/i);
           if (saveMatch) {
              isSave = true;
              const statRaw = saveMatch[1].toLowerCase();
              saveStat = statRaw.charAt(0).toUpperCase() + statRaw.slice(1);
              saveDc = parseInt(saveMatch[2]);
              const dmgMatch = saveMatch[3].match(/(\d+)d(\d+)(?:\s+plus\s+\w+\s+modifier)?\s+(\w+)/i);
              if (dmgMatch) {
                 count = parseInt(dmgMatch[1]);
                 type = parseInt(dmgMatch[2]);
                 dmgType = dmgMatch[3];
              }
           } else {
             const match = sp.description.match(/(\d+)d(\d+)(?:\s+plus\s+\w+\s+modifier)?\s+(\w+)\s+damage/i);
             if (match) { 
               count = parseInt(match[1]); 
               type = parseInt(match[2]); 
               dmgType = match[3]; 
             }
           }

           const dcMatch = sp.description.match(/(?:DC\s+(\d+)\s+(\w+)\s+save|(\w+)\s+saving\s+throw\s*\(DC\s*(?:equal\s+to\s*)?(\d+)\))/i);
           if (dcMatch) { 
              isSave = true; 
              let parsedDc = parseInt(dcMatch[1] || dcMatch[4]);
              if (isNaN(parsedDc)) {
                 // Dynamic DC like "12 plus your Intelligence modifier"
                 const intMod = window.BB_STATE.getModifier(char.stats.Int);
                 parsedDc = 12 + intMod; // specific to Archon rift walk
              }
              saveDc = parsedDc; 
              saveStat = dcMatch[2] || dcMatch[3]; 
           }

           if (count > 0 && type > 0) {
              html += `<button class="btn btn-secondary vtt-attack-roll-btn" data-slot="spell" data-grip="Single" data-label="Spell: ${sp.name}" data-weapon="${sp.name}" data-count="${count}" data-type="${type}" data-mod="0" data-crit="0" data-dmgtype="${dmgType}" data-is-save="${isSave}" data-save-stat="${saveStat}" data-save-dc="${saveDc}" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer;"><span>${sp.name}</span><span style="color:var(--amber); display:flex; align-items:center;">${count}d${type} ${dmgType} ${isSave ? `(DC ${saveDc} ${saveStat})` : ""}</span></button>`;
           } else {
              html += `<div style="display:flex; flex-direction:column; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); padding:8px 12px; border-radius:4px;">
                         <strong style="color:var(--amber); font-size:0.85rem;">${sp.name}</strong>
                         <span style="color:#fff; font-size:0.8rem; line-height:1.3; margin-top:4px;">${sp.description}</span>
                       </div>`;
           }
        });
        html += `</div></div>`;
      }

      combatUi.innerHTML = html;
      
    } else if (token.monsterId) {
      // Monster Token
      const monster = window.BB_DATABASE.MONSTERS.find(m => m.name === token.monsterId);
      if (!monster) return;

      let html = getActionEconomyHTML(token, false, null);
      if (monster.attacks && monster.attacks.length > 0) {
        html += `
          <div class="card combat-stats-card glass" style="padding:15px; margin:0; margin-bottom:15px; border:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="margin:0; color:var(--amber); font-size:0.9rem;">Monster Attacks</h4>
            </div>
            <div class="attacks-list" style="display:flex; flex-direction:column; gap:8px;">
        `;
        monster.attacks.forEach(atk => {
           let count = 1; let type = 4; let dmgType = "Physical";
           // Check for "1d8 Nature damage" or similar
           const match = atk.desc.match(/(\d+)d(\d+)(?:\s+plus\s+\w+\s+modifier)?\s+(\w+)\s+damage/i);
           if (match) { 
             count = parseInt(match[1]); 
             type = parseInt(match[2]); 
             dmgType = match[3]; 
           } else {
             // Fallback if no damage type string is specified
             const fallbackMatch = atk.desc.match(/(\d+)d(\d+)/i);
             if (fallbackMatch) { count = parseInt(fallbackMatch[1]); type = parseInt(fallbackMatch[2]); }
           }
           
           // Check if it's a save-based effect (e.g. "DC 15 Dexterity save")
           let isSave = false;
           let saveStat = "";
           let saveDc = 0;
           const dcMatch = atk.desc.match(/(?:DC\s+(\d+)\s+(\w+)\s+save|(\w+)\s+saving\s+throw\s*\(DC\s*(?:equal\s+to\s*)?(\d+)\))/i);
           if (dcMatch) { 
              isSave = true; 
              saveDc = parseInt(dcMatch[1] || dcMatch[4]); 
              saveStat = dcMatch[2] || dcMatch[3]; 
           }
           
           html += `<button class="btn btn-secondary vtt-attack-roll-btn" data-slot="monster" data-grip="Single" data-label="Damage: ${atk.name}" data-weapon="${atk.name}" data-count="${count}" data-type="${type}" data-mod="0" data-crit="0" data-dmgtype="${dmgType}" data-is-save="${isSave}" data-save-stat="${saveStat}" data-save-dc="${saveDc}" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer;"><span>${atk.name}</span><span style="color:var(--amber); display:flex; align-items:center;">${count}d${type} ${dmgType} ${isSave ? `(DC ${saveDc} ${saveStat})` : ""}</span></button>`;
        });
        html += `</div></div>`;
      }

      if (monster.actions && monster.actions.length > 0) {
        html += `
          <div class="card combat-stats-card glass" style="padding:15px; margin:0; margin-bottom:15px; border:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <h4 style="margin:0; color:var(--amber); font-size:0.9rem;">Monster Actions</h4>
            </div>
            <div class="attacks-list" style="display:flex; flex-direction:column; gap:8px;">
        `;
        monster.actions.forEach(act => {
           let dmgType = "Physical";
           let count = 0; let type = 0;
           let isSave = false;
           let saveStat = "";
           let saveDc = 0;
           
           const saveMatch = act.desc.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving throw.*?dc.*?(\d+).*?(\d+d\d+(?:\s*\+\s*[a-z]+ modifier)?\s+[a-z]+)\s+damage/i);
           if (saveMatch) {
              isSave = true;
              const statRaw = saveMatch[1].toLowerCase();
              saveStat = statRaw.charAt(0).toUpperCase() + statRaw.slice(1);
              saveDc = parseInt(saveMatch[2]);
              const dmgMatch = saveMatch[3].match(/(\d+)d(\d+)(?:\s+plus\s+\w+\s+modifier)?\s+(\w+)/i);
              if (dmgMatch) {
                 count = parseInt(dmgMatch[1]);
                 type = parseInt(dmgMatch[2]);
                 dmgType = dmgMatch[3];
              }
           } else {
             const match = act.desc.match(/(\d+)d(\d+)(?:\s+plus\s+\w+\s+modifier)?\s+(\w+)\s+damage/i);
             if (match) { 
               count = parseInt(match[1]); 
               type = parseInt(match[2]); 
               dmgType = match[3]; 
             }
           }
           
           if (count > 0 && type > 0) {
              html += `<button class="btn btn-secondary vtt-attack-roll-btn" data-slot="monster" data-grip="Single" data-label="Action: ${act.name}" data-weapon="${act.name}" data-count="${count}" data-type="${type}" data-mod="0" data-crit="0" data-dmgtype="${dmgType}" data-is-save="${isSave}" data-save-stat="${saveStat}" data-save-dc="${saveDc}" style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:8px 12px; font-family:var(--font-mono); font-size:0.85rem; text-align:left; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); cursor:pointer;"><span>${act.name}</span><span style="color:var(--amber); display:flex; align-items:center;">${count}d${type} ${dmgType} ${isSave ? `(DC ${saveDc} ${saveStat})` : ""}</span></button>`;
           } else {
              html += `<div style="display:flex; flex-direction:column; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); padding:8px 12px; border-radius:4px;">
                         <strong style="color:var(--amber); font-size:0.85rem;">${act.name}</strong>
                         <span style="color:#fff; font-size:0.8rem; line-height:1.3; margin-top:4px;">${act.desc}</span>
                       </div>`;
           }
        });
        html += `</div></div>`;
      }

      html += `
        <div class="card combat-stats-card glass" style="padding:15px; margin:0; margin-bottom:15px; border:1px solid rgba(255,255,255,0.1);">
          <h4 style="margin:0 0 10px 0; color:var(--amber); font-size:0.9rem;">Monster Abilities</h4>
          <div style="font-size:0.85rem; color:#fff; white-space:pre-wrap; line-height:1.4;">${monster.abilities ? (Array.isArray(monster.abilities) ? monster.abilities.map(a => `<b>${a.name}</b>: ${a.desc}`).join('<br><br>') : monster.abilities) : "No abilities listed."}</div>
        </div>
      `;
      combatUi.innerHTML = html;
    }
  }

  function handleCombatPanelClick(e) {
    // Quick Dice (Always available)
    if (e.target.closest('.vtt-quick-dice-btn')) {
      const btn = e.target.closest('.vtt-quick-dice-btn');
      performVttRoll(`1d${btn.getAttribute('data-die')}`, parseInt(btn.getAttribute('data-die')));
      return;
    }

    if (!selectedToken) return;
    
    if (e.target.closest('.vtt-interact-btn')) {
      pendingInteract = true;
      document.getElementById("vtt-canvas-container").style.cursor = "pointer";
      if (window.BB_DICE) window.BB_DICE.showToastNotification("Select an adjacent target to Interact with...");
      return;
    }

    const token = activeMap.tokens[selectedToken.y][selectedToken.x];
    if (!token || (!token.charId && !token.monsterId)) {
      return;
    }
    
    const rawChar = (window.BB_STATE.getSavedCharacters() || []).find(c => c.id === token.charId);

    // Reset Actions Button
    if (e.target.closest("#vtt-reset-actions-btn")) {
      let sourceObj = rawChar || token;
      if (!sourceObj.combatState) sourceObj.combatState = {};
      sourceObj.combatState.action = false;
      sourceObj.combatState.bonusAction = false;
      sourceObj.combatState.reaction = false;
      sourceObj.combatState.movement = false;
      
      if (rawChar) {
        sourceObj.movementRemaining = hydrateCharacterStats(rawChar).movement || 30;
      } else if (token.monsterId) {
        const monster = window.BB_DATABASE.MONSTERS.find(m => m.name === token.monsterId);
        let speed = 30;
        if (monster && monster.speed) {
           const match = monster.speed.match(/(\d+)/);
           if (match) speed = parseInt(match[1]);
        }
        sourceObj.movementRemaining = speed;
      }
      
      if (rawChar) window.BB_STATE.saveCharacter(rawChar);
      renderSelectedTokenInfo();
      if (window.BB_DICE) window.BB_DICE.showToastNotification("Turn reset.");
      return;
    }

    // Use Potion Button
    if (e.target.closest('.use-potion-btn')) {
      if (!rawChar) return;
      const btn = e.target.closest('.use-potion-btn');
      if (!rawChar.combatState) rawChar.combatState = {};
      let hasDipso = rawChar.talents && rawChar.talents.includes("Dipsomaniac");
      let consumedBonus = false;
      let consumedAction = false;

      if (hasDipso && !(rawChar.combatState.bonusAction === true || rawChar.combatState.bonusAction === "true")) {
        consumedBonus = true;
      } else if (!(rawChar.combatState.action === true || rawChar.combatState.action === "true")) {
        consumedAction = true;
      } else {
        if (window.BB_DICE) window.BB_DICE.showToastNotification(hasDipso ? "You lack the Action or Bonus Action economy to use a potion!" : "You lack the Action economy to use an item!");
        return;
      }

      if (!rawChar.restDice) rawChar.restDice = { used: 0 };
      if (rawChar.restDice.used >= rawChar.level) {
        if (window.BB_DICE) window.BB_DICE.showToastNotification("No Rest Dice remaining!");
        return;
      }

      const potionName = btn.getAttribute("data-name");
      const index = (rawChar.inventorySlots || []).findIndex(slot => {
        if (typeof slot === "string") return slot === potionName;
        if (slot && typeof slot === "object") return slot.name === potionName;
        return false;
      });

      if (index > -1) {
        const slot = rawChar.inventorySlots[index];
        if (typeof slot === "object" && slot.quantity > 1) {
          slot.quantity -= 1;
        } else {
          rawChar.inventorySlots[index] = "";
        }
        
        if (consumedBonus) rawChar.combatState.bonusAction = true;
        else if (consumedAction) rawChar.combatState.action = true;
        
        rawChar.restDice.used += 1;
        window.BB_STATE.saveCharacter(rawChar);
        renderSelectedTokenInfo();
        
        if (window.BB_DICE) {
          const char = hydrateCharacterStats(rawChar);
          let label = `${char.name} consumed ${potionName} using a Rest Die`;
          let dieType = char.class === "Invoker" || char.class === "Archon" ? 6 : char.class === "Justicar" || char.class === "Berserker" ? 10 : 8;
          window.BB_DICE.roll(label, 1, dieType, window.BB_STATE.getModifier(char.stats.Con), 0, 0, false);
          setTimeout(renderDiceHistory, 1000);
        }
      }
      return;
    }

    // Initiative Roll
    if (e.target.closest('.vtt-btn-roll-initiative')) {
      if (!rawChar) return;
      const char = hydrateCharacterStats(rawChar);
      let luckMod = window.BB_STATE.getModifier(char.stats.Lck);
      if (window.BB_DICE) window.BB_DICE.roll(`${char.name} Initiative`, 1, 20, luckMod, 0, 0, false);
      setTimeout(renderDiceHistory, 1000);
      return;
    }

    // Attack Rolls
    if (e.target.closest('.vtt-attack-roll-btn')) {
      const btn = e.target.closest('.vtt-attack-roll-btn');
      let label = btn.getAttribute("data-label");
      const weaponName = btn.getAttribute("data-weapon");
      const count = parseInt(btn.getAttribute("data-count"));
      const type = parseInt(btn.getAttribute("data-type"));
      let mod = parseInt(btn.getAttribute("data-mod"));
      const slot = btn.getAttribute("data-slot");
      const grip = btn.getAttribute("data-grip");
      const critRange = parseInt(btn.getAttribute("data-crit")) || 0;
      const bowmens = parseInt(btn.getAttribute("data-bowmens")) || 0;
      const dmgType = btn.getAttribute("data-dmgtype") || null;
      const isSave = btn.getAttribute("data-is-save") === "true";
      const saveStat = btn.getAttribute("data-save-stat");
      const saveDc = parseInt(btn.getAttribute("data-save-dc")) || 0;
      
      if (bowmens > 0) {
        mod += bowmens;
        label += " (+1 Bowmen's Bracers)";
      }
      
      let sourceObj = rawChar || token;
      if (!sourceObj.combatState) sourceObj.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
      
      if (slot === "offHand" && grip === "Dual") {
        if (sourceObj.combatState.bonusAction === true || sourceObj.combatState.bonusAction === "true") {
          if (window.BB_DICE) window.BB_DICE.showToastNotification("You lack the Bonus Action economy to perform this attack!");
          return;
        }
      } else {
        if (sourceObj.combatState.action === true || sourceObj.combatState.action === "true") {
          if (window.BB_DICE) window.BB_DICE.showToastNotification("You lack the Action economy to perform this attack!");
          return;
        }
      }
      
      // Enter targeting mode instead of rolling immediately
      pendingAttack = { rawChar, token, label, weaponName, count, type, mod, slot, grip, critRange, dmgType, isSave, saveStat, saveDc };
      document.getElementById("vtt-canvas-container").style.cursor = "crosshair";
      if (window.BB_DICE) window.BB_DICE.showToastNotification(`Select a target token for ${weaponName} attack...`);
      return;
    }
    // Action quick buttons
    if (e.target.closest('.action-quick-btn')) {
      const btn = e.target.closest('.action-quick-btn');
      const actionName = btn.getAttribute("data-action-name");
      let consumesBonus = false;
      if (rawChar) {
        const char = hydrateCharacterStats(rawChar);
        consumesBonus = actionName === "Help" && char.talents && char.talents.includes("Accomplice");
      }
      let targetAction = consumesBonus ? "bonusAction" : "action";

      let sourceObj = rawChar || token;
      if (!sourceObj.combatState) sourceObj.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
      if (sourceObj.combatState[targetAction] === true || sourceObj.combatState[targetAction] === "true") {
        if (window.BB_DICE) window.BB_DICE.showToastNotification(`You have already consumed your ${targetAction === "bonusAction" ? "Bonus Action" : "Action"}!`);
        return;
      }
      sourceObj.combatState[targetAction] = true;
      
      if (actionName === "Dash") {
         let speed = 30;
         if (rawChar) speed = hydrateCharacterStats(rawChar).movement || 30;
         else if (token && token.monsterId) {
             const m = window.BB_DATABASE.MONSTERS.find(x => x.name === token.monsterId);
             if (m && m.speed) {
                 const match = m.speed.match(/(\d+)/);
                 if (match) speed = parseInt(match[1]);
             }
         }
         sourceObj.movementRemaining = (sourceObj.movementRemaining || 0) + speed;
         sourceObj.combatState.movement = false;
      }
      
      if (rawChar) window.BB_STATE.saveCharacter(rawChar);
      renderSelectedTokenInfo();
      if (window.BB_DICE) window.BB_DICE.showToastNotification(`${targetAction === "bonusAction" ? "Bonus Action" : "Action"} consumed: ${actionName}`);
      return;
    }
  }

  function handleCombatPanelChange(e) {
    if (e.target.classList.contains("action-cb")) {
      if (!selectedToken) return;
      const token = activeMap.tokens[selectedToken.y][selectedToken.x];
      if (!token || (!token.charId && !token.monsterId)) return;
      const rawChar = (window.BB_STATE.getSavedCharacters() || []).find(c => c.id === token.charId);

      let sourceObj = rawChar || token;
      if (!sourceObj.combatState) sourceObj.combatState = {};
      const actionType = e.target.getAttribute("data-action");
      sourceObj.combatState[actionType] = e.target.checked;
      if (rawChar) window.BB_STATE.saveCharacter(rawChar);
      renderSelectedTokenInfo();
    }
  }

  function hideCombatModal() {
    const modal = document.getElementById("combat-modal");
    if (modal) modal.remove();
  }

  function toggleDicePanel() {
    const panel = document.getElementById("vtt-dice-panel");
    if (panel) {
      if (panel.style.display === "none") {
        panel.style.display = "flex";
        renderDiceHistory();
      } else {
        panel.style.display = "none";
      }
    }
  }

  function renderDiceHistory() {
    const historyContainer = document.getElementById("vtt-dice-history");
    if (!historyContainer) return;
    
    const log = window.BB_STATE.getDiceLog ? window.BB_STATE.getDiceLog() : [];
    if (log.length === 0) {
      historyContainer.innerHTML = '<div style="color:#aaa; font-size:0.8rem; font-style:italic;">No history yet.</div>';
      return;
    }

    historyContainer.innerHTML = log.map(r => `
      <div style="background:rgba(0,0,0,0.5); padding:8px; border-radius:4px; border-left:2px solid var(--amber);">
        <div style="font-size:0.75rem; color:#aaa; display:flex; justify-content:space-between;">
          <span>${r.timestamp}</span>
        </div>
        <div style="font-weight:bold; color:#fff; font-size:0.9rem;">${r.label}</div>
        <div style="color:var(--amber); font-family:'Bebas Neue', cursive; font-size:1.2rem;">Total: ${r.result}</div>
        <div style="font-size:0.75rem; color:#aaa;">${r.breakdown}</div>
      </div>
    `).join("");
  }

  function performVttRoll(label, dieType) {
    const isPrivate = document.getElementById("vtt-dice-private")?.checked;
    if (window.BB_DICE) {
      window.BB_DICE.roll(label, 1, dieType, 0, 0, 0, true, "", 0, "", isPrivate);
      setTimeout(renderDiceHistory, 1000); // refresh after animation
    }
  }

  function performVttCustomRoll() {
    const input = document.getElementById("vtt-custom-dice")?.value;
    if (!input) return;
    
    const isPrivate = document.getElementById("vtt-dice-private")?.checked;
    
    // Very simple regex for XdY + Z
    const match = input.match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/i);
    if (match) {
      const count = parseInt(match[1]);
      const type = parseInt(match[2]);
      const mod = match[3] ? parseInt(match[3]) : 0;
      
      if (window.BB_DICE) {
        window.BB_DICE.roll(`Custom (${input})`, count, type, mod, 0, 0, true, "", 0, "", isPrivate);
        setTimeout(renderDiceHistory, 1000);
      }
    } else {
      // Just a flat modifier maybe? Or unsupported expression.
      if (window.BB_DICE) {
        window.BB_DICE.showToastNotification("Invalid format. Use XdY+Z (e.g., 2d6+4)");
      }
    }
  }

  function showCombatModal() {
    hideCombatModal();
    if (!combatAttacker || !combatTarget) return;

    const chars = window.BB_STATE.getSavedCharacters() || [];
    
    // Attacker
    let atkRaw = null;
    let atkStats = null;
    let atkName = "Enemy Token";
    if (combatAttacker.token.charId) {
      atkRaw = chars.find(c => c.id === combatAttacker.token.charId);
      if (atkRaw) {
        atkStats = hydrateCharacterStats(atkRaw);
        atkName = atkRaw.name;
      }
    } else if (combatAttacker.token.classId) {
      atkName = combatAttacker.token.classId;
    }

    // Target
    let tgtRaw = null;
    let tgtStats = null;
    let tgtName = "Enemy Token";
    let tgtDef = 0;
    let tgtRes = 0;
    let tgtHp = 0;
    if (combatTarget.token.charId) {
      tgtRaw = chars.find(c => c.id === combatTarget.token.charId);
      if (tgtRaw) {
        tgtStats = hydrateCharacterStats(tgtRaw);
        tgtName = tgtRaw.name;
        tgtDef = tgtStats.defense;
        tgtRes = tgtStats.resilience;
        tgtHp = tgtRaw.hp.current;
      }
    } else if (combatTarget.token.classId) {
      tgtName = combatTarget.token.classId;
    }

    // Modal HTML
    const modal = document.createElement("div");
    modal.id = "combat-modal";
    modal.className = "glass";
    modal.style.position = "fixed";
    modal.style.top = "50%";
    modal.style.left = "50%";
    modal.style.transform = "translate(-50%, -50%)";
    modal.style.width = "400px";
    modal.style.padding = "20px";
    modal.style.zIndex = "10001";
    modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.8)";
    modal.style.border = "1px solid var(--amber)";

    // Attacker Actions (if player)
    let actionsHtml = "";
    if (atkStats) {
      const items = (window.BB_DATABASE.ITEMS || []).concat(window.BB_DATABASE.MISC_ITEMS || []);
      const equippedWeapons = [atkStats.equipment.mainHand, atkStats.equipment.offHand].filter(Boolean);
      
      equippedWeapons.forEach(wName => {
        const wItem = items.find(i => i.name === wName);
        if (wItem && wItem.damage) {
          actionsHtml += `<button class="btn btn-secondary btn-xs" style="margin:2px;" onclick="window.BB_VTT.executeCombatAction('${wItem.damage}', '${wName}')">Attack: ${wName} (${wItem.damage})</button>`;
        }
      });

      if (atkRaw.spells && window.BB_DATABASE.SPELLS) {
        atkRaw.spells.forEach(spellId => {
          const s = window.BB_DATABASE.SPELLS.find(sp => sp.id === spellId);
          if (s && s.description) {
            // Very naive regex for damage parsing from description for quick casting
            const dmgMatch = s.description.match(/(\d+d\d+(?:\s*\+\s*[A-Za-z]+ modifier)?\s+[A-Za-z]+ damage)/i);
            if (dmgMatch) {
              actionsHtml += `<button class="btn btn-secondary btn-xs" style="margin:2px;" onclick="window.BB_VTT.executeCombatAction('${dmgMatch[1]}', '${s.name.replace(/'/g, "\\'")}')">Cast: ${s.name} (${dmgMatch[1]})</button>`;
            }
          }
        });
      }
    } else if (combatAttacker.token.classId && window.BB_DATABASE.MONSTERS) {
      // It's a monster
      const monster = window.BB_DATABASE.MONSTERS.find(m => m.name === combatAttacker.token.classId);
      if (monster) {
         if (monster.attacks) {
            monster.attacks.forEach(atk => {
               const dmgMatch = atk.desc.match(/(\d+d\d+(?:\s*\+\s*[A-Za-z]+ modifier)?\s+[A-Za-z]+ damage)/i);
               if (dmgMatch) {
                  actionsHtml += `<button class="btn btn-secondary btn-xs" style="margin:2px;" onclick="window.BB_VTT.executeCombatAction('${dmgMatch[1]}', '${atk.name.replace(/'/g, "\\'")}')">${atk.name} (${dmgMatch[1]})</button>`;
               }
            });
         }
         if (monster.actions) {
            monster.actions.forEach(act => {
               // Robust lenient regex for saving throw actions
               const saveMatch = act.desc.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving throw.*?dc.*?(\d+).*?(\d+d\d+(?:\s*\+\s*[a-z]+ modifier)?\s+[a-z]+)\s+damage/i);
               if (saveMatch) {
                  // Normalize stat to capitalized
                  const statRaw = saveMatch[1].toLowerCase();
                  const saveStat = statRaw.charAt(0).toUpperCase() + statRaw.slice(1);
                  const dc = saveMatch[2];
                  const dmg = saveMatch[3];
                  actionsHtml += `<button class="btn btn-accent btn-xs" style="margin:2px;" onclick="window.BB_VTT.executeSaveAction('${saveStat}', ${dc}, '${dmg}', '${act.name.replace(/'/g, "\\'")}')">${act.name} (DC ${dc} ${saveStat})</button>`;
               } else {
                  // If it's an action but no save matched, just render it as a standard action that doesn't auto-roll damage (or fallback)
                  actionsHtml += `<button class="btn btn-secondary btn-xs" style="margin:2px;" onclick="window.BB_VTT.executeSaveAction('None', 0, '0', '${act.name.replace(/'/g, "\\'")}')">${act.name}</button>`;
               }
            });
         }
      }
    }

    if (!actionsHtml) {
      actionsHtml = `<p style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">No automated actions found.</p>`;
    }

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:15px;">
        <h3 style="margin:0; font-family:'Bebas Neue', cursive; color:var(--amber); letter-spacing:1px;">⚔️ COMBAT</h3>
        <button onclick="window.BB_VTT.hideCombatModal()" style="background:transparent; border:none; color:#fff; cursor:pointer; font-size:1.2rem;">✕</button>
      </div>
      
      <div style="display:flex; justify-content:space-between; margin-bottom: 20px; font-size: 0.9rem;">
        <div style="flex:1; text-align:center;">
          <div style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Attacker</div>
          <div style="font-weight:bold; color:#4dabf7;">${atkName}</div>
        </div>
        <div style="font-family:'Bebas Neue', cursive; color:var(--amber); font-size:1.5rem; line-height:1;">VS</div>
        <div style="flex:1; text-align:center;">
          <div style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Target</div>
          <div style="font-weight:bold; color:#ff6b6b;">${tgtName}</div>
          ${tgtRaw ? `<div style="font-size:0.75rem; margin-top:4px;">HP: ${tgtHp} | Def: ${tgtDef} | Res: ${tgtRes}</div>` : ''}
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:4px; margin-bottom:15px;">
        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--amber); margin-bottom:5px;">Attacker Actions</div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${actionsHtml}
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:4px; margin-bottom:15px;">
        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--amber); margin-bottom:5px;">Custom Damage</div>
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="text" id="combat-custom-dmg" class="custom-input" placeholder="e.g. 2d6+3" style="width:100px; padding:4px 8px; font-size:0.9rem; color:#fff; background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.3); border-radius:4px;">
          <select id="combat-custom-type" class="custom-input" style="padding:4px 8px; font-size:0.9rem; flex:1; color:#fff; background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.3); border-radius:4px;">
            <option value="Physical" style="color:#000;">Physical (Slashing/Piercing/Bludg.)</option>
            <option value="Elemental" style="color:#000;">Elemental/Divine (Fire, Ice, Holy, etc)</option>
          </select>
          <button class="btn btn-primary btn-xs" onclick="window.BB_VTT.executeCombatAction(document.getElementById('combat-custom-dmg').value + ' ' + document.getElementById('combat-custom-type').value, 'Custom Attack')">Roll</button>
        </div>
      </div>

      <div style="background:rgba(0,0,0,0.4); padding:10px; border-radius:4px;">
        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--amber); margin-bottom:5px;">Target Modifiers</div>
        <div style="display:flex; gap:15px; font-size:0.85rem;">
          <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" id="combat-target-res"> Resistance (Half Dmg)</label>
          <label style="display:flex; align-items:center; gap:5px; cursor:pointer;"><input type="checkbox" id="combat-target-vul"> Vulnerability (+50% Dmg)</label>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function executeCombatAction(damageString, sourceName) {
    if (!combatAttacker || !combatTarget) return;

    // Parse damage string: e.g., "1d8 + Str Physical" or "2d6 + Int Fire"
    // We'll roll the dice part and evaluate modifiers based on Attacker's stats if applicable.
    
    // Very simple parser for proof of concept
    let rawStr = damageString.toLowerCase();
    
    // Default to physical if not specified
    let isMagical = false;
    const magicalTypes = ["fire", "ice", "earth", "lightning", "thunder", "air", "water", "holy", "dark", "nature", "magic", "elemental", "divine"];
    for (let t of magicalTypes) {
      if (rawStr.includes(t)) {
        isMagical = true;
        break;
      }
    }

    // Extract dice: "2d6"
    let dieCount = 0;
    let dieType = 0;
    const diceMatch = rawStr.match(/(\d+)d(\d+)/);
    if (diceMatch) {
      dieCount = parseInt(diceMatch[1]);
      dieType = parseInt(diceMatch[2]);
    }

    // Evaluate Stat Modifiers
    let statModifier = 0;
    const chars = window.BB_STATE.getSavedCharacters() || [];
    let atkRaw = null;
    if (combatAttacker.token.charId) {
      atkRaw = chars.find(c => c.id === combatAttacker.token.charId);
      if (atkRaw) {
        if (rawStr.includes("str")) statModifier += window.BB_STATE.getModifier(atkRaw.stats.Str);
        if (rawStr.includes("dex")) statModifier += window.BB_STATE.getModifier(atkRaw.stats.Dex);
        if (rawStr.includes("con")) statModifier += window.BB_STATE.getModifier(atkRaw.stats.Con);
        if (rawStr.includes("int")) statModifier += window.BB_STATE.getModifier(atkRaw.stats.Int);
        if (rawStr.includes("wis")) statModifier += window.BB_STATE.getModifier(atkRaw.stats.Wis);
        if (rawStr.includes("cha")) statModifier += window.BB_STATE.getModifier(atkRaw.stats.Cha);
      }
    }

    // Check for flat numbers like +3
    // Remove "+ str" etc first to avoid matching them
    let cleanStr = rawStr.replace(/\+\s*(str|dex|con|int|wis|cha)/g, "");
    const flatMatch = cleanStr.match(/\+\s*(\d+)/);
    if (flatMatch) {
      statModifier += parseInt(flatMatch[1]);
    }

    // Roll the dice manually (since BB_DICE requires UI interaction, we'll simulate the roll and display it)
    let rollTotal = 0;
    let rolls = [];
    if (dieCount > 0 && dieType > 0) {
      for(let i=0; i<dieCount; i++){
        const r = Math.floor(Math.random() * dieType) + 1;
        rolls.push(r);
        rollTotal += r;
      }
    } else {
      // If no dice matched (e.g. they typed a flat number), use the flat number
      const flatDmg = parseInt(rawStr);
      if (!isNaN(flatDmg)) rollTotal = flatDmg;
    }

    const baseDamage = rollTotal + statModifier;

    // TARGET REDUCTION
    let tgtRaw = null;
    let tgtDef = 0;
    let tgtRes = 0;
    let isMonster = false;

    if (combatTarget.token.charId) {
      tgtRaw = chars.find(c => c.id === combatTarget.token.charId);
      if (tgtRaw) {
        let stats = hydrateCharacterStats(tgtRaw);
        tgtDef = stats.defense;
        tgtRes = stats.resilience;
      }
    } else if (combatTarget.token.monsterId) {
      isMonster = true;
      tgtDef = combatTarget.token.defense || 0;
      tgtRes = combatTarget.token.resilience || 0;
    }

    let isResistant = document.getElementById("combat-target-res")?.checked;
    let isVulnerable = document.getElementById("combat-target-vul")?.checked;

    if (isResistant && isVulnerable) {
      isResistant = false;
      isVulnerable = false;
    }

    let finalDamage = baseDamage;
    if (isVulnerable) finalDamage += Math.ceil(baseDamage / 2);
    if (isResistant) finalDamage = Math.floor(finalDamage / 2);

    if (isMagical) {
      finalDamage -= tgtRes;
    } else {
      finalDamage -= tgtDef;
    }
    
    finalDamage = Math.max(0, finalDamage);

    // Apply Damage
    if (tgtRaw) {
      tgtRaw.hp.current = Math.max(0, tgtRaw.hp.current - finalDamage);
      window.BB_STATE.saveCharacter(tgtRaw);
      
      // Update UI if sheet is open
      if (typeof window.BB_SHEET !== "undefined" && window.BB_SHEET.renderLayout) {
        // We only trigger update if it's the active character. For safety, just let user see it in statblock.
      }
    } else if (isMonster) {
      combatTarget.token.currentHp -= finalDamage;
      drawCanvas(); // Render any visual changes if necessary
    }

    // Notify
    if (window.BB_DICE) {
      const dmgTypeStr = isMagical ? "Magical/Elemental" : "Physical";
      const reduction = isMagical ? tgtRes : tgtDef;
      let msg = `<b>${combatAttacker.token.initial} attacks ${combatTarget.token.initial} with ${sourceName}</b><br>`;
      if (rolls.length > 0) msg += `Rolled [${rolls.join(", ")}] + ${statModifier} = ${baseDamage} ${dmgTypeStr} damage.<br>`;
      else msg += `Base ${baseDamage} ${dmgTypeStr} damage.<br>`;
      
      msg += `Reduced by ${reduction} (${isMagical ? 'Resilience' : 'Defense'}). `;
      if (isResistant) msg += "Target is Resistant! ";
      if (isVulnerable) msg += "Target is Vulnerable! ";
      
      msg += `<br><strong style="color:var(--amber);">Final Damage: ${finalDamage}</strong>`;
      
      // Use the generic toast, or custom alert. Since toast is small, maybe just alert or long toast.
      // We'll hack a custom combat log modal or alert:
      let alertMsg = `COMBAT RESULT\n\nAttacker: ${sourceName}\nBase Damage: ${baseDamage} ${dmgTypeStr}\n`;
      if (isResistant) alertMsg += `Target is RESISTANT (Damage Halved)\n`;
      if (isVulnerable) alertMsg += `Target is VULNERABLE (+50% Damage)\n`;
      alertMsg += `Reduced by: ${reduction} (${isMagical ? 'Res' : 'Def'})\nFinal Damage dealt: ${finalDamage}\n\n`;
      alertMsg += `${tgtRaw ? `Target HP remaining: ${tgtRaw.hp.current}` : (isMonster ? `Monster HP remaining: ${combatTarget.token.currentHp}` : 'Target is an Enemy Token (HP not tracked).')}`;
      alert(alertMsg);
    }
    
    // Clear selection and close modal
    hideCombatModal();
    combatAttacker = null;
    combatTarget = null;
    drawCanvas();
  }

  function executeSaveAction(saveStat, dc, damageString, sourceName) {
    if (!combatAttacker || !combatTarget) return;
    
    // 1. Get Target Stats
    let tgtRaw = null;
    let saveMod = 0;
    const chars = window.BB_STATE.getSavedCharacters() || [];
    let isMonster = false;
    let staminaLoss = 0;

    if (combatTarget.token.charId) {
      tgtRaw = chars.find(c => c.id === combatTarget.token.charId);
      if (tgtRaw) {
        saveMod = window.BB_STATE.getModifier(tgtRaw.stats[saveStat] || 10);
      }
    } else if (combatTarget.token.monsterId || combatTarget.token.classId) {
      isMonster = true;
      const monsterName = combatTarget.token.classId;
      const monsterData = window.BB_DATABASE.MONSTERS.find(m => m.name === monsterName);
      if (monsterData && monsterData.stats) {
         saveMod = window.BB_STATE.getModifier(monsterData.stats[saveStat] || 10);
      }
    }

    // 2. Roll Saving Throw
    const roll = Math.floor(Math.random() * 20) + 1;
    const totalSave = roll + saveMod;
    const savePassed = totalSave >= dc;

    // 3. Calculate Base Damage
    let rawStr = damageString.toLowerCase();
    let isMagical = false;
    const magicalTypes = ["fire", "ice", "earth", "lightning", "thunder", "air", "water", "holy", "dark", "nature", "magic", "elemental", "divine"];
    for (let t of magicalTypes) {
      if (rawStr.includes(t)) {
        isMagical = true;
        break;
      }
    }
    let dieCount = 0;
    let dieType = 0;
    const diceMatch = rawStr.match(/(\d+)d(\d+)/);
    if (diceMatch) {
      dieCount = parseInt(diceMatch[1]);
      dieType = parseInt(diceMatch[2]);
    }
    let rollTotal = 0;
    let dmgRolls = [];
    if (dieCount > 0 && dieType > 0) {
      for(let i=0; i<dieCount; i++){
        const r = Math.floor(Math.random() * dieType) + 1;
        dmgRolls.push(r);
        rollTotal += r;
      }
    } else {
      const flatDmg = parseInt(rawStr);
      if (!isNaN(flatDmg)) rollTotal = flatDmg;
    }

    let flatMatch = rawStr.replace(/\+\s*(str|dex|con|int|wis|cha)/g, "").match(/\+\s*(\d+)/);
    let statModifier = flatMatch ? parseInt(flatMatch[1]) : 0;
    let baseDamage = rollTotal + statModifier;

    // 4. Special Logics
    let bonusDamage = 0;
    if (sourceName === "Consume Stamina") {
       staminaLoss = Math.floor(Math.random() * 4) + 1; // 1d4
       if (tgtRaw && tgtRaw.sp) {
          if (tgtRaw.sp.current <= 0) {
             bonusDamage = Math.floor(Math.random() * 6) + 1; // 1d6
             staminaLoss = 0; // nothing to lose
          }
       }
    }
    
    let finalDamage = baseDamage + bonusDamage;

    if (savePassed) {
       finalDamage = Math.floor(finalDamage / 2);
       staminaLoss = Math.floor(staminaLoss / 2);
    }
    
    let isResistant = document.getElementById("combat-target-res")?.checked;
    let isVulnerable = document.getElementById("combat-target-vul")?.checked;

    if (isResistant && isVulnerable) {
      isResistant = false;
      isVulnerable = false;
    }
    
    if (isVulnerable) finalDamage += Math.ceil(finalDamage / 2);
    if (isResistant) finalDamage = Math.floor(finalDamage / 2);

    let tgtDef = 0, tgtRes = 0;
    if (tgtRaw) {
      let stats = hydrateCharacterStats(tgtRaw);
      tgtDef = stats.defense;
      tgtRes = stats.resilience;
    } else if (isMonster) {
      tgtDef = combatTarget.token.defense || 0;
      tgtRes = combatTarget.token.resilience || 0;
    }

    if (isMagical) {
      finalDamage -= tgtRes;
    } else {
      finalDamage -= tgtDef;
    }
    finalDamage = Math.max(0, finalDamage);

    // 5. Apply Output
    if (tgtRaw) {
      tgtRaw.hp.current = Math.max(0, tgtRaw.hp.current - finalDamage);
      if (staminaLoss > 0 && tgtRaw.sp) {
         tgtRaw.sp.current = Math.max(0, tgtRaw.sp.current - staminaLoss);
      }
      window.BB_STATE.saveCharacter(tgtRaw);
    } else if (isMonster) {
      combatTarget.token.currentHp -= finalDamage;
    }
    
    let healAmount = 0;
    if (sourceName === "Consume Stamina") {
       healAmount = finalDamage;
       if (combatAttacker.token.charId) {
          const atkChar = chars.find(c => c.id === combatAttacker.token.charId);
          if (atkChar) {
             atkChar.hp.current = Math.min(atkChar.hp.total, atkChar.hp.current + healAmount);
             window.BB_STATE.saveCharacter(atkChar);
          }
       } else if (combatAttacker.token.currentHp !== undefined) {
          combatAttacker.token.currentHp = Math.min(combatAttacker.token.maxHp || 999, combatAttacker.token.currentHp + healAmount);
       }
    }

    // 6. Log to Combat Log Panel
    let logHtml = `
      <div style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; padding: 10px; font-size: 0.85rem; color: #fff;">
        <div style="color: var(--amber); font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 4px;">COMBAT RESULT: ${sourceName}</div>
        <div style="margin-bottom: 8px;">Target rolled ${saveStat} Save: ${roll} + ${saveMod} = ${totalSave} vs DC ${dc}</div>
        <div style="color: ${savePassed ? '#40c057' : '#ff6b6b'}; font-weight: bold; margin-bottom: 8px;">-> SAVE ${savePassed ? 'PASSED! (Half damage/effects)' : 'FAILED!'}</div>
        <div style="margin-bottom: 4px;">Damage Rolled: [${dmgRolls.join(", ")}] = ${baseDamage}${bonusDamage > 0 ? ` <span style="color:#fcc419;">(+${bonusDamage} Out of Stamina Bonus!)</span>` : ''}</div>
        <div style="margin-bottom: 8px; color: #ff6b6b; font-weight: bold;">Final Damage: ${finalDamage} (after Def/Res)</div>
    `;
    if (staminaLoss > 0) logHtml += `<div style="margin-bottom: 4px; color: #fcc419;">Stamina Drain: ${staminaLoss}</div>`;
    if (healAmount > 0) logHtml += `<div style="margin-bottom: 8px; color: #40c057;">Healed Attacker for: ${healAmount} HP</div>`;
    
    logHtml += `<div style="margin-top: 8px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1); color: #aaa; font-size: 0.75rem;">`;
    logHtml += `${tgtRaw ? `Target HP remaining: ${tgtRaw.hp.current}` : (isMonster ? `Monster HP remaining: ${combatTarget.token.currentHp}` : 'HP not tracked.')}`;
    if (tgtRaw && tgtRaw.sp) logHtml += `<br>Target Stamina remaining: ${tgtRaw.sp.current}`;
    logHtml += `</div></div>`;
    
    const logPanel = document.getElementById("vtt-combat-log-content");
    if (logPanel) {
      if (logPanel.innerHTML.includes("Combat events will appear here.")) {
        logPanel.innerHTML = "";
      }
      logPanel.insertAdjacentHTML('afterbegin', logHtml);
    }

    hideCombatModal();
    combatAttacker = null;
    combatTarget = null;
    drawCanvas();
  }

  function resetMovement() {
    if (!activeMap || !activeMap.tokens) return;
    for (let y = 0; y < activeMap.height; y++) {
      for (let x = 0; x < activeMap.width; x++) {
        const t = activeMap.tokens[y][x];
        if (t && typeof t === "object") {
          delete t.movementRemaining;
        }
      }
    }
    const sb = document.getElementById("mini-statblock");
    if (sb) sb.style.display = "none";
    if (window.BB_DICE) window.BB_DICE.showToastNotification("All token movement has been reset.");
    drawCanvas();
  }

  function calculateTokenLuckMod(token) {
    if (token.charId) {
      const c = (window.BB_STATE.getSavedCharacters()||[]).find(x => x.id === token.charId);
      if (c) {
        let lck = c.stats.Lck || 10;
        lck += getEquipStatBonus(c, "Lck");
        return window.BB_STATE.getModifier(lck);
      }
    } else if (token.monsterId) {
      const m = window.BB_DATABASE.MONSTERS.find(x => x.name === token.monsterId);
      if (m && m.stats) {
        let lck = m.stats.Lck || 10;
        return Math.floor((lck - 10) / 2);
      }
    }
    return 0; // Default mod 0
  }

  function startCombat() {
    if (!activeMap || !activeMap.tokens) return;
    initiativeOrder = [];
    roundNumber = 1;
    currentTurnIndex = 0;

    for (let y = 0; y < activeMap.height; y++) {
      for (let x = 0; x < activeMap.width; x++) {
        const token = activeMap.tokens[y][x];
        if (token && typeof token === "object") {
          // Reset action economy and movement for all tokens globally
          delete token.movementRemaining;
          token.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
          
          if (token.charId) {
            const rawChar = (window.BB_STATE.getSavedCharacters() || []).find(c => c.id === token.charId);
            if (rawChar) {
              rawChar.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
              if (window.BB_STATE.saveCharacter) window.BB_STATE.saveCharacter(rawChar);
            }
          }

          const lckMod = calculateTokenLuckMod(token);
          const roll = Math.floor(Math.random() * 20) + 1;
          const total = Math.max(1, roll + lckMod);
          
          let name = "Unknown";
          if (token.charId) {
            const c = (window.BB_STATE.getSavedCharacters()||[]).find(x => x.id === token.charId);
            if (c) name = c.name;
          } else if (token.monsterId) {
            name = token.monsterId;
          } else if (token.type) {
            name = token.type;
          }

          initiativeOrder.push({
            id: `${x},${y}`,
            x: x,
            y: y,
            token: token,
            name: name,
            roll: total,
            baseLck: lckMod
          });
        }
      }
    }

    if (initiativeOrder.length === 0) {
      if (window.BB_DICE) window.BB_DICE.showToastNotification("No tokens on the map to start combat.");
      return;
    }

    // Sort descending by roll, then by baseLck, then random
    initiativeOrder.sort((a, b) => {
      if (b.roll !== a.roll) return b.roll - a.roll;
      if (b.baseLck !== a.baseLck) return b.baseLck - a.baseLck;
      return Math.random() - 0.5;
    });

    document.getElementById("vtt-initiative-controls").style.display = "flex";
    
    // Reset movement and action economy for first turn
    const activeEntry = initiativeOrder[currentTurnIndex];
    if (activeEntry && activeEntry.token) {
      delete activeEntry.token.movementRemaining;
      if (activeEntry.token.combatState) {
        activeEntry.token.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
      }
      
      let foundX = -1, foundY = -1;
      for (let y = 0; y < activeMap.height; y++) {
        for (let x = 0; x < activeMap.width; x++) {
          if (activeMap.tokens[y][x] === activeEntry.token) {
            foundX = x; foundY = y;
            break;
          }
        }
        if (foundX !== -1) break;
      }
      if (foundX !== -1) {
         selectedToken = { x: foundX, y: foundY };
         renderSelectedTokenInfo();
      }
    }

    renderInitiativeTracker();
    drawCanvas();
    if (window.BB_DICE) window.BB_DICE.showToastNotification("Combat Started! Rolls generated.");
  }

  function nextTurn() {
    if (initiativeOrder.length === 0) return;
    currentTurnIndex++;
    if (currentTurnIndex >= initiativeOrder.length) {
      currentTurnIndex = 0;
      roundNumber++;
    }
    
    // Reset movement and action economy for new active turn
    const activeEntry = initiativeOrder[currentTurnIndex];
    if (activeEntry && activeEntry.token) {
      delete activeEntry.token.movementRemaining;
      if (activeEntry.token.combatState) {
        activeEntry.token.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
      }
      if (activeEntry.token.charId) {
        const rawChar = (window.BB_STATE.getSavedCharacters() || []).find(c => c.id === activeEntry.token.charId);
        if (rawChar) {
          rawChar.combatState = { action: false, bonusAction: false, reaction: false, movement: false };
          if (window.BB_STATE.saveCharacter) window.BB_STATE.saveCharacter(rawChar);
        }
      }
      
      let foundX = -1, foundY = -1;
      for (let y = 0; y < activeMap.height; y++) {
        for (let x = 0; x < activeMap.width; x++) {
          if (activeMap.tokens[y][x] === activeEntry.token) {
            foundX = x; foundY = y;
            break;
          }
        }
        if (foundX !== -1) break;
      }
      if (foundX !== -1) {
         selectedToken = { x: foundX, y: foundY };
         renderSelectedTokenInfo();
      }
    }

    renderInitiativeTracker();
    drawCanvas();
  }

  function endCombat() {
    initiativeOrder = [];
    currentTurnIndex = 0;
    roundNumber = 1;
    document.getElementById("vtt-initiative-controls").style.display = "none";
    renderInitiativeTracker();
    drawCanvas();
    if (window.BB_DICE) window.BB_DICE.showToastNotification("Combat Ended.");
  }

  function renderInitiativeTracker() {
    const listDiv = document.getElementById("vtt-initiative-list");
    if (!listDiv) return;

    if (initiativeOrder.length === 0) {
      listDiv.innerHTML = `<div style="color:var(--text-light); font-size:0.9rem;">No active combat.</div>`;
      return;
    }

    let html = `<div style="color:var(--amber); font-size:0.8rem; margin-bottom:5px;">Round ${roundNumber}</div>`;
    
    initiativeOrder.forEach((entry, index) => {
      const isActive = index === currentTurnIndex;
      const bg = isActive ? "rgba(255,193,7,0.2)" : "rgba(0,0,0,0.5)";
      const border = isActive ? "1px solid var(--amber)" : "1px solid transparent";
      const textColor = isActive ? "#fff" : "var(--text-light)";
      html += `
        <div style="background:${bg}; border:${border}; color:${textColor}; padding:5px 8px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:${isActive ? 'bold' : 'normal'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${isActive ? '▶ ' : ''}${entry.name}</span>
          <span style="font-weight:bold; color:var(--amber);">${entry.roll}</span>
        </div>
      `;
    });

    listDiv.innerHTML = html;
  }

  function zoomIn() {
    currentZoom = Math.min(3.0, currentZoom + 0.1);
    updateZoomDisplay();
    drawCanvas();
  }

  function zoomOut() {
    currentZoom = Math.max(0.5, currentZoom - 0.1);
    updateZoomDisplay();
    drawCanvas();
  }

  function updateZoomDisplay() {
    const el = document.getElementById("vtt-zoom-display");
    if (el) el.innerText = Math.round(currentZoom * 100) + "%";
  }

  return {
    init,
    selectTool,
    fillFog,
    saveVTTState,
    resetMovement,
    toggleDicePanel,
    performVttRoll,
    performVttCustomRoll,
    hideCombatModal,
    showCombatModal,
    executeCombatAction,
    startCombat,
    nextTurn,
    endCombat,
    zoomIn,
    zoomOut,
    executeSaveAction
  };
})();
