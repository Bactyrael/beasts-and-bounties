// B&B Application State Management
window.BB_STATE = (() => {
  // Constants
  const STORAGE_KEY = "bb_saved_characters";
  const CAMPAIGN_KEY = "bb_saved_campaigns";
  const MAPS_KEY = "bb_saved_maps";

  // Preloaded sample character to show off the character sheet immediately
  const sampleCharacter = {
    id: "sample-hunter",
    name: "Valerius Grist",
    race: "Beastkin",
    class: "Berserker",
    level: 3,
    xp: 500,
    hp: { current: 34, total: 34, temp: 5 },
    mp: { current: 0, total: 0 },
    sp: { current: 18, total: 24 },
    defense: 15,
    resilience: 13,
    movement: 40,
    attunement: { used: 2, total: 3 },
    restDice: { used: 0 },
    encumbrance: "52 / 150 lbs",
    stats: {
      Str: 16,
      Dex: 14,
      Con: 15,
      Int: 10,
      Wis: 13,
      Lck: 12
    },
    spentStatPoints: 0,
    deathSaves: {
      successes: 1,
      failures: 0
    },
    skills: {
      Acrobatics: true,
      Athletics: true,
      Awareness: true,
      Brawn: true,
      Browbeat: false,
      Bushcraft: true,
      Commerce: false,
      Concentration: false,
      Diplomacy: false,
      Endurance: true,
      Investigation: false,
      Knowledge: false,
      Linguistics: false,
      Medicine: false,
      Performance: false,
      "Sleight of Hand": false,
      Sneak: false,
      Tolerance: false
    },
    talents: [
      "Feral Senses (Advantage on scent tracking)",
      "Vanish into Wilds (Can hide in light foliage)",
      "Trophy Collector (+10% gold from beast bounties)",
      "",
      ""
    ],
    feats: [
      "Heavy Armor Mastery (Ignore 2 physical damage)",
      "Uncanny Alertness (+2 Awareness)",
      "",
      "",
      ""
    ],
    equipment: {
      head: "Hunter's Cowl",
      armor: "Brigand's Leather",
      hands: "Gloves of the Beast-Grip",
      feet: "Wind-Walker Boots",
      mainHand: "Steel Claymore",
      offHand: "Shield of the B&B Guild",
      waist: "Gilded Belt",
      neck: "Amulet of the Lucky Paw",
      finger1: "Ring of the Ley-Line",
      finger2: "",
      container1: "",
      coins: {
        bronze: 45,
        silver: 22,
        gold: 154,
        platinum: 12,
        crystal: 1
      }
    },
    spells: ["battle_cry", "execute"],
    imbuedSpells: {},
    trackers: {}
  };

  // State Variables
  let savedCharacters = [];
  let savedCampaigns = [];
  let savedMaps = [];
  let activeCharacter = null;
  let diceLog = [];
  
  // Character Builder temporary state
  let defaultBuilderState = {
    step: 1,
    name: "",
    race: null,
    class: null,
    background: null,
    level: 1,
    statMethod: "point-buy",
    stats: { Str: 8, Dex: 8, Con: 8, Int: 8, Wis: 8, Lck: 8 },
    customStatsAssigned: false,
    talents: ["", "", "", "", ""],
    feats: ["", "", "", "", ""],
    equipment: {
      head: "", armor: "", hands: "", feet: "",
      mainHand: "", offHand: "", waist: "", neck: "",
      finger1: "", finger2: "", container1: "",
      coins: { bronze: 0, silver: 0, gold: 10, platinum: 0, crystal: 0 }
    },
    equipmentState: {
      goldMethod: "average",
      generatedGold: null,
      shoppingCart: [],
      activeCategory: "Weapons"
    },
    spells: [],
    imbuedSpells: {},
    trackers: {}
  };

  let builderState = { ...defaultBuilderState };
  try {
    const savedBuilder = sessionStorage.getItem("bb_builder_state");
    if (savedBuilder) {
      builderState = JSON.parse(savedBuilder);
    }
  } catch (e) {
    console.error("Failed to load builder state from session", e);
  }

  // Pub-Sub Event System
  const listeners = {};

  function subscribe(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  function publish(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(callback => callback(data));
    }
  }

  // Core functions
  function getModifier(statValue) {
    return Math.floor((statValue - 10) / 2);
  }

  function getModifierString(statValue) {
    const mod = getModifier(statValue);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  function getComputedStat(char, statKey) {
    if (!char || !char.stats) return 10;
    let innateVal = char.stats[statKey] || 10;
    
    // Check Ancestry
    const raceData = window.BB_DATABASE && window.BB_DATABASE.SPECIES ? window.BB_DATABASE.SPECIES.find(s => s.name && s.name.toLowerCase() === (char.race || "").toLowerCase()) : {};
    let ancestryBonus = raceData && raceData.bonuses && raceData.bonuses[statKey] ? raceData.bonuses[statKey] : 0;
    
    // Check Equipment
    let equipBonus = 0;
    const statNameMap = { "Str": "Strength", "Dex": "Dexterity", "Con": "Constitution", "Int": "Intelligence", "Wis": "Wisdom", "Lck": "Luck" };
    const statName = statNameMap[statKey] || statKey;

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
            equipBonus += bonus;
          }
        }
      });
    }

    let classBonus = 0;
    if (char.class === "Berserker" && char.level >= 10) {
      if (statKey === "Str" || statKey === "Con") classBonus += 4;
    }
    if (char.class === "Disciple" && char.level >= 10) {
      if (statKey === "Dex" || statKey === "Con") classBonus += 4;
    }
    if (char.class === "Herald" && char.level >= 10) {
      if (statKey === "Dex" || statKey === "Lck") classBonus += 4;
    }
    if (char.class === "Ranger" && char.level >= 10) {
      if (statKey === "Str" || statKey === "Dex" || statKey === "Wis") classBonus += 2;
    }
    if (char.class === "Occultist" && char.level >= 10) {
      if (statKey === "Wis" || statKey === "Int" || statKey === "Con") classBonus += 2;
    }

    let totalVal = innateVal + equipBonus + ancestryBonus + classBonus;
    if (totalVal > 30) totalVal = 30;
    
    if (statKey === "Int" && char.equipment && char.equipment.head === "Starveil") {
      if (totalVal < 18) totalVal = 18;
    }
    if (statKey === "Wis" && char.equipment && char.equipment.head === "Evergreen") {
      if (totalVal < 18) totalVal = 18;
    }
    if (statKey === "Con" && char.equipment && char.equipment.armor === "Heartcord") {
      if (totalVal < 18) totalVal = 18;
    }
    if (statKey === "Lck" && char.equipment && char.equipment.hands === "Caspian Clutches") {
      if (totalVal < 18) totalVal = 18;
    }
    if (statKey === "Dex" && char.equipment && char.equipment.feet === "Dragon Riders") {
      if (totalVal < 18) totalVal = 18;
    }
    if (statKey === "Str" && char.equipment && char.equipment.waist === "String of Ears") {
      if (totalVal < 18) totalVal = 18;
    }

    return totalVal;
  }

  function migrateCharacterInventory(char) {
    if (!char.inventorySlots || !Array.isArray(char.inventorySlots)) return;
    
    const STACKABLES = window.BB_DATABASE ? (window.BB_DATABASE.STACKABLE_ITEMS || []) : [];
    const newSlots = new Array(49).fill("");
    const stackMap = new Map();
    let nextEmpty = 0;

    char.inventorySlots.forEach((slot) => {
      if (!slot) return;
      
      let itemObj;
      if (typeof slot === "string") {
        itemObj = { name: slot, quantity: 1 };
      } else {
        itemObj = { ...slot };
      }

      if (STACKABLES.includes(itemObj.name)) {
        if (stackMap.has(itemObj.name)) {
          // Increment existing stack
          const existing = stackMap.get(itemObj.name);
          existing.quantity += itemObj.quantity;
        } else {
          // New stack
          stackMap.set(itemObj.name, itemObj);
          while(nextEmpty < 49 && newSlots[nextEmpty] !== "") nextEmpty++;
          if (nextEmpty < 49) {
            newSlots[nextEmpty] = itemObj;
            nextEmpty++;
          }
        }
      } else {
        // Non-stackable
        while(nextEmpty < 49 && newSlots[nextEmpty] !== "") nextEmpty++;
        if (nextEmpty < 49) {
          newSlots[nextEmpty] = itemObj;
          nextEmpty++;
        }
      }
    });

    char.inventorySlots = newSlots;
  }

  function loadCharacters() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        savedCharacters = JSON.parse(stored);
        // Migrate inventories
        savedCharacters.forEach(migrateCharacterInventory);
      } else {
        // Preload our awesome sample character
        savedCharacters = [sampleCharacter];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters));
      }
      
      const storedCampaigns = localStorage.getItem(CAMPAIGN_KEY);
      if (storedCampaigns) {
        savedCampaigns = JSON.parse(storedCampaigns);
      }
      
      const storedMaps = localStorage.getItem(MAPS_KEY);
      if (storedMaps) {
        savedMaps = JSON.parse(storedMaps);
      }
    } catch (e) {
      console.error("Failed to load state", e);
      savedCharacters = [sampleCharacter];
      savedCampaigns = [];
      savedMaps = [];
    }
    publish("characters_changed", savedCharacters);
  }

  function saveCharacter(character) {
    const idx = savedCharacters.findIndex(c => c.id === character.id);
    if (idx !== -1) {
      savedCharacters[idx] = character;
    } else {
      savedCharacters.push(character);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters));
    publish("characters_changed", savedCharacters);
    if (activeCharacter && activeCharacter.id === character.id) {
      activeCharacter = character;
      publish("active_character_changed", activeCharacter);
    }
  }

  // --- Campaign Methods ---
  function getCampaigns() {
    return savedCampaigns;
  }

  function getCampaign(id) {
    return savedCampaigns.find(c => c.id === id);
  }

  function saveCampaign(campaign) {
    if (!campaign.id) {
      campaign.id = "campaign_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    }
    const idx = savedCampaigns.findIndex(c => c.id === campaign.id);
    if (idx >= 0) {
      savedCampaigns[idx] = campaign;
    } else {
      savedCampaigns.push(campaign);
    }
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(savedCampaigns));
    publish("campaigns_changed", savedCampaigns);
  }

  function deleteCampaign(id) {
    savedCampaigns = savedCampaigns.filter(c => c.id !== id);
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(savedCampaigns));
    publish("campaigns_changed", savedCampaigns);
  }

  // --- Map Methods ---
  function getMaps() {
    return savedMaps;
  }

  function getMap(id) {
    return savedMaps.find(m => m.id === id);
  }

  function saveMap(mapData) {
    if (!mapData.id) {
      mapData.id = "map_" + Date.now();
    }
    const idx = savedMaps.findIndex(m => m.id === mapData.id);
    if (idx >= 0) {
      savedMaps[idx] = mapData;
    } else {
      savedMaps.push(mapData);
    }
    localStorage.setItem(MAPS_KEY, JSON.stringify(savedMaps));
    publish("maps_changed", savedMaps);
  }

  function deleteMap(id) {
    savedMaps = savedMaps.filter(m => m.id !== id);
    localStorage.setItem(MAPS_KEY, JSON.stringify(savedMaps));
    publish("maps_changed", savedMaps);
  }
  // -------------------------

  function deleteCharacter(id) {
    savedCharacters = savedCharacters.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCharacters));
    publish("characters_changed", savedCharacters);
    if (activeCharacter && activeCharacter.id === id) {
      activeCharacter = savedCharacters[0] || null;
      publish("active_character_changed", activeCharacter);
    }
  }

  function setActiveCharacter(id) {
    const found = savedCharacters.find(c => c.id === id);
    if (found) {
      activeCharacter = found;
      try { localStorage.setItem("bb_active_character", id); } catch(e) {}
      publish("active_character_changed", activeCharacter);
    }
  }

  function addDiceRoll(label, dieCount, dieType, modifier, result, breakdown) {
    const roll = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toLocaleTimeString(),
      label,
      dieCount,
      dieType,
      modifier,
      result,
      breakdown
    };
    diceLog.unshift(roll);
    if (diceLog.length > 20) diceLog.pop(); // Keep last 20
    publish("dice_log_changed", diceLog);
    return roll;
  }

  // Initialize
  loadCharacters();
  if (savedCharacters.length > 0) {
    let lastActiveId = null;
    try { lastActiveId = localStorage.getItem("bb_active_character"); } catch(e) {}
    activeCharacter = savedCharacters.find(c => c.id === lastActiveId) || savedCharacters[0];
  }

  return {
    subscribe,
    publish,
    getModifier,
    getModifierString,
    getComputedStat,
    getSavedCharacters: () => savedCharacters,
    getActiveCharacter: () => activeCharacter,
    getDiceLog: () => diceLog,
    getBuilderState: () => builderState,
    resetBuilderState: () => {
      builderState = {
        step: 1,
        name: "",
        race: null,
        class: null,
        background: null,
        backgroundTraits: { trait: "", ideal: "", bond: "", flaw: "" },
        level: 1,
        statMethod: "point-buy",
        stats: { Str: 8, Dex: 8, Con: 8, Int: 8, Wis: 8, Lck: 8 },
        customStatsAssigned: false,
        humanSkillBonuses: ["", ""],
        bonusLanguage: "",
        talents: ["", "", "", "", ""],
        feats: ["", "", "", "", "", ""],
        equipment: {
          head: "", armor: "", hands: "", feet: "",
          mainHand: "", offHand: "", waist: "", neck: "",
          finger1: "", finger2: "", container1: "",
          coins: { bronze: 0, silver: 0, gold: 10, platinum: 0, crystal: 0 }
        },
        equipmentState: {
          goldMethod: "average",
          generatedGold: null,
          shoppingCart: [],
          activeCategory: "Weapons"
        },
        spells: [],
        imbuedSpells: {},
        trackers: {}
      };
      try {
        sessionStorage.removeItem("bb_builder_state");
      } catch (e) {}
      publish("builder_changed", builderState);
    },
    updateBuilderState: (updates) => {
      builderState = { ...builderState, ...updates };
      try {
        sessionStorage.setItem("bb_builder_state", JSON.stringify(builderState));
      } catch (e) {}
      publish("builder_changed", builderState);
    },
    saveCharacter,
    deleteCharacter,
    setActiveCharacter,
    addDiceRoll,
    getDiceLog: () => diceLog,
    
    getCampaigns,
    getCampaign,
    saveCampaign,
    deleteCampaign,
    
    getMaps,
    getMap,
    saveMap,
    deleteMap
  };
})();
