window.BB_COMPENDIUM = (function() {
console.log('Compendium script loaded');
  // Active tab can be 'spells', 'equipment', 'items', 'monsters', 'feats', 'talents'
  let activeTab = localStorage.getItem("bb_compendium_tab") || 'spells';
  let searchQuery = '';
  let spellClassFilter = 'all';
  let itemCategoryFilter = 'all';
  let miscCategoryFilter = 'all';

  const TOOLTIP_TERMS = {
    "Finesse": "Weapons with the Finesse modifier allow precision to replace brute force. When you attack with a Finesse weapon, choose either your Strength or Dexterity modifier. The chosen modifier is applied to the damage roll.",
    "Dual": "Weapons with a Dual grip are one-handed and may be wielded in either hand. When wielding two Dual-grip weapons, you may make one off-hand attack as a Bonus Action after making an attack. The off-hand attack does not add your modifier to damage. Max Critical Range: 1",
    "Single": "Weapons with a Single grip are one-handed and may only be wielded in your main hand. While this is your only weapon, you deal +2 damage on all attack rolls. Max Critical Range: 2",
    "Double": "Weapons with a Double grip require two hands to wield. When making an attack, you may reroll a 1 or 2 and must use the new result. Max Critical Range: 3",
    "Colossal": "Great weapons possess a Colossal grip, requiring two hands to wield and specialized training to use effectively. Attack rolls made with Colossal weapons suffer a Disadvantage die due to their enormous size. Max Critical Range: 4",
    "Off-hand": "Weapons or items with the Off-hand property may be wielded in your secondary hand, opposite your designated main hand. Off-hands can be used to make attacks, but many provide defensive or utility benefits instead of damage. They are ideal for dual-wielding, blocking, activating reaction-based techniques, or enhancing abilities without interfering with your main-hand weapon.",
    "Ammunition": "Weapons that require ammunition cannot be used to make ranged attacks unless the wielder has the appropriate ammunition available. Each time you attack with an ammunition-based weapon, one unit of ammunition is expended. Drawing ammunition from a quiver, case, magazine, or similar container is considered part of the attack and does not require a separate action. After a combat encounter, a character may spend one minute searching the area to recover up to half of the ammunition they expended during that fight, rounded down. Recovered ammunition must be reasonably intact and accessible; ammunition lost to fire, extreme force, or environmental hazards cannot be recovered at the GM’s discretion.",
    "Loading": "Weapons with the Loading property require significant time to reload between shots. When you use an action, bonus action, or reaction to attack with a Loading weapon, you may fire only one unit of ammunition, regardless of how many attacks you would normally be able to make as part of that effect. Additional attacks granted by abilities, traits, or features cannot be used with a Loading weapon unless they explicitly state otherwise.",
    "Reach": "Determines the maximum distance at which you can target a creature or object with an attack or interaction. Reach is measured from the square you occupy to the target’s square.<br>Reach 0: You may target any adjacent square directly connected to the space you occupy.<br>Reach 5: You may target squares one square away from your occupied space.<br>Reach 10: You may target squares up to two squares away from your occupied space.",
    "Range": "Weapons listed with two numbers separated by a forward slash (for example, 80/320) are Ranged weapons. The first number indicates the weapon’s normal reach, the distance within which the weapon can be used without penalty. The second number indicates the weapon’s maximum range, the farthest distance the projectile can travel and still interact with a target. All attack rolls made against targets beyond the weapon’s normal reach but within its maximum range are rolled with disadvantage. Targets beyond the maximum range cannot be attacked.",
    "Thrown": "Weapons with the Thrown property can be used to make ranged attacks by throwing them. When you throw a melee weapon, use the same ability modifier you would normally use for a melee attack with that weapon. For example, a thrown dagger may use Strength or Dexterity if it has the Finesse property. Thrown weapons follow the same range rules as other Ranged weapons. After a weapon is thrown, you must move to the weapon and use an Action to pick it up and reequip it.",
    "Cabled": "Cabled weapons are connected to the wielder by a rope, chain, or similar attachment, allowing them to be used as ranged weapons without needing to retrieve them after each attack. When attacking beyond the weapon’s normal reach, however, the weapon loses its grip bonus, and all attack rolls are made with disadvantage dice.",
    "Improvised Weapons": "Sometimes characters are forced to fight without proper weapons, using whatever is at hand. An improvised weapon can be any object a character can wield in one or two hands, such as a broken bottle, a table leg, a frying pan, a wagon wheel, or even a fallen creature. In many cases, an improvised weapon resembles an actual weapon and can be treated as such. For example, a sturdy table leg might function like a club. At the GM’s discretion, a character with the appropriate weapon training can apply that training when using a similar improvised object. Objects that do not resemble a weapon deal 1d4 damage, with the GM determining a fitting damage type based on the item. Additionally, using a ranged weapon for a melee attack or throwing a melee weapon that does not have the Thrown property counts as an improvised attack and also deals 1d4 damage. Improvised thrown weapons have a normal range of 20 feet and a maximum range of 60 feet.",
    "Silvered Weapons": "Some creatures that have immunity or resistance to ordinary weapons are vulnerable to silvered weapons. Careful adventurers often invest extra coin to coat their weapons with silver. You may silver a single weapon or up to ten pieces of ammunition for 100 gold coins. This cost reflects not only the price of the silver but also the skill and time required to apply it without reducing the weapon’s effectiveness.",
    "Attack": "The most direct way to harm an opponent is to take the Attack action. Whether you are striking with a blade, loosing an arrow, hurling a weapon, or fighting with your bare hands, this action represents a deliberate attempt to injure or overpower a foe.",
    "Dash": "When you take the Dash action, you push yourself to move farther than usual during your turn. Until the end of your turn, you gain additional movement equal to your current Speed, after applying any bonuses or penalties.",
    "Disengage": "When you take the Disengage action, you move with deliberate caution, avoiding openings that enemies could exploit. For the rest of your turn, your movement does not provoke opportunity attacks.",
    "Dodge": "When you take the Dodge action, you devote your full attention to defense, anticipating danger and shifting to avoid incoming harm. Until the start of your next turn, all attack rolls made against you are made with disadvantage dice, provided you can see the attacker. In addition, you make Dexterity saving throws with an advantage die during this time.",
    "Help": "You can use your action to assist another creature in completing a task. The creature gains an advantage die on rolls to accomplish that task, provided it makes the check before the start of your next turn. Alternatively, you can use Help to support an ally in combat to give them advantage dice on their next attack roll against a hostile creature within 5 feet of you.",
    "Hide": "When you take the Hide action, you attempt to slip from sight or otherwise conceal your presence. Make a Dexterity (Sneak) check. If you succeed, you become hidden from creatures that failed to notice you. Creatures that cannot see you have a disadvantage die on attack rolls against you, and your attack rolls against them are made with an advantage die.",
    "Ready": "The Ready action lets you prepare an action or movement that you can use later in the round, using your reaction. First decide the trigger, then choose the action you will take when that trigger occurs, or decide to move up to your Speed. When the trigger occurs, you may use your reaction to carry out your prepared action, or ignore the trigger entirely.",
    "Search": "When you take the Search action, you carefully examine your surroundings or inspect a specific object to uncover hidden details.",
    "Use an Object": "When an object requires your full attention to operate, or if you want to interact with multiple objects on your turn, you take the Use an Object action.",
    "Bonus Action": "A bonus action is a special action you can take on your turn in addition to your regular action. You only have access to a bonus action when a weapon, feature, ability, or spell specifically grants one. You can take only one bonus action per turn.",
    "Reaction": "A reaction is a quick response you can take when a specific trigger occurs. Reactions are granted by certain weapons, features, abilities, or spells, and can be used on your turn or during another creature’s turn. Once you use a reaction, you cannot use another one until the start of your next turn."
  };

  function linkifyTerms(text) {
    if (!text) return text;
    if (Array.isArray(text)) text = text.join(', ');
    const terms = Object.keys(TOOLTIP_TERMS).sort((a, b) => b.length - a.length);
    const regex = new RegExp(`\\b(${terms.join('|')})\\b`, 'g');
    return text.replace(regex, (match) => {
      const desc = TOOLTIP_TERMS[match];
      return `<span class="info-tooltip-trigger" data-html="<div style='max-width:250px; font-size:0.85rem; text-align:left; white-space:normal;'><strong style='color:var(--amber); margin-bottom:5px; display:block;'>${match}</strong>${desc.replace(/"/g, '&quot;')}</div>" style="color:var(--amber); border-bottom:1px dashed var(--amber); cursor:help;">${match}</span>`;
    });
  }

  /** Initialize the compendium view. Waits for BB_DATABASE to be available. */
  function init() {
  console.log('Compendium init start');
  if (!window.BB_DATABASE) {
    setTimeout(init, 100);
    return;
  }
  console.log('BB_DATABASE available');
  render();
  console.log('render called');
  setupEventListeners();
  renderResults();
  console.log('renderResults called');
}

  function setupEventListeners() {
    const searchInput = document.getElementById('compendium-search-bar');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.toLowerCase();
        renderResults();
      });
    }
    const classSelect = document.getElementById('spell-class-select');
    if (classSelect) {
      classSelect.addEventListener('change', e => {
        spellClassFilter = e.target.value.toLowerCase();
        renderResults();
      });
    }
    const itemSelect = document.getElementById('item-category-select');
    if (itemSelect) {
      itemSelect.addEventListener('change', e => {
        itemCategoryFilter = e.target.value.toLowerCase();
        renderResults();
      });
    }
    const miscSelect = document.getElementById('misc-category-select');
    if (miscSelect) {
      miscSelect.addEventListener('change', e => {
        miscCategoryFilter = e.target.value.toLowerCase();
        renderResults();
      });
    }
    const tabs = document.querySelectorAll('.compendium-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.getAttribute('data-tab');
        localStorage.setItem("bb_compendium_tab", activeTab);
        if (classSelect) {
          classSelect.style.display = (activeTab === 'spells') ? 'inline-block' : 'none';
        }
        const classLabel = document.getElementById('spell-class-label');
        if (classLabel) {
          classLabel.style.display = (activeTab === 'spells') ? 'inline-block' : 'none';
        }
        if (itemSelect) {
          itemSelect.style.display = (activeTab === 'equipment') ? 'inline-block' : 'none';
        }
        const itemLabel = document.getElementById('item-category-label');
        if (itemLabel) {
          itemLabel.style.display = (activeTab === 'equipment') ? 'inline-block' : 'none';
        }
        if (miscSelect) {
          miscSelect.style.display = (activeTab === 'items') ? 'inline-block' : 'none';
        }
        const miscLabel = document.getElementById('misc-category-label');
        if (miscLabel) {
          miscLabel.style.display = (activeTab === 'items') ? 'inline-block' : 'none';
        }
        renderResults();
      });
    });
  }

  function render() {
    const container = document.getElementById('main-view-container');
    if (!container) return;
    container.innerHTML = `
      <div class="compendium-page">
        <div class="page-header">
          <h1>Lore Compendium</h1>
        </div>
        <div class="compendium-search-controls glass">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" id="compendium-search-bar" placeholder="Search The Compendium..." value="${searchQuery}">
          </div>
          <div class="compendium-tabs">
            <button class="compendium-tab ${activeTab === 'spells' ? 'active' : ''}" data-tab="spells">Spells &amp; Abilities</button>
            <button class="compendium-tab ${activeTab === 'equipment' ? 'active' : ''}" data-tab="equipment">Equipment</button>
            <button class="compendium-tab ${activeTab === 'items' ? 'active' : ''}" data-tab="items">Items</button>
            <button class="compendium-tab ${activeTab === 'monsters' ? 'active' : ''}" data-tab="monsters">Monsters</button>
            <button class="compendium-tab ${activeTab === 'feats' ? 'active' : ''}" data-tab="feats">Feats</button>
            <button class="compendium-tab ${activeTab === 'talents' ? 'active' : ''}" data-tab="talents">Talents</button>
          </div>
          <div id="spell-filter-container" style="margin-top:12px; display:flex; align-items:center; gap:8px;">
            <label for="spell-class-select" id="spell-class-label" style="display:${activeTab === 'spells' ? 'inline-block' : 'none'}; font-size:0.9rem; color:var(--text-light);">Filter by Class:</label>
            <select id="spell-class-select" style="display:${activeTab === 'spells' ? 'inline-block' : 'none'}; background:var(--bg-dark); color:var(--text-light); border:1px solid var(--amber); border-radius:4px; padding:6px 10px; font-size:0.9rem; cursor:pointer; outline:none; max-width:200px;">
                <option value="all" ${spellClassFilter === 'all' ? 'selected' : ''}>All Classes</option>
                <option value="archon" ${spellClassFilter === 'archon' ? 'selected' : ''}>Archon</option>
                <option value="berserker" ${spellClassFilter === 'berserker' ? 'selected' : ''}>Berserker</option>
                <option value="disciple" ${spellClassFilter === 'disciple' ? 'selected' : ''}>Disciple</option>
                <option value="herald" ${spellClassFilter === 'herald' ? 'selected' : ''}>Herald</option>
                <option value="invoker" ${spellClassFilter === 'invoker' ? 'selected' : ''}>Invoker</option>
                <option value="justicar" ${spellClassFilter === 'justicar' ? 'selected' : ''}>Justicar</option>
                <option value="mage" ${spellClassFilter === 'mage' ? 'selected' : ''}>Mage</option>
                <option value="occultist" ${spellClassFilter === 'occultist' ? 'selected' : ''}>Occultist</option>
                <option value="prowler" ${spellClassFilter === 'prowler' ? 'selected' : ''}>Prowler</option>
                <option value="tracker" ${spellClassFilter === 'tracker' ? 'selected' : ''}>Tracker</option>
                <option value="vanguard" ${spellClassFilter === 'vanguard' ? 'selected' : ''}>Vanguard</option>
                <option value="warden" ${spellClassFilter === 'warden' ? 'selected' : ''}>Warden</option>
            </select>
            <label for="item-category-select" id="item-category-label" style="display:${activeTab === 'equipment' ? 'inline-block' : 'none'}; font-size:0.9rem; color:var(--text-light);">Filter by Category:</label>
            <select id="item-category-select" style="display:${activeTab === 'equipment' ? 'inline-block' : 'none'}; background:var(--bg-dark); color:var(--text-light); border:1px solid var(--amber); border-radius:4px; padding:6px 10px; font-size:0.9rem; cursor:pointer; outline:none; max-width:200px;">
                <option value="all" ${itemCategoryFilter === 'all' ? 'selected' : ''}>All Equipment</option>
                <option value="weapon" ${itemCategoryFilter === 'weapon' ? 'selected' : ''}>Weapons</option>
                <option value="armor" ${itemCategoryFilter === 'armor' ? 'selected' : ''}>Armor</option>
                <option value="shield" ${itemCategoryFilter === 'shield' ? 'selected' : ''}>Shields</option>
                <option value="implement" ${itemCategoryFilter === 'implement' ? 'selected' : ''}>Implements</option>
                <option value="head" ${itemCategoryFilter === 'head' ? 'selected' : ''}>Head</option>
                <option value="neck" ${itemCategoryFilter === 'neck' ? 'selected' : ''}>Neck</option>
                <option value="hands" ${itemCategoryFilter === 'hands' ? 'selected' : ''}>Hands</option>
                <option value="waist" ${itemCategoryFilter === 'waist' ? 'selected' : ''}>Waist</option>
                <option value="finger" ${itemCategoryFilter === 'finger' ? 'selected' : ''}>Finger</option>
                <option value="feet" ${itemCategoryFilter === 'feet' ? 'selected' : ''}>Feet</option>
            </select>
            <label for="misc-category-select" id="misc-category-label" style="display:${activeTab === 'items' ? 'inline-block' : 'none'}; font-size:0.9rem; color:var(--text-light); margin-left:8px;">Filter by Type:</label>
            <select id="misc-category-select" style="display:${activeTab === 'items' ? 'inline-block' : 'none'}; background:var(--bg-dark); color:var(--text-light); border:1px solid var(--amber); border-radius:4px; padding:6px 10px; font-size:0.9rem; cursor:pointer; outline:none; max-width:200px;">
                <option value="all" ${miscCategoryFilter === 'all' ? 'selected' : ''}>All Items</option>
                <option value="adventuring gear" ${miscCategoryFilter === 'adventuring gear' ? 'selected' : ''}>Adventuring Gear</option>
                <option value="consumable" ${miscCategoryFilter === 'consumable' ? 'selected' : ''}>Consumables</option>
                <option value="tool" ${miscCategoryFilter === 'tool' ? 'selected' : ''}>Tools & Instruments</option>
                <option value="trade good" ${miscCategoryFilter === 'trade good' ? 'selected' : ''}>Trade Goods</option>
                <option value="misc" ${miscCategoryFilter === 'misc' ? 'selected' : ''}>Misc</option>
            </select>
          </div>
        </div>
        <div class="compendium-results-grid" id="compendium-results"></div>
      </div>
    `;
  }

  function getTypeColor(type) {
    if (!type) return '#4b5563';
    const t = type.toLowerCase();
    switch(t) {
      case 'fire': return '#ef4444';
      case 'water': return '#3b82f6';
      case 'earth': return '#b45309';
      case 'air': return '#38bdf8';
      case 'ice': return '#2dd4bf';
      case 'lightning': return '#eab308';
      case 'thunder': return '#f97316';
      case 'nature': return '#22c55e';
      case 'magic': return '#a855f7';
      case 'dark': return '#334155';
      case 'holy': return '#fbbf24';
      case 'physical': return '#78716c';
      default: return '#4b5563';
    }
  }

  function renderResults() {
    if (!window.BB_DATABASE) {
      setTimeout(renderResults, 100);
      return;
    }
    const resultsGrid = document.getElementById('compendium-results');
    if (!resultsGrid) return;
    resultsGrid.innerHTML = '';
    const data = window.BB_DATABASE;
    const results = [];

    if (activeTab === 'spells') {
      data.SPELLS.forEach(spell => {
        const matchesQuery = spell.name.toLowerCase().includes(searchQuery) ||
          (spell.description && spell.description.toLowerCase().includes(searchQuery)) ||
          (spell.class && spell.class.toLowerCase().includes(searchQuery));
        let matchesClass = true;
        if (spellClassFilter && spellClassFilter !== 'all') {
          matchesClass = (spell.class && spell.class.toLowerCase() === spellClassFilter);
        }
        if (matchesQuery && matchesClass) results.push({ ...spell, category: 'spell' });
      });
    } else if (activeTab === 'equipment') {
      data.ITEMS.forEach(item => {
        const matchesQuery = item.name.toLowerCase().includes(searchQuery) ||
          (item.description && item.description.toLowerCase().includes(searchQuery)) ||
          (item.rarity && item.rarity.toLowerCase().includes(searchQuery)) ||
          (item.type && item.type.toLowerCase().includes(searchQuery)) ||
          (item.slot && item.slot.toLowerCase().includes(searchQuery)) ||
          (item.grip && item.grip.toLowerCase().includes(searchQuery));
          
        let matchesCategory = true;
        if (itemCategoryFilter && itemCategoryFilter !== 'all') {
          matchesCategory = (item.slot && item.slot.toLowerCase() === itemCategoryFilter) || 
                            (item.type && item.type.toLowerCase() === itemCategoryFilter);
        }
        
        if (matchesQuery && matchesCategory) results.push({ ...item, category: 'item' });
      });
    } else if (activeTab === 'items') {
      if (data.MISC_ITEMS) {
        data.MISC_ITEMS.forEach(item => {
          const matchesQuery = item.name.toLowerCase().includes(searchQuery) ||
            (item.description && item.description.toLowerCase().includes(searchQuery)) ||
            (item.type && item.type.toLowerCase().includes(searchQuery)) ||
            (item.slot && item.slot.toLowerCase().includes(searchQuery));
          
          let matchesCategory = true;
          if (miscCategoryFilter && miscCategoryFilter !== 'all') {
            if (miscCategoryFilter === 'consumable') {
              matchesCategory = (item.slot && item.slot.toLowerCase() === 'consumable');
            } else {
              matchesCategory = (item.type && item.type.toLowerCase().includes(miscCategoryFilter));
            }
          }
          
          if (matchesQuery && matchesCategory) results.push({ ...item, category: 'misc' });
        });
      }
    } else if (activeTab === 'monsters') {
      data.MONSTERS.forEach(monster => {
        const matches = monster.name.toLowerCase().includes(searchQuery) ||
          (monster.description && monster.description.toLowerCase().includes(searchQuery)) ||
          (monster.type && monster.type.toLowerCase().includes(searchQuery));
        if (matches) results.push({ ...monster, category: 'monster' });
      });
    } else if (activeTab === 'feats') {
      if (data.FEATS) {
        data.FEATS.forEach(feat => {
          const matches = feat.name.toLowerCase().includes(searchQuery) ||
            (feat.description && feat.description.toLowerCase().includes(searchQuery)) ||
            (feat.requirement && feat.requirement.toLowerCase().includes(searchQuery));
          if (matches) results.push({ ...feat, category: 'feat' });
        });
      }
    } else if (activeTab === 'talents') {
      if (data.TALENTS) {
        data.TALENTS.forEach(talent => {
          const matches = talent.name.toLowerCase().includes(searchQuery) ||
            (talent.description && talent.description.toLowerCase().includes(searchQuery)) ||
            (talent.requirement && talent.requirement.toLowerCase().includes(searchQuery));
          if (matches) results.push({ ...talent, category: 'talent' });
        });
      }
    }

    if (results.length === 0) {
      resultsGrid.innerHTML = `
        <div class="no-results-card glass">
          <p>No entries found matching "${searchQuery}"</p>
        </div>
      `;
      return;
    }

    results.sort((a, b) => a.name.localeCompare(b.name));
    console.log('renderResults completed', results.length);
    results.forEach(res => {
      const card = document.createElement('div');
      card.className = 'compendium-card glass hover-lift';
      let badgeColor = 'var(--mana-blue)';
      let typeLabel = res.class;
      // Override colors for specific classes
      if (res.category === 'spell' && res.class) {
        const cls = res.class.toLowerCase();
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
      }
      let itemTypeBadge = '';
      if (res.category === 'item') { 
        typeLabel = res.slot ? res.slot.toUpperCase() : 'ITEM'; 
        if (typeLabel === 'WEAPON') {
            badgeColor = '#b91c1c'; // Red
            // Use training field if available, otherwise fall back to type (old format)
            const trainingValue = res.training || res.type;
            if (trainingValue) {
                const wTraining = trainingValue.toUpperCase();
                let trainingColor = '#333';
                if (wTraining === 'SIMPLE') trainingColor = '#4b5563'; // Gray
                else if (wTraining === 'MARTIAL') trainingColor = '#7f1d1d'; // Dark Red
                else if (wTraining === 'GREAT') trainingColor = '#78350f'; // Dark Brown
                else if (wTraining === 'FOCUS') trainingColor = '#312e81'; // Indigo
                itemTypeBadge = `<div class="card-tag" style="background: ${trainingColor}">${wTraining}</div>`;
            }
            // If training exists separately, also show weapon type as its own badge
            if (res.training && res.type) {
                itemTypeBadge += `<div class="card-tag" style="background: #92400e">${res.type.toUpperCase()}</div>`;
            }
        }
        else if (typeLabel === 'ARMOR') badgeColor = '#1d4ed8'; // Blue
        else if (typeLabel === 'SHIELD') badgeColor = '#15803d'; // Green
        else if (typeLabel === 'OFF-HAND') badgeColor = '#0f766e'; // Teal
        else if (typeLabel === 'HEAD') badgeColor = '#b45309'; // Amber
        else if (typeLabel === 'NECK' || typeLabel === 'WAIST') badgeColor = '#6d28d9'; // Purple
        else if (typeLabel === 'HANDS' || typeLabel === 'FEET') badgeColor = '#4338ca'; // Indigo
        else if (typeLabel === 'FINGER') badgeColor = '#be185d'; // Pink
        else badgeColor = 'var(--gold)'; 
      }
      if (res.category === 'misc') { badgeColor = 'var(--amber)'; typeLabel = res.type ? res.type.toUpperCase() : 'ITEM'; }
      if (res.category === 'monster') { badgeColor = 'var(--blood-red)'; typeLabel = 'MONSTER'; }
      if (res.category === 'feat') { badgeColor = 'var(--emerald)'; typeLabel = 'FEAT'; }
      if (res.category === 'talent') { badgeColor = 'var(--stamina-gold)'; typeLabel = 'TALENT'; }
      const tagBadge = (res.category === 'spell' && res.tag) ? `<span class="card-tag tag-badge" style="background: var(--arcane-purple, #9b59b6);">${res.tag}</span>` : '';
      const spellTypeBadge = (res.category === 'spell' && res.type) ? `<div class="card-tag" style="background: ${getTypeColor(res.type)};">${res.type.charAt(0).toUpperCase() + res.type.slice(1).toLowerCase()}</div>` : '';
      card.innerHTML = `
        <div class="card-tag-row">${tagBadge}${spellTypeBadge}${itemTypeBadge}<div class="card-tag" style="background: ${badgeColor}">${typeLabel}</div></div>
        <h3 class="card-title">${res.name}</h3>
          <div class="card-meta">${res.category === 'spell' ? `${res.type ? `Type: ${res.type} | ` : ''}Cost: ${res.cost} | Activation: ${res.actTime} | Range: ${res.range} | Components: ${res.components} | Duration: ${res.duration} | Class: ${res.class}` : res.category === 'item' ? `Rarity: ${res.rarity || 'Common'}${res.type ? ` | Type: ${res.type}` : ''}${res.training ? ` | Training: ${res.training}` : ''}${res.class ? ` | Class: ${res.class}` : ''}${res.slot ? ` | Slot: ${res.slot}` : ''}` : res.category === 'misc' ? `Type: ${res.type || 'Item'}${res.slot ? ` | Slot: ${res.slot}` : ''}` : (res.category === 'feat' || res.category === 'talent') ? `Requirement: ${res.requirement}` : `${res.cr}`}</div>
        <p class="card-description">${res.description ? res.description.substring(0, 100) + '...' : ''}</p>
      `;
      card.addEventListener('click', () => showDetailModal(res));
      resultsGrid.appendChild(card);
    });
  }

  function generateDetailHTML(item) {
    let html = "";
    if (item.category === 'spell') {
      html += `
        <div class="spell-detail-card">
          <div class="spell-header">
            <h2>${item.name}</h2>
            <div class="spell-header-badges">
              ${item.tag ? `<span class="detail-badge tag-badge">${item.tag}</span>` : ''}
              ${item.type ? `<span class="detail-badge" style="background: ${getTypeColor(item.type)}; color: white;">${item.type.charAt(0).toUpperCase() + item.type.slice(1).toLowerCase()}</span>` : ''}
              <span class="detail-badge class-badge">${item.class}</span>
            </div>
          </div>
          <div class="spell-metadata-grid" style="display: grid; grid-template-columns: auto 1fr; gap: 32px; margin-bottom: 12px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div><strong>Class:</strong> ${item.class}</div>
              <div><strong>Attunement:</strong> ${item.attunement}</div>
              <div><strong>Cost:</strong> ${item.cost}</div>
              <div><strong>Act Time:</strong> ${item.actTime}</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div><strong>Range:</strong> ${item.range}</div>
              <div><strong>Duration:</strong> ${item.duration}</div>
              <div><strong>Components:</strong> ${item.components}</div>
              ${item.type ? `<div><strong>Type:</strong> ${item.type}</div>` : ''}
            </div>
          </div>
          <div class="detail-section">
            <h4>Description</h4>
            <p>${item.description}</p>
          </div>
          ${item.use ? `<div class="detail-section"><h4>Use</h4><p>${item.use}</p></div>` : ""}
          <div class="detail-section overcharge-section glass">
            <h4 class="overcharge-title">❖ Overcharge Effect</h4>
            <p><strong>Additional Cost:</strong> ${item.overchargeCost}</p>
            <p>${item.overchargeDesc}</p>
          </div>
        </div>
      `;
    } else if (item.category === 'species') {
      html += `
        <div class="item-detail-card">
          <div class="item-header">
            <h2>${item.name}</h2>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <span class="detail-badge item-badge">${[item.type, item.slot].filter(Boolean).join(' - ')}</span>
              ${item.rarity ? `<span class="detail-badge item-badge" style="background: var(--amber); color: #000;">${item.rarity}</span>` : ''}
            </div>
          </div>
          <div class="item-metadata-grid">
            ${item.type ? `<div><strong>Type:</strong> ${item.type}</div>` : ''}
            ${item.class ? `<div><strong>Class:</strong> ${item.class}</div>` : ''}
            ${item.slot ? `<div><strong>Slot:</strong> ${item.slot}</div>` : ''}
            ${item.defense ? `<div><strong>Defense:</strong> ${item.defense}</div>` : ''}
            ${item.resilience ? `<div><strong>Resilience:</strong> ${item.resilience}</div>` : ''}
            ${item.damageDie ? `<div><strong>Damage:</strong> ${item.damageDie} (${item.damageType})</div>` : ''}
            ${item.damageBonus ? `<div><strong>Modifier:</strong> ${linkifyTerms(item.damageBonus)}</div>` : ''}
            ${item.range ? `<div><strong>Range:</strong> ${item.range}</div>` : ''}
            ${item.grip ? `<div><strong>Grip:</strong> ${linkifyTerms(item.grip)}</div>` : ''}
            ${item.block ? `<div><strong>Block Modifier:</strong> ${item.block}</div>` : ''}
            ${item.properties ? `<div><strong>Properties:</strong> ${linkifyTerms(item.properties)}</div>` : ''}
            ${item.sneakPenalty ? `<div><strong style="color:var(--blood-red);">Sneak Penalty:</strong> ${item.sneakPenalty}</div>` : ''}
            ${item.movementPenalty ? `<div><strong style="color:var(--blood-red);">Movement Penalty:</strong> ${item.movementPenalty}</div>` : ''}
            ${item.cost ? `<div><strong>Cost:</strong> ${item.cost}</div>` : ''}
            ${item.weight ? `<div><strong>Weight:</strong> ${item.weight}</div>` : ''}
          </div>
          ${item.technique ? `
          <div class="detail-section">
            <h4>Technique (${item.technique})</h4>
            <p>❖ ${item.techniqueDesc || 'No technique description available.'}</p>
          </div>
          ` : ''}
          ${item.affix ? `
          <div class="detail-section">
            <h4>Magic Affix</h4>
            <p>❖ ${item.affix}</p>
          </div>
          ` : ''}
          <div class="detail-section">
            <h4>Description</h4>
            <p>${item.description || 'A standard piece of equipment.'}</p>
          </div>
          ${item.use ? `<div class="detail-section"><h4>Use</h4><p>${item.use}</p></div>` : ""}
        </div>
      `;
    } else if (item.category === 'item') {
      html += `
        <div class="item-detail-card">
          <div class="item-header">
            <h2>${item.name}</h2>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <span class="detail-badge item-badge">${[item.type, item.slot].filter(Boolean).join(' - ')}</span>
              ${item.rarity ? `<span class="detail-badge item-badge" style="background: var(--amber); color: #000;">${item.rarity}</span>` : ''}
            </div>
          </div>
          <div class="item-metadata-grid">
            ${item.type ? `<div><strong>Type:</strong> ${item.type}</div>` : ''}
            ${item.training ? `<div><strong>Training:</strong> ${item.training}</div>` : ''}
            ${item.class ? `<div><strong>Class:</strong> ${item.class}</div>` : ''}
            ${item.slot ? `<div><strong>Slot:</strong> ${item.slot}</div>` : ''}
            ${item.defense ? `<div><strong>Defense:</strong> ${item.defense}</div>` : ''}
            ${item.resilience ? `<div><strong>Resilience:</strong> ${item.resilience}</div>` : ''}
            ${item.damageDie ? `<div><strong>Damage:</strong> ${item.damageDie} (${item.damageType})</div>` : ''}
            ${item.damageBonus ? `<div><strong>Modifier:</strong> ${linkifyTerms(item.damageBonus)}</div>` : ''}
            ${item.range ? `<div><strong>Range:</strong> ${item.range}</div>` : ''}
            ${item.grip ? `<div><strong>Grip:</strong> ${linkifyTerms(item.grip)}</div>` : ''}
            ${item.block ? `<div><strong>Block Modifier:</strong> ${item.block}</div>` : ''}
            ${item.properties ? `<div><strong>Properties:</strong> ${linkifyTerms(item.properties)}</div>` : ''}
            ${item.sneakPenalty ? `<div><strong style="color:var(--blood-red);">Sneak Penalty:</strong> ${item.sneakPenalty}</div>` : ''}
            ${item.movementPenalty ? `<div><strong style="color:var(--blood-red);">Movement Penalty:</strong> ${item.movementPenalty}</div>` : ''}
            ${item.cost ? `<div><strong>Cost:</strong> ${item.cost}</div>` : ''}
            ${item.weight ? `<div><strong>Weight:</strong> ${item.weight}</div>` : ''}
          </div>
          ${item.technique ? `
          <div class="detail-section">
            <h4>Technique (${item.technique})</h4>
            <p>❖ ${item.techniqueDesc || 'No technique description available.'}</p>
          </div>
          ` : ''}
          ${item.affix ? `
          <div class="detail-section">
            <h4>Magic Affix</h4>
            <p>❖ ${item.affix}</p>
          </div>
          ` : ''}
          <div class="detail-section">
            <h4>Description</h4>
            <p>${item.description || 'A standard piece of equipment.'}</p>
          </div>
          ${item.use ? `<div class="detail-section"><h4>Use</h4><p>${item.use}</p></div>` : ""}
        </div>
      `;
    } else if (item.category === 'misc') {
      html += `
        <div class="item-detail-card">
          <div class="item-header">
            <h2>${item.name}</h2>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <span class="detail-badge item-badge" style="background: var(--amber); color: #000;">${item.type ? item.type.toUpperCase() : 'ITEM'}</span>
              ${item.slot ? `<span class="detail-badge item-badge">${item.slot}</span>` : ''}
            </div>
          </div>
          <div class="item-metadata-grid">
            ${item.type ? `<div><strong>Type:</strong> ${item.type}</div>` : ''}
            ${item.slot ? `<div><strong>Slot:</strong> ${item.slot}</div>` : ''}
            ${item.damageDie ? `<div><strong>Damage:</strong> ${item.damageDie} (${item.damageType})</div>` : ''}
            ${item.range ? `<div><strong>Range:</strong> ${item.range}</div>` : ''}
            ${item.properties ? `<div><strong>Properties:</strong> ${linkifyTerms(item.properties)}</div>` : ''}
            ${item.cost ? `<div><strong>Cost:</strong> ${item.cost}</div>` : ''}
            ${item.weight ? `<div><strong>Weight:</strong> ${item.weight}</div>` : ''}
          </div>
          <div class="detail-section">
            <h4>Description</h4>
            <p>${item.description || 'A standard item.'}</p>
          </div>
          ${item.use ? `<div class="detail-section"><h4>Use</h4><p>${item.use}</p></div>` : ""}
        </div>
      `;
    } else if (item.category === 'monster') {
      const stats = item.stats || {};
      const mod = v => {
        const m = Math.floor((v - 10) / 2);
        return m >= 0 ? `+${m}` : `${m}`;
      };

      const sumStats = (stats.Str || 10) + (stats.Dex || 10) + (stats.Con || 10) + (stats.Int || 10) + (stats.Wis || 10) + (stats.Lck || 10);
      const computedLevel = Math.round(sumStats / 3);
      const computedDR = Math.round(computedLevel / 3);
      
      const conScore = stats.Con || 10;
      const rawConMod = Math.floor((conScore - 10) / 2);
      const effectiveConMod = rawConMod < 0 ? 0 : rawConMod;
      const computedHP = (computedLevel * 5) + ((conScore + effectiveConMod) * 5);

      let abilitiesHTML = '';
      if (item.abilities && item.abilities.length > 0) {
        abilitiesHTML = item.abilities.map(ab => `
          <div class="glass-box" style="background:rgba(0,0,0,0.4); padding:10px; margin-bottom:8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">
            <strong style="color: var(--accent-gold); display: block; margin-bottom: 4px;">${ab.name}</strong>
            <span style="font-size: 0.9em; line-height: 1.4;">${ab.desc}</span>
          </div>
        `).join('');
      }

      let attacksHTML = '';
      if (item.attacks && item.attacks.length > 0) {
        attacksHTML = item.attacks.map(at => `
          <div class="glass-box" style="background:rgba(0,0,0,0.4); padding:10px; margin-bottom:8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">
            <strong style="color: #ff6b6b; display: block; margin-bottom: 4px;">${at.name}</strong>
            <span style="font-size: 0.9em; line-height: 1.4;">${at.desc}</span>
          </div>
        `).join('');
      }

      let actionsHTML = '';
      if (item.actions && item.actions.length > 0) {
        actionsHTML = item.actions.map(ac => `
          <div class="glass-box" style="background:rgba(0,0,0,0.4); padding:10px; margin-bottom:8px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">
            <strong style="color: #4dabf7; display: block; margin-bottom: 4px;">${ac.name}</strong>
            <span style="font-size: 0.9em; line-height: 1.4;">${ac.desc}</span>
          </div>
        `).join('');
      }

      html += `
        <div class="monster-detail-card">
          <div class="monster-header">
            <h2>${item.name}</h2>
            <span class="detail-badge monster-badge">Level ${computedLevel} | DR ${computedDR} | ${item.type}</span>
          </div>
          <div class="monster-health-defense" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; display: flex; justify-content: space-around;">
            <div><strong>HP:</strong> ${computedHP}</div>
            <div><strong>Def:</strong> ${item.defense}</div>
            <div><strong>Res:</strong> ${item.resilience}</div>
            <div><strong>Spd:</strong> ${item.speed}</div>
          </div>
          <div class="monster-stats-grid">
            <div class="monster-stat-box"><strong>STR</strong><span>${stats.Str || ''} (${mod(stats.Str)})</span></div>
            <div class="monster-stat-box"><strong>DEX</strong><span>${stats.Dex || ''} (${mod(stats.Dex)})</span></div>
            <div class="monster-stat-box"><strong>CON</strong><span>${stats.Con || ''} (${mod(stats.Con)})</span></div>
            <div class="monster-stat-box"><strong>INT</strong><span>${stats.Int || ''} (${mod(stats.Int)})</span></div>
            <div class="monster-stat-box"><strong>WIS</strong><span>${stats.Wis || ''} (${mod(stats.Wis)})</span></div>
            <div class="monster-stat-box"><strong>LCK</strong><span>${stats.Lck || ''} (${mod(stats.Lck)})</span></div>
          </div>
          ${abilitiesHTML ? `<div class="detail-section"><h4>Passives</h4>${abilitiesHTML}</div>` : ''}
          ${attacksHTML ? `<div class="detail-section"><h4>Attacks</h4>${attacksHTML}</div>` : ''}
          ${actionsHTML ? `<div class="detail-section"><h4>Actions</h4>${actionsHTML}</div>` : ''}
        </div>
      `;
    } else if (item.category === 'armor') {
      html += `
        <div class="feat-detail-card">
          <div class="feat-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 16px;">
            <h2>${item.name}</h2>
            <span class="detail-badge item-badge">ARMOR</span>
          </div>
          <div class="detail-section">
            <h4>Description</h4>
            <p>${item.description}</p>
          </div>
        </div>
      `;
    } else if (item.category === 'feat') {
      html += `
        <div class="feat-detail-card">
          <div class="feat-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 16px;">
            <h2>${item.name}</h2>
            <span class="detail-badge item-badge">FEAT</span>
          </div>
          <div class="detail-section">
            <h4>Requirement</h4>
            <p>${item.requirement}</p>
          </div>
          <div class="detail-section">
            <h4>Description</h4>
            <p>${item.description}</p>
          </div>
          ${item.use ? `<div class="detail-section"><h4>Use</h4><p>${item.use}</p></div>` : ""}
        </div>
      `;
    } else if (item.category === 'talent') {
      html += `
        <div class="talent-detail-card">
          <div class="talent-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 16px;">
            <h2>${item.name}</h2>
            <span class="detail-badge item-badge" style="background: var(--stamina-gold);">TALENT</span>
          </div>
          <div class="detail-section">
            <h4>Requirement</h4>
            <p>${item.requirement}</p>
          </div>
          <div class="detail-section">
            <h4>Description</h4>
            <p>${item.description}</p>
          </div>
          ${item.use ? `<div class="detail-section"><h4>Use</h4><p>${item.use}</p></div>` : ""}
        </div>
      `;
    }
    return html;
  }

  function showDetailModal(item) {
    let modal = document.getElementById('compendium-detail-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'compendium-detail-modal';
      modal.className = 'detail-modal-overlay';
      document.body.appendChild(modal);
    }
    modal.innerHTML = '';
    const content = document.createElement('div');
    content.className = 'detail-modal-content glass';
    let modalHTML = `<button class="modal-close-btn" onclick="document.getElementById('compendium-detail-modal').classList.remove('open')">×</button>`;
    modalHTML += generateDetailHTML(item);

    content.innerHTML = modalHTML;
    modal.appendChild(content);
    modal.classList.add('open');

    // Attach tooltip listeners for dynamically generated terms
    const tooltip = document.getElementById("hover-tooltip");
    if (tooltip) {
      modal.querySelectorAll(".info-tooltip-trigger").forEach(el => {
        el.addEventListener("mouseenter", (e) => {
          const html = el.getAttribute("data-html");
          if (html) {
            tooltip.innerHTML = html;
            tooltip.style.display = "block";
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
  }

  function openGlobalSearch(query = '') {
    window.location.hash = '#/compendium';
    searchQuery = query.toLowerCase();
    setTimeout(() => {
      init();
      renderResults();
      const searchInput = document.getElementById('compendium-search-bar');
      if (searchInput) searchInput.focus();
    }, 120);
  }

  return {
    init,
    openGlobalSearch,
    showDetail: showDetailModal,
    generateDetailHTML
  };
})();


