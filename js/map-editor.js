// B&B Map Editor Module
window.BB_MAP_EDITOR = (() => {
  let container = null;
  let canvas = null;
  let ctx = null;
  
  // Editor State
  let activeMap = null;
  let isPainting = false;
  let currentTool = "Grass"; // Default
  const TILE_SIZE = 40;
  let currentZoom = 1.0;

  // Colors / Styles for tools
  const TOOLS = {
    "Grass": "#40c057",
    "Water": "#339af0",
    "Stone": "#868e96",
    "Wood":  "#854d0e",
    "Dirt":  "#a0522d",
    "Wall":  "#212529",
    "Door":  "#8B4513",
    "Passable": null,
    "Impassable": "rgba(255, 0, 0, 0.3)",
    "Player Token": "#4dabf7",
    "Monster Token": "#ff6b6b",
    "NPC Token": "#fcc419",
    "Eraser": null
  };

  function init() {
    container = document.getElementById("main-view-container");
    if (!container) return;

    renderEditorLayout();
    loadMapList();
    setupBlankMap();
  }

  function renderEditorLayout() {
    container.innerHTML = `
      <div style="display: flex; height: calc(100vh - 90px); max-width: 1400px; margin: 0 auto; gap: 20px; padding: 20px;">
        
        <!-- Left Sidebar -->
        <div class="glass" style="width: 250px; flex-shrink: 0; padding: 15px; border-radius: 8px; display: flex; flex-direction: column;">
          <h2 style="margin-top: 0; color: var(--amber); border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 10px;">Map Editor</h2>
          
          <div style="margin-bottom: 20px;">
            <label style="display:block; font-size: 0.85rem; color: var(--text-light); margin-bottom: 5px;">Map Name</label>
            <input type="text" id="map-name" placeholder="Untitled Map" class="form-control" style="width: 100%; margin-bottom: 10px;">
            
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
              <div style="flex: 1;">
                <label style="display:block; font-size: 0.85rem; color: var(--text-light); margin-bottom: 5px;">Width</label>
                <input type="number" id="map-width" value="20" min="5" max="50" class="form-control" style="width: 100%;" onchange="window.BB_MAP_EDITOR.resizeMap()">
              </div>
              <div style="flex: 1;">
                <label style="display:block; font-size: 0.85rem; color: var(--text-light); margin-bottom: 5px;">Height</label>
                <input type="number" id="map-height" value="15" min="5" max="50" class="form-control" style="width: 100%;" onchange="window.BB_MAP_EDITOR.resizeMap()">
              </div>
            </div>

            <div style="display: flex; gap: 5px;">
              <button class="btn btn-primary" onclick="window.BB_MAP_EDITOR.saveCurrentMap()" style="flex: 1;">Save</button>
              <button class="btn btn-secondary" onclick="window.BB_MAP_EDITOR.exportMap()" title="Export as Image" style="flex: 1;">PNG</button>
              <button class="btn btn-secondary" onclick="window.BB_MAP_EDITOR.exportMapData()" title="Export Data to Share" style="flex: 1;">Export</button>
            </div>
            <div style="display: flex; gap: 5px; margin-top: 5px;">
              <button class="btn btn-danger" onclick="window.BB_MAP_EDITOR.clearMap()" style="flex: 1;">Clear</button>
              <button class="btn btn-primary" onclick="document.getElementById('map-import-input').click()" style="flex: 1;">Import</button>
              <input type="file" id="map-import-input" accept=".json" style="display: none;" onchange="window.BB_MAP_EDITOR.importMapData(event)">
            </div>
          </div>

          <h3 style="margin: 0 0 10px 0; color: #fff; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">Saved Maps</h3>
          <div id="saved-maps-list" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
            <!-- Maps load here -->
          </div>
        </div>

        <!-- Canvas Area -->
        <div class="glass" style="flex: 1; min-width: 0; min-height: 0; border-radius: 8px; overflow: auto; display: flex; background: rgba(0,0,0,0.7); position: relative;" id="map-canvas-container">
          <canvas id="map-canvas" style="background: #e9ecef; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin: auto;"></canvas>
          
          <div style="position:absolute; bottom:15px; right:15px; z-index:150; background:rgba(0,0,0,0.8); border:1px solid rgba(255,255,255,0.2); border-radius:4px; padding:5px; display:flex; gap:5px; align-items:center;">
             <button class="btn btn-secondary btn-xs" onclick="window.BB_MAP_EDITOR.zoomOut()" style="width:24px; height:24px; padding:0; display:flex; justify-content:center; align-items:center;">-</button>
             <span id="map-zoom-display" style="color:#fff; font-size:0.8rem; font-family:var(--font-mono); width:40px; text-align:center;">100%</span>
             <button class="btn btn-secondary btn-xs" onclick="window.BB_MAP_EDITOR.zoomIn()" style="width:24px; height:24px; padding:0; display:flex; justify-content:center; align-items:center;">+</button>
          </div>
        </div>

        <!-- Right Sidebar (Palette & Tokens) -->
        <div class="glass" style="width: 250px; flex-shrink: 0; padding: 15px; border-radius: 8px; display: flex; flex-direction: column;">
          
          <!-- Tabs -->
          <div style="display: flex; gap: 5px; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
             <button id="tab-btn-palette" class="btn btn-primary" style="flex: 1; padding: 5px;" onclick="window.BB_MAP_EDITOR.switchTab('palette')">Palette</button>
             <button id="tab-btn-tokens" class="btn btn-secondary" style="flex: 1; padding: 5px;" onclick="window.BB_MAP_EDITOR.switchTab('tokens')">Tokens</button>
          </div>

          <!-- Palette Content -->
          <div id="tab-content-palette" style="display: block;">
            <div style="display: flex; gap: 5px; margin-bottom: 10px;">
              <select id="palette-category-select" class="form-control" style="flex: 1; background: rgba(0,0,0,0.5); color: #fff; font-size: 0.85rem;" onchange="window.BB_MAP_EDITOR.switchPaletteCategory()">
                <option value="terrain">Terrain</option>
                <option value="doodad">Doodad</option>
                <option value="structure">Structure</option>
              </select>
                <button class="btn btn-primary" style="padding: 5px 10px; font-size: 0.85rem; margin-right: 5px;" onclick="document.getElementById('map-asset-upload').click()">+ Image</button>
                <button class="btn" style="padding: 5px 10px; font-size: 0.85rem; background: #e74c3c; color: #fff; border: none;" onclick="window.BB_MAP_EDITOR.clearCategoryAssets()">Trash All</button>
                <input type="file" id="map-asset-upload" accept="image/*" multiple style="display:none;" onchange="window.BB_MAP_EDITOR.handleAssetUpload(event)">
            </div>

            <div id="palette-grid-terrain" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;"></div>
            <div id="palette-grid-doodad" style="display: none; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;"></div>
            <div id="palette-grid-structure" style="display: none; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;"></div>
          </div>

          <!-- Tokens Content -->
          <div id="tab-content-tokens" style="display: none;">
            <div id="palette-grid-tokens" style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 15px;"></div>
            
            <div style="margin-bottom: 10px;">
              <select id="map-char-select" class="form-control" style="width: 100%; background: rgba(0,0,0,0.5); color: #fff; font-size: 0.85rem; margin-bottom: 5px; display: none;">
                <!-- Populated dynamically -->
              </select>
              <select id="map-monster-select" class="form-control" style="width: 100%; background: rgba(0,0,0,0.5); color: #fff; font-size: 0.85rem; display: none;">
                <!-- Populated dynamically -->
              </select>
              <input type="text" id="map-npc-input" class="form-control" style="width: 100%; background: rgba(0,0,0,0.5); color: #fff; font-size: 0.85rem; margin-bottom: 5px; display: none;" placeholder="NPC Name">
            </div>
          </div>
        </div>

      </div>
    `;

    canvas = document.getElementById("map-canvas");
    ctx = canvas.getContext("2d");

    // Canvas Events
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    
    const canvasContainer = document.getElementById("map-canvas-container");
    if (canvasContainer) {
      canvasContainer.addEventListener("wheel", (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.deltaY < 0) zoomIn();
          else zoomOut();
        }
      }, { passive: false });
    }
    
    // Populate Character Select
    const charSelect = document.getElementById("map-char-select");
    const chars = window.BB_STATE.getSavedCharacters() || [];
    chars.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      charSelect.appendChild(opt);
    });

    // Populate Monster Select
    const monsterSelect = document.getElementById("map-monster-select");
    if (window.BB_DATABASE && window.BB_DATABASE.MONSTERS) {
       window.BB_DATABASE.MONSTERS.forEach(m => {
          const opt = document.createElement("option");
          opt.value = m.name;
          opt.textContent = m.name;
          monsterSelect.appendChild(opt);
       });
    }

    refreshPaletteUI();
  }

  function refreshPaletteUI() {
    const terrain = document.getElementById("palette-grid-terrain");
    const doodad = document.getElementById("palette-grid-doodad");
    const structure = document.getElementById("palette-grid-structure");
    const tokens = document.getElementById("palette-grid-tokens");
    
    if (terrain) terrain.innerHTML = getDefaultToolsHTML(['Grass', 'Water', 'Stone', 'Wood', 'Dirt', 'Passable', 'Impassable', 'Eraser']) + renderAssetButtons("terrain");
    if (doodad) doodad.innerHTML = getDefaultToolsHTML(['Eraser']) + renderAssetButtons("doodad");
    if (structure) structure.innerHTML = getDefaultToolsHTML(['Wall', 'Door', 'Eraser']) + renderAssetButtons("structure");
    if (tokens) tokens.innerHTML = getDefaultToolsHTML(['Player Token', 'Monster Token', 'NPC Token', 'Eraser']) + renderAssetButtons("token");
  }

  function getDefaultToolsHTML(toolsList) {
    return toolsList.map(tool => `
      <button class="btn btn-xs map-tool-btn default-tool-btn" data-tool="${tool}" onclick="window.BB_MAP_EDITOR.selectTool('${tool}')" style="display:flex; align-items:center; gap:5px; background: rgba(0,0,0,0.5); border: 2px solid ${typeof currentTool === 'string' && currentTool === tool ? 'var(--amber)' : 'transparent'};">
        <span style="display:inline-block; width:12px; height:12px; background:${TOOLS[tool] || 'transparent'}; border:1px solid rgba(255,255,255,0.2);"></span> ${tool}
      </button>
    `).join('');
  }

  function renderAssetButtons(category) {
    if (!window.BB_ASSETS) return "";
    const assets = window.BB_ASSETS.getAssetsByCategory(category);
    return assets.map(a => `
      <div style="position: relative; display: inline-block; width: 100%;">
        <button class="btn btn-xs map-tool-btn custom-asset-btn" data-tool="custom_${a.id}" onclick="window.BB_MAP_EDITOR.selectCustomTool('${a.id}', '${category}')" style="display:flex; flex-direction:column; align-items:center; gap:2px; background: rgba(0,0,0,0.5); border: 2px solid ${(typeof currentTool === 'object' && currentTool.id === a.id) ? 'var(--amber)' : 'transparent'}; padding: 4px; width: 100%;">
          <img src="${a.url}" style="width: 24px; height: 24px; object-fit: contain;">
          <span style="font-size: 0.6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center;">${a.name}</span>
        </button>
        <button onclick="window.BB_MAP_EDITOR.deleteCustomAsset(event, '${a.id}')" style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; line-height: 16px; text-align: center; cursor: pointer; padding: 0;" title="Delete Asset">×</button>
      </div>
    `).join('');
  }

  function sliceImage(img, cols, rows, category, baseName) {
    return new Promise(async (resolve) => {
      const tileW = img.width / cols;
      const tileH = img.height / rows;
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = tileW;
      sliceCanvas.height = tileH;
      const sliceCtx = sliceCanvas.getContext("2d");
      
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
           sliceCtx.clearRect(0, 0, tileW, tileH);
           sliceCtx.drawImage(img, c * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH);
           
           await new Promise((res) => {
             sliceCanvas.toBlob(async (blob) => {
                if (blob) {
                   await window.BB_ASSETS.saveAsset(blob, category, `${baseName}_${c}_${r}`);
                }
                res();
             }, "image/png");
           });
        }
      }
      resolve();
    });
  }

  async function handleAssetUpload(e) {
    try {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      
      const cat = document.getElementById("palette-category-select").value; 
      let category = prompt("Which category should these assets go to? (terrain, doodad, structure, token)", cat);
      if (!category) { e.target.value = ""; return; }
      category = category.toLowerCase().trim();
      if (!["terrain", "doodad", "structure", "token"].includes(category)) category = "terrain";

      let gridInput = prompt("If this is a spritesheet/tileset, enter dimensions (e.g. 4x4) or type 'autotile 8x6' for smart autotiling. Type 'rpgmaker' to bulk-import an RPG Maker A2 sheet. Otherwise leave blank:");
      let isGrid = false;
      let isAutotile = false;
      let isRpgMaker = false;
      let cols = 1, rows = 1;
      
      if (gridInput && gridInput.toLowerCase().trim() === "rpgmaker") {
        isRpgMaker = true;
      } else if (gridInput && gridInput.toLowerCase().trim().startsWith("autotile")) {
        isAutotile = true;
        const dimensionStr = gridInput.toLowerCase().replace("autotile", "").trim();
        if (dimensionStr.includes("x")) {
           const parts = dimensionStr.split("x");
           cols = parseInt(parts[0]) || 8;
           rows = parseInt(parts[1]) || 6;
        } else {
           cols = 8;
           rows = 6;
        }
      } else if (gridInput && gridInput.toLowerCase().includes("x")) {
        const parts = gridInput.toLowerCase().split("x");
        cols = parseInt(parts[0]) || 1;
        rows = parseInt(parts[1]) || 1;
        if (cols > 1 || rows > 1) isGrid = true;
      }

      for (const file of files) {
        if (isRpgMaker) {
           await window.BB_ASSETS.convertRPGMakerA2(file, category, file.name.split('.')[0]);
        } else if (isAutotile) {
           await window.BB_ASSETS.saveAsset(file, category, file.name.split('.')[0] + " (Autotile)", true, cols, rows);
        } else if (isGrid) {
          await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
               try {
                 await sliceImage(img, cols, rows, category, file.name.split('.')[0]);
                 resolve();
               } catch (err) {
                 reject(err);
               }
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
          });
        } else {
          await window.BB_ASSETS.saveAsset(file, category, file.name);
        }
      }
      
      refreshPaletteUI();
    } catch (err) {
      console.error(err);
      alert("Error uploading asset: " + err.message);
    } finally {
      e.target.value = "";
    }
  }

    function selectCustomTool(id, category) {
      currentTool = { type: 'custom', id, category };
      refreshPaletteUI();
      
      const charSel = document.getElementById("map-char-select");
      const monSel = document.getElementById("map-monster-select");
      const npcSel = document.getElementById("map-npc-input");
      if (charSel) charSel.style.display = "none";
      if (monSel) monSel.style.display = "none";
      if (npcSel) npcSel.style.display = "none";
    }

    async function deleteCustomAsset(e, id) {
      e.stopPropagation();
      if (confirm("Are you sure you want to delete this custom asset?")) {
        await window.BB_ASSETS.deleteAsset(id);
        if (typeof currentTool === 'object' && currentTool.id === id) {
           currentTool = null;
        }
        refreshPaletteUI();
      }
    }

    async function clearCategoryAssets() {
      const cat = document.getElementById("palette-category-select").value;
      const assets = window.BB_ASSETS.getAssetsByCategory(cat);
      if (assets.length === 0) {
        alert("No assets to delete in this category.");
        return;
      }
      if (confirm(`Are you sure you want to permanently delete ALL ${assets.length} custom assets in the '${cat}' category? This cannot be undone.`)) {
        for (const a of assets) {
          await window.BB_ASSETS.deleteAsset(a.id);
          if (typeof currentTool === 'object' && currentTool.id === a.id) {
             currentTool = null;
          }
        }
        refreshPaletteUI();
      }
    }

  function selectTool(tool) {
    currentTool = tool;
    document.querySelectorAll(".map-tool-btn").forEach(btn => {
      btn.style.borderColor = btn.getAttribute("data-tool") === tool ? 'var(--amber)' : 'transparent';
    });
    const charSel = document.getElementById("map-char-select");
    const monSel = document.getElementById("map-monster-select");
    const npcSel = document.getElementById("map-npc-input");
    if (charSel) charSel.style.display = tool === "Player Token" ? "block" : "none";
    if (monSel) monSel.style.display = tool === "Monster Token" ? "block" : "none";
    if (npcSel) npcSel.style.display = tool === "NPC Token" ? "block" : "none";
  }

  function switchTab(tab) {
    const palBtn = document.getElementById("tab-btn-palette");
    const tokBtn = document.getElementById("tab-btn-tokens");
    const palCon = document.getElementById("tab-content-palette");
    const tokCon = document.getElementById("tab-content-tokens");
    
    if (palBtn) palBtn.className = tab === 'palette' ? "btn btn-primary" : "btn btn-secondary";
    if (tokBtn) tokBtn.className = tab === 'tokens' ? "btn btn-primary" : "btn btn-secondary";
    if (palCon) palCon.style.display = tab === 'palette' ? "block" : "none";
    if (tokCon) tokCon.style.display = tab === 'tokens' ? "block" : "none";
  }

  function switchPaletteCategory() {
    const cat = document.getElementById("palette-category-select").value;
    const terrain = document.getElementById("palette-grid-terrain");
    const doodad = document.getElementById("palette-grid-doodad");
    const structure = document.getElementById("palette-grid-structure");
    if (terrain) terrain.style.display = cat === "terrain" ? "grid" : "none";
    if (doodad) doodad.style.display = cat === "doodad" ? "grid" : "none";
    if (structure) structure.style.display = cat === "structure" ? "grid" : "none";
  }

  function setupBlankMap(width = 20, height = 15) {
    activeMap = {
      id: null,
      name: "",
      width: width,
      height: height,
      tiles: Array(height).fill().map(() => Array(width).fill(null)),
      tokens: Array(height).fill().map(() => Array(width).fill(null)),
      collision: Array(height).fill().map(() => Array(width).fill(false)),
      wallsHorizontal: Array(height + 1).fill().map(() => Array(width).fill(false)),
      wallsVertical: Array(height).fill().map(() => Array(width + 1).fill(false)),
      doorsHorizontal: Array(height + 1).fill().map(() => Array(width).fill(null)),
      doorsVertical: Array(height).fill().map(() => Array(width + 1).fill(null))
    };
    
    document.getElementById("map-name").value = "";
    document.getElementById("map-width").value = width;
    document.getElementById("map-height").value = height;
    
    applyMapToCanvas();
  }

  function resizeMap() {
    const newWidth = parseInt(document.getElementById("map-width").value) || 20;
    const newHeight = parseInt(document.getElementById("map-height").value) || 15;
    
    const newTiles = Array(newHeight).fill().map(() => Array(newWidth).fill(null));
    const newTokens = Array(newHeight).fill().map(() => Array(newWidth).fill(null));
    const newCollision = Array(newHeight).fill().map(() => Array(newWidth).fill(false));
    const newWallsH = Array(newHeight + 1).fill().map(() => Array(newWidth).fill(false));
    const newWallsV = Array(newHeight).fill().map(() => Array(newWidth + 1).fill(false));
    const newDoorsH = Array(newHeight + 1).fill().map(() => Array(newWidth).fill(null));
    const newDoorsV = Array(newHeight).fill().map(() => Array(newWidth + 1).fill(null));

    // Copy existing tiles, tokens, and collision
    for (let y = 0; y < Math.min(newHeight, activeMap.height); y++) {
      for (let x = 0; x < Math.min(newWidth, activeMap.width); x++) {
        newTiles[y][x] = activeMap.tiles[y][x];
        if (activeMap.tokens) newTokens[y][x] = activeMap.tokens[y][x];
        if (activeMap.collision) newCollision[y][x] = activeMap.collision[y][x];
      }
    }

    if (activeMap.wallsHorizontal) {
       for (let y = 0; y < Math.min(newHeight + 1, activeMap.wallsHorizontal.length); y++) {
          for (let x = 0; x < Math.min(newWidth, activeMap.width); x++) {
             newWallsH[y][x] = activeMap.wallsHorizontal[y][x];
          }
       }
    }
    if (activeMap.wallsVertical) {
       for (let y = 0; y < Math.min(newHeight, activeMap.height); y++) {
          for (let x = 0; x < Math.min(newWidth + 1, activeMap.wallsVertical[0].length); x++) {
             newWallsV[y][x] = activeMap.wallsVertical[y][x];
          }
       }
    }
    if (activeMap.doorsHorizontal) {
       for (let y = 0; y < Math.min(newHeight + 1, activeMap.doorsHorizontal.length); y++) {
          for (let x = 0; x < Math.min(newWidth, activeMap.width); x++) {
             newDoorsH[y][x] = activeMap.doorsHorizontal[y][x];
          }
       }
    }
    if (activeMap.doorsVertical) {
       for (let y = 0; y < Math.min(newHeight, activeMap.height); y++) {
          for (let x = 0; x < Math.min(newWidth + 1, activeMap.doorsVertical[0].length); x++) {
             newDoorsV[y][x] = activeMap.doorsVertical[y][x];
          }
       }
    }

    activeMap.width = newWidth;
    activeMap.height = newHeight;
    activeMap.tiles = newTiles;
    activeMap.tokens = newTokens;
    activeMap.collision = newCollision;
    activeMap.wallsHorizontal = newWallsH;
    activeMap.wallsVertical = newWallsV;
    activeMap.doorsHorizontal = newDoorsH;
    activeMap.doorsVertical = newDoorsV;
    
    applyMapToCanvas();
  }

  function applyMapToCanvas() {
    canvas.width = activeMap.width * TILE_SIZE;
    canvas.height = activeMap.height * TILE_SIZE;
    drawCanvas();
  }

  function drawCanvas(hideGrid = false) {
    if (!canvas || !ctx || !activeMap) return;
    
    // Adjust canvas dimensions for zoom
    canvas.width = activeMap.width * TILE_SIZE * currentZoom;
    canvas.height = activeMap.height * TILE_SIZE * currentZoom;

    ctx.save();
    ctx.scale(currentZoom, currentZoom);

    // Clear
    ctx.clearRect(0, 0, activeMap.width * TILE_SIZE, activeMap.height * TILE_SIZE);
    ctx.fillStyle = "#e9ecef";
    ctx.fillRect(0, 0, activeMap.width * TILE_SIZE, activeMap.height * TILE_SIZE);

    // Draw Tiles
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
        
        // Draw Collision Marker in Editor
        if (activeMap.collision && activeMap.collision[y][x] && !hideGrid) {
          ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          
          ctx.strokeStyle = "rgba(255, 0, 0, 0.7)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x * TILE_SIZE, y * TILE_SIZE);
          ctx.lineTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
          ctx.moveTo(x * TILE_SIZE + TILE_SIZE, y * TILE_SIZE);
          ctx.lineTo(x * TILE_SIZE, y * TILE_SIZE + TILE_SIZE);
          ctx.stroke();
        }
      }
    }

    // Draw Grid
    if (!hideGrid) {
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

    // Draw Tokens
    if (activeMap.tokens) {
      for (let y = 0; y < activeMap.height; y++) {
        for (let x = 0; x < activeMap.width; x++) {
          const token = activeMap.tokens[y][x];
          if (token) {
            if (typeof token === "object" && token.assetId) {
               const img = window.BB_ASSETS ? window.BB_ASSETS.getImage(token.assetId) : null;
               if (img) {
                  ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
               } else {
                  ctx.fillStyle = "#ff00ff";
                  ctx.beginPath();
                  ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2 - 4, 0, Math.PI * 2);
                  ctx.fill();
               }
            } else {
               const typeStr = typeof token === "string" ? token : token.type;
               if (typeStr === "Player Token") {
                 ctx.fillStyle = "#4dabf7";
               } else if (typeStr === "Enemy Token") {
                 ctx.fillStyle = "#ff6b6b";
               } else if (typeStr === "NPC Token") {
                 ctx.fillStyle = "#fcc419";
               }
               
               ctx.beginPath();
               ctx.arc(x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2 - 4, 0, Math.PI * 2);
               ctx.fill();
               ctx.strokeStyle = "#fff";
               ctx.lineWidth = 2;
               ctx.stroke();

               if (typeof token === "object" && token.initial) {
                 ctx.fillStyle = "#fff";
                 ctx.font = "bold 14px sans-serif";
                 ctx.textAlign = "center";
                 ctx.textBaseline = "middle";
                 ctx.fillText(token.initial, x * TILE_SIZE + TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2 + 1);
               }
            }
          }
        }
      }
    }
    
    ctx.restore();
  }

  function getMouseCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / currentZoom;
    const rawY = (e.clientY - rect.top) / currentZoom;
    
    const x = Math.floor(rawX / TILE_SIZE);
    const y = Math.floor(rawY / TILE_SIZE);
    
    return { x, y, rawX, rawY };
  }

  function paintTile(x, y, rawX, rawY) {
    if (x >= 0 && x < activeMap.width && y >= 0 && y < activeMap.height) {
      if (!activeMap.tokens) activeMap.tokens = Array(activeMap.height).fill().map(() => Array(activeMap.width).fill(null));
      if (!activeMap.collision) activeMap.collision = Array(activeMap.height).fill().map(() => Array(activeMap.width).fill(false));
      if (!activeMap.wallsHorizontal) activeMap.wallsHorizontal = Array(activeMap.height + 1).fill().map(() => Array(activeMap.width).fill(false));
      if (!activeMap.wallsVertical) activeMap.wallsVertical = Array(activeMap.height).fill().map(() => Array(activeMap.width + 1).fill(false));
      if (!activeMap.doodads) activeMap.doodads = [];

      if (!activeMap.doorsHorizontal) activeMap.doorsHorizontal = Array(activeMap.height + 1).fill().map(() => Array(activeMap.width).fill(null));
      if (!activeMap.doorsVertical) activeMap.doorsVertical = Array(activeMap.height).fill().map(() => Array(activeMap.width + 1).fill(null));

      if (typeof currentTool === 'object' && currentTool.type === 'custom') {
        const id = currentTool.id;
        const cat = currentTool.category;
        if (cat === "terrain" || cat === "structure") {
           activeMap.tiles[y][x] = { assetId: id, category: cat };
        } else if (cat === "doodad") {
           activeMap.doodads.push({ assetId: id, x: x, y: y });
        } else if (cat === "token") {
           activeMap.tokens[y][x] = { type: "Custom Token", assetId: id };
        }
        drawCanvas();
        return;
      }

      if (currentTool === "Wall" || currentTool === "Door") {
         const isDoor = currentTool === "Door";
         const dx = rawX % TILE_SIZE;
         const dy = rawY % TILE_SIZE;
         const dists = {
            "top": dy,
            "bottom": TILE_SIZE - dy,
            "left": dx,
            "right": TILE_SIZE - dx
         };
         let min = Infinity;
         let closest = "";
         for (const edge in dists) {
            if (dists[edge] < min) { min = dists[edge]; closest = edge; }
         }
         
         if (closest === "top") {
            if (isDoor) { activeMap.doorsHorizontal[y][x] = { isOpen: false, isLocked: false, isMagicallyLocked: false }; activeMap.wallsHorizontal[y][x] = false; }
            else { activeMap.wallsHorizontal[y][x] = true; activeMap.doorsHorizontal[y][x] = null; }
         }
         if (closest === "bottom") {
            if (isDoor) { activeMap.doorsHorizontal[y + 1][x] = { isOpen: false, isLocked: false, isMagicallyLocked: false }; activeMap.wallsHorizontal[y + 1][x] = false; }
            else { activeMap.wallsHorizontal[y + 1][x] = true; activeMap.doorsHorizontal[y + 1][x] = null; }
         }
         if (closest === "left") {
            if (isDoor) { activeMap.doorsVertical[y][x] = { isOpen: false, isLocked: false, isMagicallyLocked: false }; activeMap.wallsVertical[y][x] = false; }
            else { activeMap.wallsVertical[y][x] = true; activeMap.doorsVertical[y][x] = null; }
         }
         if (closest === "right") {
            if (isDoor) { activeMap.doorsVertical[y][x + 1] = { isOpen: false, isLocked: false, isMagicallyLocked: false }; activeMap.wallsVertical[y][x + 1] = false; }
            else { activeMap.wallsVertical[y][x + 1] = true; activeMap.doorsVertical[y][x + 1] = null; }
         }
         
         drawCanvas();
         return;
      }
      
      if (currentTool === "Passable") {
        activeMap.collision[y][x] = false;
        drawCanvas();
      } else if (currentTool === "Impassable") {
        activeMap.collision[y][x] = true;
        drawCanvas();
      } else if (currentTool === "Player Token") {
        if (!activeMap.tokens[y][x]) {
          const charSelect = document.getElementById("map-char-select");
          if (charSelect && charSelect.value) {
            const charId = charSelect.value;
            const charName = charSelect.options[charSelect.selectedIndex].text;
            activeMap.tokens[y][x] = {
              type: "Player Token",
              charId: charId,
              initial: charName.charAt(0).toUpperCase()
            };
            drawCanvas();
          }
        }
      } else if (currentTool === "Monster Token") {
        if (!activeMap.tokens[y][x]) {
          const monSelect = document.getElementById("map-monster-select");
          if (monSelect && monSelect.value) {
            const monId = monSelect.value;
            const mData = window.BB_DATABASE.MONSTERS.find(m => m.name === monId);
            let initialHp = 10;
            let defense = 10;
            let resilience = 0;
            if (mData) {
               const stats = mData.stats || {};
               const sumStats = (stats.Str || 10) + (stats.Dex || 10) + (stats.Con || 10) + (stats.Int || 10) + (stats.Wis || 10) + (stats.Lck || 10);
               const level = Math.round(sumStats / 3);
               const conScore = stats.Con || 10;
               const rawConMod = Math.floor((conScore - 10) / 2);
               const effectiveConMod = rawConMod < 0 ? 0 : rawConMod;
               initialHp = (level * 5) + ((conScore + effectiveConMod) * 5);
               
               if (mData.defense !== undefined) {
                  defense = parseInt(mData.defense) || 0;
               } else if (mData.armorClass) {
                  const defMatch = String(mData.armorClass).match(/(\d+)/);
                  if (defMatch) defense = parseInt(defMatch[1]);
               }
               resilience = parseInt(mData.resilience) || 0;
            }
            activeMap.tokens[y][x] = {
              type: "Enemy Token",
              monsterId: monId,
              initial: monId.charAt(0).toUpperCase(),
              maxHp: initialHp,
              currentHp: initialHp,
              defense: defense,
              resilience: resilience
            };
            drawCanvas();
          }
        }
      } else if (currentTool === "NPC Token") {
        if (!activeMap.tokens[y][x]) {
          const npcInput = document.getElementById("map-npc-input");
          const npcName = (npcInput && npcInput.value.trim()) ? npcInput.value.trim() : "NPC";
          activeMap.tokens[y][x] = {
            type: "NPC Token",
            name: npcName,
            initial: npcName.charAt(0).toUpperCase()
          };
          drawCanvas();
        }
      } else if (currentTool === "Eraser") {
        const dx = rawX % TILE_SIZE;
        const dy = rawY % TILE_SIZE;
        if (Math.min(dx, dy, TILE_SIZE - dx, TILE_SIZE - dy) < 8) {
           // Near an edge, erase the edge
           const dists = { "top": dy, "bottom": TILE_SIZE - dy, "left": dx, "right": TILE_SIZE - dx };
           let min = Infinity; let closest = "";
           for (const edge in dists) if (dists[edge] < min) { min = dists[edge]; closest = edge; }
           
           if (closest === "top") {
             if (activeMap.wallsHorizontal) activeMap.wallsHorizontal[y][x] = false;
             if (activeMap.doorsHorizontal) activeMap.doorsHorizontal[y][x] = null;
           }
           if (closest === "bottom") {
             if (activeMap.wallsHorizontal) activeMap.wallsHorizontal[y + 1][x] = false;
             if (activeMap.doorsHorizontal) activeMap.doorsHorizontal[y + 1][x] = null;
           }
           if (closest === "left") {
             if (activeMap.wallsVertical) activeMap.wallsVertical[y][x] = false;
             if (activeMap.doorsVertical) activeMap.doorsVertical[y][x] = null;
           }
           if (closest === "right") {
             if (activeMap.wallsVertical) activeMap.wallsVertical[y][x + 1] = false;
             if (activeMap.doorsVertical) activeMap.doorsVertical[y][x + 1] = null;
           }
        } else if (activeMap.tokens[y][x]) {
          activeMap.tokens[y][x] = null;
        } else {
          activeMap.tiles[y][x] = null;
        }
        drawCanvas();
      } else {
        if (activeMap.tiles[y][x] !== currentTool) {
          activeMap.tiles[y][x] = currentTool;
          drawCanvas();
        }
      }
    }
  }

  function handleMouseDown(e) {
    isPainting = true;
    const { x, y, rawX, rawY } = getMouseCoords(e);
    paintTile(x, y, rawX, rawY);
  }

  function handleMouseMove(e) {
    if (!isPainting) return;
    const { x, y, rawX, rawY } = getMouseCoords(e);
    paintTile(x, y, rawX, rawY);
  }

  function handleMouseUp() {
    isPainting = false;
  }

  function saveCurrentMap() {
    const name = document.getElementById("map-name").value.trim();
    if (!name) {
      alert("Please enter a name for the map before saving.");
      return;
    }
    activeMap.name = name;
    window.BB_STATE.saveMap(activeMap);
    loadMapList();
    alert("Map saved successfully!");
  }

  function loadMapList() {
    const maps = window.BB_STATE.getMaps() || [];
    const listEl = document.getElementById("saved-maps-list");
    if (!listEl) return;

    if (maps.length === 0) {
      listEl.innerHTML = `<div style="color:var(--text-light); font-size:0.85rem; text-align:center; padding:10px;">No saved maps.</div>`;
      return;
    }

    listEl.innerHTML = maps.map(m => `
      <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); padding: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="window.BB_MAP_EDITOR.loadMap('${m.id}')">
        <span style="color: #fff; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.name}</span>
        <div>
          <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); window.BB_MAP_EDITOR.deleteMap('${m.id}')">x</button>
        </div>
      </div>
    `).join('');
  }

  function loadMap(id) {
    const map = window.BB_STATE.getMap(id);
    if (!map) return;
    
    // Deep copy to avoid mutating state directly without saving
    activeMap = JSON.parse(JSON.stringify(map));
    
    document.getElementById("map-name").value = activeMap.name;
    document.getElementById("map-width").value = activeMap.width;
    document.getElementById("map-height").value = activeMap.height;
    
    applyMapToCanvas();
  }

  function deleteMap(id) {
    if (confirm("Delete this map?")) {
      window.BB_STATE.deleteMap(id);
      loadMapList();
      if (activeMap && activeMap.id === id) {
        setupBlankMap();
      }
    }
  }

  function clearMap() {
    if (confirm("Clear current canvas and start a new map? Unsaved changes will be lost.")) {
      setupBlankMap();
    }
  }

  function exportMap() {
    if (!activeMap) return;
    
    // Draw without grid lines
    drawCanvas(true);
    
    const dataURL = canvas.toDataURL("image/png");
    
    // Restore grid
    drawCanvas();

    const a = document.createElement("a");
    a.href = dataURL;
    a.download = (activeMap.name || "untitled_map") + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function exportMapData() {
    if (!activeMap) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeMap));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = (activeMap.name || "untitled_map") + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function importMapData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const importedMap = JSON.parse(evt.target.result);
        if (importedMap && importedMap.width && importedMap.height && importedMap.tiles) {
          // Give it a fresh ID so it doesn't overwrite existing maps accidentally
          importedMap.id = "map_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
          window.BB_STATE.saveMap(importedMap);
          loadMapList();
          loadMap(importedMap.id);
          alert("Map imported successfully!");
        } else {
          alert("Invalid map file format.");
        }
      } catch (err) {
        alert("Error parsing map file.");
        console.error(err);
      }
      // Reset input
      e.target.value = "";
    };
    reader.readAsText(file);
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
    const el = document.getElementById("map-zoom-display");
    if (el) el.innerText = Math.round(currentZoom * 100) + "%";
  }

  return {
    init,
    selectTool,
    selectCustomTool,
    handleAssetUpload,
    deleteCustomAsset,
    clearCategoryAssets,
    switchTab,
    switchPaletteCategory,
    resizeMap,
    saveCurrentMap,
    loadMap,
    deleteMap,
    clearMap,
    exportMap,
    exportMapData,
    importMapData,
    zoomIn,
    zoomOut
  };
})();
