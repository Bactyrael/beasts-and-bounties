window.BB_ASSETS = (function() {
  const DB_NAME = "BeastsAndBountiesAssets";
  const DB_VERSION = 1;
  const STORE_NAME = "assets";
  
  let db = null;
  let cache = {}; // { id: HTMLImageElement }
  let autotileMaps = {}; // { id: Array(256) }
  let loadedAssets = []; // array of { id, name, category, url, isAutotile }

  function buildAutotileMap(asset, img) {
    if (autotileMaps[asset.id]) return autotileMaps[asset.id];
    
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    
    const bgR = data[0], bgG = data[1], bgB = data[2], bgA = data[3];
    const isBgTransparent = bgA < 10;
    
    const isSolid = (px, py) => {
       const idx = (py * img.width + px) * 4;
       const a = data[idx+3];
       const r = data[idx]; const g = data[idx+1]; const b = data[idx+2];
       if (a < 10) return false;
       if (!isBgTransparent && Math.abs(r - bgR) < 10 && Math.abs(g - bgG) < 10 && Math.abs(b - bgB) < 10) return false;
       return true;
    };
    
    const tw = Math.floor(img.width / asset.cols);
    const th = Math.floor(img.height / asset.rows);
    const totalTiles = asset.cols * asset.rows;
    
    const tileMasks = new Array(totalTiles);
    const inset = Math.max(1, Math.floor(tw * 0.15));
    
    for (let index = 0; index < totalTiles; index++) {
      const col = index % asset.cols;
      const row = Math.floor(index / asset.cols);
      const bx = col * tw;
      const by = row * th;
      
      let m = 0;
      if (isSolid(bx + inset, by + inset)) m |= 1; // NW
      if (isSolid(bx + Math.floor(tw/2), by + inset)) m |= 2; // N
      if (isSolid(bx + tw - inset - 1, by + inset)) m |= 4; // NE
      if (isSolid(bx + inset, by + Math.floor(th/2))) m |= 8; // W
      if (isSolid(bx + tw - inset - 1, by + Math.floor(th/2))) m |= 16; // E
      if (isSolid(bx + inset, by + th - inset - 1)) m |= 32; // SW
      if (isSolid(bx + Math.floor(tw/2), by + th - inset - 1)) m |= 64; // S
      if (isSolid(bx + tw - inset - 1, by + th - inset - 1)) m |= 128; // SE
      
      tileMasks[index] = m;
    }
    
    const mapping = new Array(256);
    for (let m = 0; m < 256; m++) {
      let reduced = m;
      if (!(reduced & 2) || !(reduced & 8)) reduced &= ~1;
      if (!(reduced & 2) || !(reduced & 16)) reduced &= ~4;
      if (!(reduced & 64) || !(reduced & 8)) reduced &= ~32;
      if (!(reduced & 64) || !(reduced & 16)) reduced &= ~128;
      
      let bestIndex = tileMasks.indexOf(reduced);
      if (bestIndex === -1) bestIndex = tileMasks.indexOf(255) !== -1 ? tileMasks.indexOf(255) : 0;
      mapping[m] = bestIndex;
    }
    
    autotileMaps[asset.id] = mapping;
    return mapping;
  }

  function init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
         console.warn("IndexedDB not supported in this browser. Custom assets will not save.");
         resolve();
         return;
      }
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (e) => reject("IndexedDB error: " + e.target.errorCode);
      
      request.onsuccess = (e) => {
        db = e.target.result;
        loadAllAssets().then(resolve).catch(reject);
      };
      
      request.onupgradeneeded = (e) => {
        const upgradeDb = e.target.result;
        if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
          upgradeDb.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    });
  }

  function loadAllAssets() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = (e) => {
        const results = e.target.result || [];
        loadedAssets = [];
        
        const loadPromises = results.map(asset => {
          return new Promise((res) => {
            if (!asset || !asset.blob) return res(); // Skip corrupted
            
            try {
              const url = URL.createObjectURL(asset.blob);
              loadedAssets.push({
                id: asset.id,
                name: asset.name,
                category: asset.category,
                url: url,
                isAutotile: asset.isAutotile,
                cols: asset.cols || 8,
                rows: asset.rows || 6,
                isStandardBlob: asset.isStandardBlob || false
              });
              
              const img = new Image();
              img.onload = () => {
                cache[asset.id] = img;
                res();
              };
              img.onerror = res; // resolve anyway to avoid breaking Promise.all
              img.src = url;
            } catch (err) {
              console.error("Skipping corrupted asset:", err);
              res();
            }
          });
        });
        
        Promise.all(loadPromises).then(resolve);
      };
      request.onerror = reject;
    });
  }

  function convertRPGMakerA2(file, category, baseName) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const numCols = Math.round(img.width / 48) > 0 ? Math.round(img.width / 48) : Math.round(img.width / 32);
          const tileW = Math.floor(img.width / numCols);
          const tileH = tileW;
          const colsOfBlocks = numCols / 2;
          const rowsOfBlocks = Math.round(img.height / tileH) / 3;
          
          const valid = [];
          for (let i = 0; i < 256; i++) {
            let m = i;
            if (!(m & 2) || !(m & 8)) m &= ~1;
            if (!(m & 2) || !(m & 16)) m &= ~4;
            if (!(m & 64) || !(m & 8)) m &= ~32;
            if (!(m & 64) || !(m & 16)) m &= ~128;
            if (!valid.includes(m)) valid.push(m);
          }
          valid.sort((a, b) => b - a);
          
          let blockIndex = 1;
          for (let by = 0; by < rowsOfBlocks; by++) {
            for (let bx = 0; bx < colsOfBlocks; bx++) {
              const blockStartX = bx * 2 * tileW;
              const blockStartY = by * 3 * tileH;
              
              const tmpCanvas = document.createElement('canvas');
              tmpCanvas.width = 2 * tileW; tmpCanvas.height = 3 * tileH;
              const tctx = tmpCanvas.getContext('2d');
              tctx.drawImage(img, blockStartX, blockStartY, 2*tileW, 3*tileH, 0, 0, 2*tileW, 3*tileH);
              const data = tctx.getImageData(0,0,tmpCanvas.width,tmpCanvas.height).data;
              let isEmpty = true;
              for (let i=3; i<data.length; i+=4) if (data[i] > 10) { isEmpty=false; break; }
              if (isEmpty) continue;
              
              const blobCanvas = document.createElement('canvas');
              blobCanvas.width = 8 * tileW;
              blobCanvas.height = 6 * tileH;
              const bctx = blobCanvas.getContext('2d');
              const qw = tileW / 2;
              const qh = tileH / 2;
              
              const getQuarter = (tx, ty, qx, qy) => {
                 return { x: blockStartX + tx * tileW + qx * qw, y: blockStartY + ty * tileH + qy * qh };
              };
              
              for (let i = 0; i < 48; i++) {
                const col = i % 8;
                const row = Math.floor(i / 8);
                const destX = col * tileW;
                const destY = row * tileH;
                const mask = i < 47 ? valid[i] : 0;
                
                const N = (mask & 2) !== 0, W = (mask & 8) !== 0, NW = (mask & 1) !== 0;
                let qNW;
                if (!N && !W) qNW = getQuarter(0, 1, 0, 0); 
                else if (!N && W) qNW = getQuarter(1, 1, 0, 0); 
                else if (N && !W) qNW = getQuarter(0, 2, 0, 0); 
                else if (N && W && !NW) qNW = getQuarter(1, 0, 0, 0); // Inner corner
                else qNW = getQuarter(1, 2, 0, 0); // Full center

                const E = (mask & 16) !== 0, NE = (mask & 4) !== 0;
                let qNE;
                if (!N && !E) qNE = getQuarter(1, 1, 1, 0); 
                else if (!N && E) qNE = getQuarter(0, 1, 1, 0); 
                else if (N && !E) qNE = getQuarter(1, 2, 1, 0); 
                else if (N && E && !NE) qNE = getQuarter(1, 0, 1, 0); // Inner corner
                else qNE = getQuarter(0, 2, 1, 0); // Full center

                const S = (mask & 64) !== 0, SW = (mask & 32) !== 0;
                let qSW;
                if (!S && !W) qSW = getQuarter(0, 2, 0, 1); 
                else if (!S && W) qSW = getQuarter(1, 2, 0, 1); 
                else if (S && !W) qSW = getQuarter(0, 1, 0, 1); 
                else if (S && W && !SW) qSW = getQuarter(1, 0, 0, 1); // Inner corner
                else qSW = getQuarter(1, 1, 0, 1); // Full center

                const SE = (mask & 128) !== 0;
                let qSE;
                if (!S && !E) qSE = getQuarter(1, 2, 1, 1); 
                else if (!S && E) qSE = getQuarter(0, 2, 1, 1); 
                else if (S && !E) qSE = getQuarter(1, 1, 1, 1); 
                else if (S && E && !SE) qSE = getQuarter(1, 0, 1, 1); // Inner corner
                else qSE = getQuarter(0, 1, 1, 1); // Full center 
                
                bctx.drawImage(img, qNW.x, qNW.y, qw, qh, destX, destY, qw, qh);
                bctx.drawImage(img, qNE.x, qNE.y, qw, qh, destX + qw, destY, qw, qh);
                bctx.drawImage(img, qSW.x, qSW.y, qw, qh, destX, destY + qh, qw, qh);
                bctx.drawImage(img, qSE.x, qSE.y, qw, qh, destX + qw, destY + qh, qw, qh);
              }
              
              await new Promise(r => blobCanvas.toBlob(async (b) => {
                 let name = baseName;
                 if (colsOfBlocks > 1 || rowsOfBlocks > 1) name += " " + blockIndex;
                 await saveAsset(b, category, name + " (RPG)", true, 8, 6, true);
                 blockIndex++;
                 r();
              }));
            }
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function saveAsset(file, category, name, isAutotile = false, cols = 8, rows = 6, isStandardBlob = false) {
    return new Promise((resolve, reject) => {
      const id = "asset_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      const assetData = { id, name, category, blob: file, isAutotile, cols, rows, isStandardBlob };
      
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(assetData);
      
      request.onsuccess = () => {
        const url = URL.createObjectURL(file);
        loadedAssets.push({ id: assetData.id, name: assetData.name, category: assetData.category, url, isAutotile, cols, rows, isStandardBlob });
        
        const img = new Image();
        img.onload = () => {
          cache[id] = img;
          resolve(assetData);
        };
        img.onerror = reject;
        img.src = url;
      };
      request.onerror = reject;
    });
  }

  function getAssetsByCategory(cat) {
    return loadedAssets.filter(a => a.category === cat);
  }

  function getImage(id) {
    return cache[id] || null;
  }

  function deleteAsset(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        loadedAssets = loadedAssets.filter(a => a.id !== id);
        delete cache[id];
        resolve();
      };
      request.onerror = (e) => reject("Delete error: " + e.target.errorCode);
    });
  }

  function getAsset(id) {
    return loadedAssets.find(a => a.id === id);
  }

  function calculateAutotile(mapData, x, y, assetId) {
    const isSameTile = (tx, ty) => {
       if (tx < 0 || ty < 0 || ty >= mapData.height || tx >= mapData.width) return true;
       const tile = mapData.tiles[ty][tx];
       return tile && typeof tile === 'object' && tile.assetId === assetId;
    };
    
    let mask = 0;
    if (isSameTile(x - 1, y - 1)) mask |= 1; // NW
    if (isSameTile(x, y - 1))     mask |= 2; // N
    if (isSameTile(x + 1, y - 1)) mask |= 4; // NE
    if (isSameTile(x - 1, y))     mask |= 8; // W
    if (isSameTile(x + 1, y))     mask |= 16; // E
    if (isSameTile(x - 1, y + 1)) mask |= 32; // SW
    if (isSameTile(x, y + 1))     mask |= 64; // S
    if (isSameTile(x + 1, y + 1)) mask |= 128; // SE
    
    const img = cache[assetId];
    if (!img) return null;

    const asset = getAsset(assetId);
    if (!asset) return null;

    let index = 0;
    if (asset.isStandardBlob) {
       const valid = [];
       for (let i = 0; i < 256; i++) {
         let m = i;
         if (!(m & 2) || !(m & 8)) m &= ~1;
         if (!(m & 2) || !(m & 16)) m &= ~4;
         if (!(m & 64) || !(m & 8)) m &= ~32;
         if (!(m & 64) || !(m & 16)) m &= ~128;
         if (!valid.includes(m)) valid.push(m);
       }
       valid.sort((a, b) => b - a);
       let reduced = mask;
       if (!(reduced & 2) || !(reduced & 8)) reduced &= ~1;
       if (!(reduced & 2) || !(reduced & 16)) reduced &= ~4;
       if (!(reduced & 64) || !(reduced & 8)) reduced &= ~32;
       if (!(reduced & 64) || !(reduced & 16)) reduced &= ~128;
       index = valid.indexOf(reduced);
       if (index === -1) index = 0;
    } else {
       const mapping = buildAutotileMap(asset, img);
       index = mapping[mask];
    }
    const col = index % asset.cols;
    const row = Math.floor(index / asset.cols);
    
    const tileW = img.width / asset.cols;
    const tileH = img.height / asset.rows;
    
    return {
       img: img,
       sx: col * tileW,
       sy: row * tileH,
       sw: tileW,
       sh: tileH
    };
  }

  return { init, saveAsset, getAssetsByCategory, getImage, deleteAsset, getAsset, calculateAutotile, convertRPGMakerA2 };
})();
