// B&B Campaign Management Module
window.BB_CAMPAIGN = (() => {
  let container = null;
  let activeCampaign = null;

  function init() {
    container = document.getElementById("main-view-container");
    if (!container) return;

    // Load initial view
    renderCampaignList();
  }

  function renderCampaignList() {
    const campaigns = window.BB_STATE.getCampaigns() || [];
    
    let listHTML = "";
    if (campaigns.length === 0) {
      listHTML = `<p style="font-style: italic; color: var(--text-light); text-align: center;">No campaigns found. Create one to get started!</p>`;
    } else {
      listHTML = `<div style="display: flex; flex-direction: column; gap: 15px;">`;
      campaigns.forEach(camp => {
        listHTML += `
          <div class="glass hover-lift" style="padding: 15px; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="window.BB_CAMPAIGN.openCampaign('${camp.id}')">
            <div>
              <h3 style="margin: 0; color: var(--amber);">${camp.name}</h3>
              <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 5px;">
                Party Size: ${camp.partyMembers ? camp.partyMembers.length : 0} | Quests: ${camp.quests ? camp.quests.length : 0}
              </div>
            </div>
            <button class="btn btn-danger btn-xs" onclick="event.stopPropagation(); window.BB_CAMPAIGN.deleteCampaign('${camp.id}')">Delete</button>
          </div>
        `;
      });
      listHTML += `</div>`;
    }

    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: var(--amber);">Campaigns</h2>
          <button class="btn btn-primary" onclick="window.BB_CAMPAIGN.createNewCampaign()">+ New Campaign</button>
        </div>
        ${listHTML}
      </div>
    `;
  }

  function createNewCampaign() {
    const name = prompt("Enter a name for the new campaign:");
    if (!name || !name.trim()) return;

    const newCamp = {
      id: "camp_" + Date.now(),
      name: name.trim(),
      partyMembers: [],
      quests: [],
      partyLoot: []
    };
    
    window.BB_STATE.saveCampaign(newCamp);
    renderCampaignList();
  }

  function deleteCampaign(id) {
    if (confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) {
      window.BB_STATE.deleteCampaign(id);
      renderCampaignList();
    }
  }

  function openCampaign(id) {
    activeCampaign = window.BB_STATE.getCampaign(id);
    if (!activeCampaign) return renderCampaignList();
    renderCampaignDashboard();
  }

  function renderCampaignDashboard() {
    if (!activeCampaign) return;

    // Load available characters for party selection
    const allChars = window.BB_STATE.getSavedCharacters() || [];
    const availableChars = allChars.filter(c => !(activeCampaign.partyMembers || []).includes(c.id));
    
    let partyHTML = "";
    if (!activeCampaign.partyMembers || activeCampaign.partyMembers.length === 0) {
      partyHTML = `<div style="font-style: italic; color: var(--text-light); margin-top: 10px;">No party members yet.</div>`;
    } else {
      partyHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 15px;">`;
      activeCampaign.partyMembers.forEach(charId => {
        const char = allChars.find(c => c.id === charId);
        if (char) {
          partyHTML += `
            <div class="glass" style="padding: 10px; border-radius: 6px; position: relative;">
              <button onclick="window.BB_CAMPAIGN.removePartyMember('${char.id}')" style="position: absolute; top: 5px; right: 5px; background: rgba(255,0,0,0.5); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">x</button>
              <strong>${char.name}</strong><br>
              <span style="font-size: 0.8rem; color: var(--text-light);">Level ${char.level} ${char.race} ${char.class}</span><br>
              <span style="font-size: 0.8rem; color: #ff6b6b;">HP: ${char.hp.current}/${char.hp.total}</span>
            </div>
          `;
        }
      });
      partyHTML += `</div>`;
    }

    let questsHTML = "";
    if (!activeCampaign.quests || activeCampaign.quests.length === 0) {
      questsHTML = `<div style="font-style: italic; color: var(--text-light); margin-top: 10px;">No active quests.</div>`;
    } else {
      questsHTML = `<ul style="list-style: none; padding: 0; margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">`;
      activeCampaign.quests.forEach((q, idx) => {
        questsHTML += `
          <li class="glass" style="padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span style="white-space: pre-wrap; color: #fff;">${q}</span>
            <button class="btn btn-danger btn-xs" onclick="window.BB_CAMPAIGN.removeQuest(${idx})">Complete</button>
          </li>
        `;
      });
      questsHTML += `</ul>`;
    }

    let lootHTML = "";
    if (!activeCampaign.partyLoot || activeCampaign.partyLoot.length === 0) {
      lootHTML = `<div style="font-style: italic; color: var(--text-light); margin-top: 10px;">The party stash is empty.</div>`;
    } else {
      lootHTML = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 15px;">`;
      activeCampaign.partyLoot.forEach((item, idx) => {
        lootHTML += `
          <div class="glass" style="padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span>${item}</span>
            <button class="btn btn-danger btn-xs" onclick="window.BB_CAMPAIGN.removeLoot(${idx})" style="padding: 2px 6px;">x</button>
          </div>
        `;
      });
      lootHTML += `</div>`;
    }

    container.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto; padding: 20px; animation: fadeIn 0.3s ease;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,193,7,0.3); padding-bottom: 15px; margin-bottom: 20px;">
          <div>
            <button class="btn btn-xs" onclick="window.BB_CAMPAIGN.init()" style="margin-bottom: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff;">&larr; Back to Campaigns</button>
            <h2 style="margin: 0; color: var(--amber); font-size: 2rem; text-shadow: 0 0 10px rgba(255,193,7,0.3);">${activeCampaign.name}</h2>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          
          <!-- Party Roster -->
          <div class="glass" style="padding: 20px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
              <h3 style="margin: 0; color: #4dabf7;">Party Roster</h3>
              <div style="display: flex; gap: 5px;">
                <select id="party-member-select" style="background: rgba(0,0,0,0.5); color: #fff; border: 1px solid rgba(255,255,255,0.2); padding: 4px; border-radius: 4px;">
                  <option value="">-- Select Character --</option>
                  ${availableChars.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                </select>
                <button class="btn btn-primary btn-xs" onclick="window.BB_CAMPAIGN.addPartyMember()">Add</button>
              </div>
            </div>
            ${partyHTML}
          </div>

          <!-- Quest Log -->
          <div class="glass" style="padding: 20px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
              <h3 style="margin: 0; color: #69db7c;">Quest Log</h3>
              <button class="btn btn-primary btn-xs" onclick="window.BB_CAMPAIGN.addQuest()">+ Add Quest</button>
            </div>
            ${questsHTML}
          </div>

          <!-- Party Loot -->
          <div class="glass" style="grid-column: span 2; padding: 20px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
              <h3 style="margin: 0; color: #ffd43b;">Party Loot Stash</h3>
              <button class="btn btn-primary btn-xs" onclick="window.BB_CAMPAIGN.addLoot()">+ Add Loot</button>
            </div>
            ${lootHTML}
          </div>

        </div>
      </div>
    `;
  }

  function addPartyMember() {
    const select = document.getElementById("party-member-select");
    if (!select || !select.value) return;
    
    if (!activeCampaign.partyMembers) activeCampaign.partyMembers = [];
    activeCampaign.partyMembers.push(select.value);
    
    window.BB_STATE.saveCampaign(activeCampaign);
    renderCampaignDashboard();
  }

  function removePartyMember(charId) {
    if (!activeCampaign.partyMembers) return;
    activeCampaign.partyMembers = activeCampaign.partyMembers.filter(id => id !== charId);
    window.BB_STATE.saveCampaign(activeCampaign);
    renderCampaignDashboard();
  }

  function addQuest() {
    const quest = prompt("Enter quest details or note:");
    if (!quest || !quest.trim()) return;

    if (!activeCampaign.quests) activeCampaign.quests = [];
    activeCampaign.quests.push(quest.trim());
    
    window.BB_STATE.saveCampaign(activeCampaign);
    renderCampaignDashboard();
  }

  function removeQuest(idx) {
    if (!activeCampaign.quests) return;
    activeCampaign.quests.splice(idx, 1);
    window.BB_STATE.saveCampaign(activeCampaign);
    renderCampaignDashboard();
  }

  function addLoot() {
    const loot = prompt("Enter item name (e.g., 50 Gold, Health Potion):");
    if (!loot || !loot.trim()) return;

    if (!activeCampaign.partyLoot) activeCampaign.partyLoot = [];
    activeCampaign.partyLoot.push(loot.trim());
    
    window.BB_STATE.saveCampaign(activeCampaign);
    renderCampaignDashboard();
  }

  function removeLoot(idx) {
    if (!activeCampaign.partyLoot) return;
    activeCampaign.partyLoot.splice(idx, 1);
    window.BB_STATE.saveCampaign(activeCampaign);
    renderCampaignDashboard();
  }

  return {
    init,
    createNewCampaign,
    deleteCampaign,
    openCampaign,
    addPartyMember,
    removePartyMember,
    addQuest,
    removeQuest,
    addLoot,
    removeLoot
  };
})();
