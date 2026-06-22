// B&B Character Creation Builder Wizard
window.BB_BUILDER = (() => {
  // Point buy cost table
  const POINT_BUY_COSTS = {
    8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
  };
  const MAX_POINTS = 27;

  function init() {
    render();
  }

  function getRemainingPoints(stats) {
    let spent = 0;
    for (let s in stats) {
      spent += POINT_BUY_COSTS[stats[s]] || 0;
    }
    return MAX_POINTS - spent;
  }

  function render() {
    const tooltip = document.getElementById("hover-tooltip");
    if (tooltip) tooltip.style.display = "none";

    const container = document.getElementById("main-view-container");
    if (!container) return;

    const state = window.BB_STATE.getBuilderState();

    let stepContent = "";
    if (state.step === 1) {
      stepContent = renderStep2(state); // Ancestry
    } else if (state.step === 2) {
      stepContent = renderStep3(state); // Class
    } else if (state.step === 3) {
      stepContent = renderStep1(state); // Background
    } else if (state.step === 4) {
      stepContent = renderStep4(state); // Attributes
    } else if (state.step === 5) {
      stepContent = renderStep5(state); // Equipment
    } else if (state.step === 6) {
      stepContent = renderStep6(state); // Finalize
    }

    container.innerHTML = `
      <div class="builder-page">
        <div class="page-header">
          <h1>Character Forge</h1>
        </div>

        <div class="builder-wizard glass">
          <div class="wizard-header">
            <div class="step-indicators">
              <div class="step-indicator ${state.step >= 1 ? "active" : ""}" data-step="1">1. Ancestry</div>
              <div class="step-indicator ${state.step >= 2 ? "active" : ""}" data-step="2">2. Class</div>
              <div class="step-indicator ${state.step >= 3 ? "active" : ""}" data-step="3">3. Background</div>
              <div class="step-indicator ${state.step >= 4 ? "active" : ""}" data-step="4">4. Attributes</div>
              <div class="step-indicator ${state.step >= 5 ? "active" : ""}" data-step="5">5. Equipment</div>
              <div class="step-indicator ${state.step >= 6 ? "active" : ""}" data-step="6">6. Finalize</div>
            </div>
            <div class="step-progress-bar">
              <div class="step-progress-fill" style="width: ${(state.step - 1) * 20}%"></div>
            </div>
          </div>

          <div class="wizard-body">
            ${stepContent}
          </div>

          <div class="wizard-footer">
            <button class="btn btn-secondary" id="builder-prev-btn" ${state.step === 1 ? "disabled" : ""}>Back</button>
            <button class="btn btn-primary" id="builder-next-btn">${state.step === 6 ? "Forge Character" : "Next"}</button>
          </div>
        </div>
      </div>
    `;

    setupEventListeners();
  }

  // Step 1: Basic Identity & Background
  function renderStep1(state) {
    const bgs = window.BB_DATABASE.BACKGROUNDS;
    
    let bgOptions = `<option value="">-- Choose Background --</option>`;
    bgs.forEach(bg => {
      const isSel = state.background && state.background.id === bg.id;
      bgOptions += `<option value="${bg.id}" ${isSel ? "selected" : ""}>${bg.name}</option>`;
    });

    let bgDetailsHtml = "";
    let traitsHtml = "";
    let physCharsHtml = "";
    let storyHtml = "";

    if (state.background) {
      bgDetailsHtml = `
        <div class="glass bg-accordion-item" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; transition: all 0.3s ease; margin-bottom: 20px;">
          <div class="bg-accordion-header" style="padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4);">
            <div>
              <h3 style="margin: 0; color: var(--amber);">${state.background.name}</h3>
            </div>
            <span class="bg-accordion-icon" style="color: var(--text-muted); font-size: 1.2rem; transition: transform 0.3s ease;">▶</span>
          </div>
          <div class="bg-accordion-body" style="max-height: 0px; padding: 0 15px; opacity: 0; overflow: hidden; transition: all 0.3s ease; border-top: none;">
            <p style="color:var(--text-muted); margin-top: 15px;">${state.background.description}</p>
            ${state.background.featureName ? `
              <div style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
                <strong style="color:var(--text-light);">Feature: ${state.background.featureName}</strong>
                <p style="margin-bottom:0; color:var(--text-muted); font-size:0.9rem;">${state.background.featureDesc}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      const renderTraitSelect = (type, list) => {
        let options = `<option value="">-- Select ${type} --</option>`;
        if (list && list.length) {
          list.forEach(item => {
            let selected = (state.backgroundTraits && state.backgroundTraits[type.toLowerCase()] === item) ? 'selected' : '';
            options += `<option value="${item.replace(/"/g, '&quot;')}" ${selected}>${item}</option>`;
          });
        }
        
        return `
          <div style="margin-bottom:15px;">
            <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">${type} <button class="btn btn-xs btn-secondary bg-roll-btn" data-type="${type.toLowerCase()}" style="margin-left:10px; padding:2px 8px; font-size:0.8rem;">Roll 🎲</button></label>
            <select class="form-control bg-trait-select" data-type="${type.toLowerCase()}" style="width:100%; margin-bottom:8px;">
              ${options}
            </select>
          </div>
        `;
      };

      const details = state.characterDetails || { faith: "", lifestyle: "" };
      const lifestyles = ["Wretched (1 Bronze Coin)", "Modest (1 Silver Coin)", "Comfortable (1 Gold Coin)", "Wealthy (5 Gold Coins)", "Aristocratic (10 Gold Coins)"];

      traitsHtml = `
        <div class="glass bg-accordion-item" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; transition: all 0.3s ease; margin-bottom: 20px;">
          <div class="bg-accordion-header" style="padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4);">
            <div>
              <h3 style="margin: 0; color: var(--amber);">Personal Characteristics</h3>
              <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">Faith • Lifestyle • Personality • Ideals • Bonds • Flaws</p>
            </div>
            <span class="bg-accordion-icon" style="color: var(--text-muted); font-size: 1.2rem; transition: transform 0.3s ease;">▶</span>
          </div>
          <div class="bg-accordion-body" style="max-height: 0px; padding: 0 15px; opacity: 0; overflow: hidden; transition: all 0.3s ease; border-top: none;">
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Faith</label>
              <input type="text" class="form-control builder-detail-input" data-field="faith" placeholder="Enter Faith..." value="${details.faith}" style="width:100%; margin-bottom:8px;">
            </div>
            ${renderTraitSelect('Trait', state.background.traits)}
            ${renderTraitSelect('Ideal', state.background.ideals)}
            ${renderTraitSelect('Bond', state.background.bonds)}
            ${renderTraitSelect('Flaw', state.background.flaws)}
            <div style="margin-bottom:15px; margin-top:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Lifestyle</label>
              <select class="form-control builder-detail-input" data-field="lifestyle" style="width:100%; margin-bottom:8px;">
                <option value="">-- Select Lifestyle --</option>
                ${lifestyles.map(l => `<option value="${l}" ${details.lifestyle === l ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
      `;

      const physical = state.physicalCharacteristics || { hair: "", skin: "", eyes: "", height: "", weight: "", age: "", gender: "" };
      const story = state.characterStory || { origins: "", motivation: "", allies: "", rivals: "", affiliations: "", notes: "" };

      physCharsHtml = `
        <div class="glass bg-accordion-item" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; transition: all 0.3s ease;">
          <div class="bg-accordion-header" style="padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4);">
            <div>
              <h3 style="margin: 0; color: var(--amber);">Physical Characteristics</h3>
              <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">Hair • Skin • Eyes • Height • Weight • Age • Gender</p>
            </div>
            <span class="bg-accordion-icon" style="color: var(--text-muted); font-size: 1.2rem; transition: transform 0.3s ease;">▶</span>
          </div>
          <div class="bg-accordion-body" style="max-height: 0px; padding: 0 15px; opacity: 0; overflow: hidden; transition: all 0.3s ease; border-top: none;">
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Hair</label>
              <input type="text" class="form-control builder-phys-input" data-field="hair" placeholder="e.g. Blonde, Black, None..." value="${physical.hair}" style="width:100%; margin-bottom:8px;">
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Skin</label>
              <input type="text" class="form-control builder-phys-input" data-field="skin" placeholder="e.g. Fair, Olive, Dark..." value="${physical.skin}" style="width:100%; margin-bottom:8px;">
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Eyes</label>
              <input type="text" class="form-control builder-phys-input" data-field="eyes" placeholder="e.g. Blue, Brown, Green..." value="${physical.eyes}" style="width:100%; margin-bottom:8px;">
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Height</label>
              <input type="text" class="form-control builder-phys-input" data-field="height" placeholder="e.g. 5'10&quot;, 180cm..." value="${physical.height}" style="width:100%; margin-bottom:8px;">
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Weight (lbs)</label>
              <input type="text" class="form-control builder-phys-input" data-field="weight" placeholder="e.g. 165, 80kg..." value="${physical.weight}" style="width:100%; margin-bottom:8px;">
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Age (Years)</label>
              <input type="text" class="form-control builder-phys-input" data-field="age" placeholder="e.g. 24..." value="${physical.age}" style="width:100%; margin-bottom:8px;">
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Gender</label>
              <input type="text" class="form-control builder-phys-input" data-field="gender" placeholder="e.g. Male, Female, Non-binary..." value="${physical.gender}" style="width:100%; margin-bottom:8px;">
            </div>
          </div>
        </div>
      `;

      storyHtml = `
        <div class="glass bg-accordion-item" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; transition: all 0.3s ease; margin-top: 20px;">
          <div class="bg-accordion-header" style="padding: 15px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4);">
            <div>
              <h3 style="margin: 0; color: var(--amber);">Character Story</h3>
              <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: var(--text-muted);">Origins • Motivation • Allies • Rivals • Affiliations • Notes</p>
            </div>
            <span class="bg-accordion-icon" style="color: var(--text-muted); font-size: 1.2rem; transition: transform 0.3s ease;">▶</span>
          </div>
          <div class="bg-accordion-body" style="max-height: 0px; padding: 0 15px; opacity: 0; overflow: hidden; transition: all 0.3s ease; border-top: none;">
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Origins <span style="font-weight:normal; font-size:0.85rem; color:var(--text-muted);">(Where are you from?)</span></label>
              <textarea class="form-control builder-story-input" data-field="origins" style="width:100%; min-height:80px; resize:vertical; margin-bottom:8px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light); padding:10px;">${story.origins}</textarea>
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Motivation <span style="font-weight:normal; font-size:0.85rem; color:var(--text-muted);">(What drives you?)</span></label>
              <textarea class="form-control builder-story-input" data-field="motivation" style="width:100%; min-height:80px; resize:vertical; margin-bottom:8px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light); padding:10px;">${story.motivation}</textarea>
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Allies <span style="font-weight:normal; font-size:0.85rem; color:var(--text-muted);">(Who can you rely on?)</span></label>
              <textarea class="form-control builder-story-input" data-field="allies" style="width:100%; min-height:80px; resize:vertical; margin-bottom:8px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light); padding:10px;">${story.allies}</textarea>
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Rivals <span style="font-weight:normal; font-size:0.85rem; color:var(--text-muted);">(Who stands in your way?)</span></label>
              <textarea class="form-control builder-story-input" data-field="rivals" style="width:100%; min-height:80px; resize:vertical; margin-bottom:8px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light); padding:10px;">${story.rivals}</textarea>
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Affiliations <span style="font-weight:normal; font-size:0.85rem; color:var(--text-muted);">(What groups are you connected to?)</span></label>
              <textarea class="form-control builder-story-input" data-field="affiliations" style="width:100%; min-height:80px; resize:vertical; margin-bottom:8px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light); padding:10px;">${story.affiliations}</textarea>
            </div>
            <div style="margin-bottom:15px;">
              <label style="display:block; color:var(--text-light); margin-bottom:5px; font-weight:bold;">Notes <span style="font-weight:normal; font-size:0.85rem; color:var(--text-muted);">(Additional details)</span></label>
              <textarea class="form-control builder-story-input" data-field="notes" style="width:100%; min-height:80px; resize:vertical; margin-bottom:8px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:var(--text-light); padding:10px;">${story.notes}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="wizard-step step-identity">
        <h2>Define Your Character</h2>
        <div class="form-group">
          <input type="text" id="char-name" class="form-control" placeholder="Enter name..." value="${state.name || ""}">
        </div>

        <h3 class="section-title-sm">Choose a Background</h3>
        
        <div class="form-group">
          <select id="builder-bg-select" class="form-control" style="width:100%; margin-bottom:20px;">
            ${bgOptions}
          </select>
        </div>

        ${bgDetailsHtml}
        ${traitsHtml}
        ${physCharsHtml}
        ${storyHtml}

      </div>
    `;
  }

  // Step 2: Ancestry Selection
  function renderStep2(state) {
    const speciesList = window.BB_DATABASE.SPECIES;
    
    let options = `<option value="">-- Choose Ancestry --</option>`;
    speciesList.forEach(sp => {
      const isSel = state.race && state.race.id === sp.id;
      options += `<option value="${sp.id}" ${isSel ? "selected" : ""}>${sp.name}</option>`;
    });

    let detailsHtml = "";

    if (state.race) {
      let bonuses = [];
      for (let s in state.race.bonuses) {
        bonuses.push(`+${state.race.bonuses[s]} ${s}`);
      }
      
      let skillBonusesText = "";
      if (state.race.id === "human") {
        const allSkills = [
          "Acrobatics", "Athletics", "Awareness", "Brawn", "Browbeat", "Bushcraft",
          "Commerce", "Concentration", "Diplomacy", "Endurance", "Investigation", "Knowledge",
          "Linguistics", "Medicine", "Performance", "Sleight of Hand", "Sneak", "Tolerance"
        ];
        let options1 = `<option value="">-- Choose Skill 1 --</option>`;
        let options2 = `<option value="">-- Choose Skill 2 --</option>`;
        const sb = state.humanSkillBonuses || ["", ""];
        allSkills.forEach(s => {
          options1 += `<option value="${s}" ${sb[0] === s ? 'selected' : ''}>${s}</option>`;
          options2 += `<option value="${s}" ${sb[1] === s ? 'selected' : ''}>${s}</option>`;
        });
        skillBonusesText = `
          <div style="margin-top: 10px; display:flex; gap:10px;">
            <select id="builder-human-skill-1" class="form-control" style="flex:1;">${options1}</select>
            <select id="builder-human-skill-2" class="form-control" style="flex:1;">${options2}</select>
          </div>
        `;
      } else if (state.race.skillBonuses) {
        let sb = [];
        for (let sk in state.race.skillBonuses) {
          sb.push(`+${state.race.skillBonuses[sk]} ${sk}`);
        }
        if (sb.length > 0) {
          skillBonusesText = sb.join(", ");
        }
      }

      let traitsHtml = "";
      if (state.race.ancestralFeat) {
        traitsHtml += `
          <div style="margin-bottom:15px; border-left: 3px solid var(--amber); padding-left: 10px;">
            <strong style="color:var(--amber); font-size:1.05rem;">Ancestral Feat: ${state.race.ancestralFeat.name}</strong>
            <p style="margin:4px 0 0 0; color:var(--text-muted); font-size:0.9rem; line-height:1.4;">${state.race.ancestralFeat.desc}</p>
          </div>
        `;
      }
      if (state.race.features) {
        state.race.features.forEach(f => {
          traitsHtml += `
            <div style="margin-bottom:10px;">
              <strong style="color:var(--text-light);">${f.name}</strong>
              <p style="margin:0; color:var(--text-muted); font-size:0.9rem;">${f.desc}</p>
            </div>
          `;
        });
      }

      if (["changeling", "human", "ogre"].includes(state.race.id)) {
        const allowedLanguages = ["Dwarvish", "Elvish", "Gigans", "Gnomish", "Jabber", "Orcish", "Sylvan", "Trog"];
        let langOptions = `<option value="">-- Choose Language --</option>`;
        allowedLanguages.forEach(l => {
          langOptions += `<option value="${l}" ${state.bonusLanguage === l ? 'selected' : ''}>${l}</option>`;
        });
        traitsHtml += `
          <div style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
            <strong style="color:var(--text-light); display:block; margin-bottom:5px;">Bonus Language</strong>
            <p style="margin:0 0 10px 0; color:var(--text-muted); font-size:0.9rem;">Your ancestry allows you to learn one additional language of your choice.</p>
            <select id="builder-bonus-lang" class="form-control">${langOptions}</select>
          </div>
        `;
      }

      detailsHtml = `
        <div class="glass" style="padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid rgba(255,255,255,0.1);">
          <h3 style="margin-top:0; color:var(--amber);">${state.race.name}</h3>
          <p style="color:var(--text-muted); line-height:1.4;">${state.race.description}</p>
          
          <div style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
            <div style="margin-bottom:5px;">
              <strong style="color:var(--text-light);">Attribute Bonuses:</strong> 
              <span style="color:var(--amber);">${bonuses.length > 0 ? bonuses.join(", ") : "None"}</span>
            </div>
            <div>
              <strong style="color:var(--text-light);">Skill Bonuses:</strong> 
              <span style="color:var(--amber);">${skillBonusesText ? skillBonusesText : "None"}</span>
            </div>
          </div>

          <div style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
            <h4 style="margin-top:0; color:var(--text-light); margin-bottom:15px;">Ancestral Traits</h4>
            ${traitsHtml || "<p style='color:var(--text-muted); font-size:0.9rem;'>No traits found.</p>"}
          </div>
        </div>
      `;
    }

    return `
      <div class="wizard-step step-species">
        <h2>Select Your Ancestry</h2>
        <p class="section-desc">Ancestry shapes your physical limits, modifiers, and passive traits.</p>
        
        <div class="form-group">
          <select id="builder-race-select" class="form-control" style="width:100%; margin-bottom:20px;">
            ${options}
          </select>
        </div>

        ${detailsHtml}
      </div>
    `;
  }

  // Step 3: Class Selection
  function renderStep3(state) {
    const classes = window.BB_DATABASE.CLASSES;
    
    let options = `<option value="">-- Choose Class --</option>`;
    classes.forEach(cls => {
      const isSel = state.class && state.class.id === cls.id;
      options += `<option value="${cls.id}" ${isSel ? "selected" : ""}>${cls.name}</option>`;
    });

    let detailsHtml = "";
    if (state.class) {
      const cls = state.class;
      const wTraining = cls.weaponTraining ? cls.weaponTraining.join(", ") : "None";
      const aTraining = cls.armorTraining ? cls.armorTraining.join(", ") : "None";
      const sBonuses = cls.skills && cls.skills.length > 0 ? cls.skills.join(", ") : "None";

      let featuresHtml = "";
      for (let i = 1; i <= 10; i++) {
        // Find if feature exists for this level
        const f = cls.features ? cls.features.find(feat => feat.level === i) : null;
        if (f) {
          featuresHtml += `
            <div class="glass" style="padding:10px; border-radius:4px; margin-bottom:10px; border-left:3px solid var(--amber);">
              <strong style="color:var(--text-light);">Level ${i}: ${f.name}</strong>
              <p style="margin:4px 0 0 0; color:var(--text-muted); font-size:0.9rem; line-height:1.4;">${f.desc}</p>
            </div>
          `;
        } else {
          featuresHtml += `
            <div class="glass" style="padding:10px; border-radius:4px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05); opacity:0.6;">
              <strong style="color:var(--text-light);">Level ${i} Feature</strong>
              <p style="margin:4px 0 0 0; color:var(--text-muted); font-size:0.9rem; line-height:1.4;">Pending data entry.</p>
            </div>
          `;
        }
      }

      detailsHtml = `
        <div class="glass" style="padding:15px; border-radius:8px; margin-bottom:20px; border:1px solid rgba(255,255,255,0.1);">
          <h3 style="margin-top:0; color:var(--amber);">${cls.name}</h3>
          <p style="color:var(--text-muted); line-height:1.4; margin-bottom:15px;">${cls.description}</p>
          
          <div style="margin-bottom:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
            <div style="margin-bottom:5px;">
              <strong style="color:var(--text-light);">Weapon Training:</strong> 
              <span style="color:var(--text-muted);">${wTraining}</span>
            </div>
            <div style="margin-bottom:5px;">
              <strong style="color:var(--text-light);">Armor Training:</strong> 
              <span style="color:var(--text-muted);">${aTraining}</span>
            </div>
            <div>
              <strong style="color:var(--text-light);">Class Skills:</strong> 
              <span style="color:var(--text-muted);">${sBonuses}</span>
            </div>
          </div>

          <div style="margin-top:15px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
            <h4 style="margin-top:0; color:var(--text-light); margin-bottom:15px;">Class Features</h4>
            ${featuresHtml}
          </div>
        </div>
      `;
    }

    return `
      <div class="wizard-step step-class">
        <h2>Select Your Class</h2>
        <p class="section-desc">Classes dictate your role in combat, resource pools, and special tactical options.</p>
        
        <div class="form-group">
          <select id="builder-class-select" class="form-control" style="width:100%; margin-bottom:20px;">
            ${options}
          </select>
        </div>

        <div style="max-height: 400px; overflow-y: auto; padding-right: 10px; margin-bottom: 20px;">
          ${detailsHtml}
        </div>
      </div>
    `;
  }

  // Step 4: Ability Scores (Point Buy or Standard Array)
  function renderStep4(state) {
    const keys = ["Str", "Dex", "Con", "Int", "Wis", "Lck"];
    const method = state.statMethod || "point-buy";
    
    let methodToggleHtml = `
      <div class="stat-method-toggle" style="margin-bottom: 20px; text-align: center;">
        <label style="margin-right: 10px; font-weight: bold; color: var(--text-light);">Generation Method:</label>
        <select id="builder-stat-method" class="form-select info-tooltip-trigger" style="background: rgba(0,0,0,0.5); color: var(--amber); border: 1px solid var(--amber); padding: 5px 10px; border-radius: 4px; font-weight: bold;">
          <option value="point-buy" ${method === "point-buy" ? "selected" : ""}>Attribute Point-Buy</option>
          <option value="standard-array" ${method === "standard-array" ? "selected" : ""}>Standard Array</option>
          <option value="rolled" ${method === "rolled" ? "selected" : ""}>Rolled</option>
        </select>
      </div>
    `;

    let contentHtml = "";

    const fullStatNames = { Str: "STRENGTH", Dex: "DEXTERITY", Con: "CONSTITUTION", Int: "INTELLIGENCE", Wis: "WISDOM", Lck: "LUCK" };

    if (method === "point-buy") {
      const remaining = getRemainingPoints(state.stats);
      let rows = "";
      keys.forEach(k => {
        const val = state.stats[k];
        const cost = POINT_BUY_COSTS[val];
        const isMax = val >= 15;
        const isMin = val <= 8;
        
        // Calculate modifier including species bonuses
        let raceBonus = 0;
        if (state.race && state.race.bonuses[k]) {
          raceBonus = state.race.bonuses[k];
        }
        const totalVal = val + raceBonus;
        const modStr = window.BB_STATE.getModifierString(totalVal);

        rows += `
          <div class="stat-buy-row glass">
            <div class="stat-buy-name">
              <strong title="${window.BB_DATABASE.STAT_DESCRIPTIONS[k].replace(/"/g, '&quot;')}">${fullStatNames[k]}</strong>
              <span class="stat-buy-desc">${getStatDescription(k)}</span>
            </div>
            
            <div class="stat-buy-controls">
              <button class="btn btn-secondary btn-circle stat-adjust-btn" data-stat="${k}" data-dir="-1" ${isMin ? "disabled" : ""}>-</button>
              <span class="stat-buy-value">${val}</span>
              <button class="btn btn-secondary btn-circle stat-adjust-btn" data-stat="${k}" data-dir="1" ${isMax || remaining < (POINT_BUY_COSTS[val+1] - cost) ? "disabled" : ""}>+</button>
            </div>

            <div class="stat-buy-species-bonus">
              Race Bonus: ${raceBonus >= 0 ? `+${raceBonus}` : raceBonus}
            </div>

            <div class="stat-buy-total">
              Total: <strong>${totalVal}</strong> (${modStr})
            </div>
          </div>
        `;
      });
      contentHtml = `
        <div class="point-buy-header glass">
          <div class="points-indicator">Points Remaining: <strong class="${remaining === 0 ? "complete-pulse" : ""}">${remaining} / ${MAX_POINTS}</strong></div>
          <p>Allocate points to customize your starting stats. Base values range from 8 to 15.</p>
        </div>
        <div class="stat-buy-list">
          ${rows}
        </div>
      `;
    } else if (method === "standard-array") {
      const stdArray = [15, 14, 13, 12, 10, 8];
      const usedVals = Object.values(state.stats).filter(v => v !== 0);
      let rows = "";
      keys.forEach(k => {
        const val = state.stats[k];
        let raceBonus = 0;
        if (state.race && state.race.bonuses[k]) {
          raceBonus = state.race.bonuses[k];
        }
        const totalVal = val > 0 ? val + raceBonus : 0;
        const modStr = totalVal > 0 ? window.BB_STATE.getModifierString(totalVal) : "--";

        let optionsHtml = `<option value="0">--</option>`;
        stdArray.forEach(opt => {
          const isUsed = val !== opt && usedVals.includes(opt);
          optionsHtml += `<option value="${opt}" ${val === opt ? "selected" : ""} ${isUsed ? "disabled" : ""}>${opt}</option>`;
        });

        rows += `
          <div class="stat-buy-row glass" style="display:flex; justify-content:space-between; align-items:center;">
            <div class="stat-buy-name">
              <strong title="${window.BB_DATABASE.STAT_DESCRIPTIONS[k].replace(/"/g, '&quot;')}">${fullStatNames[k]}</strong>
              <span class="stat-buy-desc" style="display:block; font-size:0.8rem; color:#ccc;">${getStatDescription(k)}</span>
            </div>
            
            <div class="stat-buy-controls">
              <select class="stat-array-select" data-stat="${k}" style="background: rgba(0,0,0,0.5); color: var(--text-light); border: 1px solid var(--amber); padding: 5px; border-radius: 4px; width: 60px; text-align: center;">
                ${optionsHtml}
              </select>
            </div>

            <div class="stat-buy-species-bonus">
              Race Bonus: ${raceBonus >= 0 ? `+${raceBonus}` : raceBonus}
            </div>

            <div class="stat-buy-total" style="width: 100px; text-align: right;">
              Total: <strong>${totalVal > 0 ? totalVal : "--"}</strong> ${totalVal > 0 ? `(${modStr})` : ""}
            </div>
          </div>
        `;
      });
      contentHtml = `
        <div class="point-buy-header glass">
          <p>Assign the standard array values (15, 14, 13, 12, 10, 8) to your attributes.</p>
        </div>
        <div class="stat-buy-list">
          ${rows}
        </div>
      `;
    } else if (method === "rolled") {
      const rolledStats = state.rolledStats || [null, null, null, null, null, null];
      let poolHtml = `<div class="rolled-pool-grid" style="display:flex; gap:10px; justify-content:center; margin-bottom:20px;">`;
      rolledStats.forEach((val, i) => {
        if (val === null) {
          poolHtml += `<button class="btn btn-secondary roll-stat-btn" data-slot="${i}" style="width: 60px; height: 60px; font-size:1.5rem; display:flex; align-items:center; justify-content:center;" title="Roll 4d6 Drop Lowest">🎲</button>`;
        } else {
          poolHtml += `<div class="glass" style="width: 60px; height: 60px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:bold; color:var(--amber); border:1px solid var(--amber); border-radius:4px;">${val}</div>`;
        }
      });
      poolHtml += `</div>`;

      const usedVals = Object.values(state.stats).filter(v => v !== 0);
      let rows = "";
      keys.forEach(k => {
        const val = state.stats[k];
        let raceBonus = 0;
        if (state.race && state.race.bonuses[k]) {
          raceBonus = state.race.bonuses[k];
        }
        const totalVal = val > 0 ? val + raceBonus : 0;
        const modStr = totalVal > 0 ? window.BB_STATE.getModifierString(totalVal) : "--";

        let availableCounts = {};
        rolledStats.forEach(v => {
          if (v !== null) availableCounts[v] = (availableCounts[v] || 0) + 1;
        });
        usedVals.forEach(v => {
          if (availableCounts[v] > 0) availableCounts[v]--;
        });

        let optionsHtml = `<option value="0">--</option>`;
        const sortedRolls = [...rolledStats].filter(v => v !== null).sort((a,b)=>b-a);
        sortedRolls.forEach((opt, index) => {
          const isSelected = (val === opt);
          const isDisabled = !isSelected && (!availableCounts[opt] || availableCounts[opt] <= 0);
          optionsHtml += `<option value="${opt}" ${isSelected ? "selected" : ""} ${isDisabled ? "disabled" : ""}>${opt}</option>`;
        });

        rows += `
          <div class="stat-buy-row glass" style="display:flex; justify-content:space-between; align-items:center;">
            <div class="stat-buy-name">
              <strong title="${window.BB_DATABASE.STAT_DESCRIPTIONS[k].replace(/"/g, '&quot;')}">${fullStatNames[k]}</strong>
              <span class="stat-buy-desc" style="display:block; font-size:0.8rem; color:#ccc;">${getStatDescription(k)}</span>
            </div>
            
            <div class="stat-buy-controls">
              <select class="stat-array-select" data-stat="${k}" style="background: rgba(0,0,0,0.5); color: var(--text-light); border: 1px solid var(--amber); padding: 5px; border-radius: 4px; width: 60px; text-align: center;">
                ${optionsHtml}
              </select>
            </div>

            <div class="stat-buy-species-bonus">
              Race Bonus: ${raceBonus >= 0 ? `+${raceBonus}` : raceBonus}
            </div>

            <div class="stat-buy-total" style="width: 100px; text-align: right;">
              Total: <strong>${totalVal > 0 ? totalVal : "--"}</strong> ${totalVal > 0 ? `(${modStr})` : ""}
            </div>
          </div>
        `;
      });
      contentHtml = `
        <div class="point-buy-header glass" style="position:relative;">
          <p>Click the dice below to roll your attributes (4d6 drop lowest). Once rolled, assign them below.</p>
          <button class="btn btn-secondary btn-sm reset-rolls-btn" style="position:absolute; top:10px; right:10px; padding: 4px 8px; font-size: 0.8rem;">Reset Rolls</button>
        </div>
        ${poolHtml}
        <div class="stat-buy-list">
          ${rows}
        </div>
      `;
    }

    return `
      <div class="wizard-step step-attributes">
        <h2>Attribute Generation</h2>
        ${methodToggleHtml}
        ${contentHtml}
      </div>
    `;
  }

  function getStatDescription(stat) {
    const desc = {
      Str: "Athletics, Brawn, Browbeat, and Defense.",
      Dex: "Acrobatics, Sleight of Hand, Sneak, and Stamina Points.",
      Con: "Concentration, Endurance, Tolerance, Hit Points, and Encumbrance.",
      Int: "Investigation, Knowledge, Linguistics, and Mana Points.",
      Wis: "Awareness, Bushcraft, Medicine, and Resilience.",
      Lck: "Commerce, Diplomacy, Performance, Initiative, and Fortune."
    };
    return desc[stat] || "";
  }



  // Step 5: Starting Equipment
  function renderStep5(state) {
    const eqState = state.equipmentState || { goldMethod: "average", generatedGold: null, shoppingCart: [] };
    const classGoldDice = {
      "Archon": 3, "Berserker": 5, "Disciple": 2, "Herald": 2,
      "Invoker": 4, "Justicar": 5, "Mage": 3, "Occultist": 3,
      "Prowler": 4, "Tracker": 4, "Vanguard": 5, "Warden": 2
    };
    const numDice = classGoldDice[state.class ? state.class.name : ""] || 0;
    
    let goldHtml = `
      <div class="glass" style="text-align: center; padding: 20px; margin-bottom: 20px;">
        <h3>Starting Wealth</h3>
        <p>Your class (${state.class ? state.class.name : "None"}) grants you <strong>${numDice}d4 x (10 + Lck Mod)</strong> gold.</p>
        <div style="margin-top:15px; display:flex; justify-content:center; gap: 10px;">
          <button class="btn btn-primary" id="btn-roll-gold">🎲 Roll for Gold</button>
          <button class="btn btn-secondary" id="btn-average-gold">Take Average (${Math.floor(numDice * 2.5)} x Modifier)</button>
        </div>
      </div>
    `;
    if (typeof eqState.generatedGold !== "undefined" && eqState.generatedGold !== null) {
      let remainingGold = eqState.generatedGold;
      const cart = eqState.shoppingCart || [];
      cart.forEach(item => {
        let costVal = parseInt(item.cost) || 0;
        let costStr = (item.cost || "").toLowerCase();
        if (costStr.includes("bronze")) costVal = costVal * 0.02;
        else if (costStr.includes("silver")) costVal = costVal * 0.2;
        else if (costStr.includes("platinum")) costVal = costVal * 2;
        else if (costStr.includes("crystal")) costVal = costVal * 20;
        remainingGold -= costVal;
      });

      const allItems = window.BB_DATABASE.ITEMS || [];
      const miscItems = window.BB_DATABASE.MISC_ITEMS || [];
      
      let wString = state.class && state.class.weaponTraining ? state.class.weaponTraining.join(" ").toLowerCase() : "";
      let aString = state.class && state.class.armorTraining ? state.class.armorTraining.join(" ").toLowerCase() : "";
      
      if (state.talents) {
        if (state.talents.includes("Aegis")) aString += " shields";
        if (state.talents.includes("Veiled")) aString += " ethereal";
        if (state.talents.includes("Mercurial")) aString += " light";
        if (state.talents.includes("Bulwark")) aString += " medium";
        if (state.talents.includes("Juggernaut")) aString += " heavy";
      }

      const isTrainedWeapon = (item) => {
        if (!state.class) return true;
        if (!item.type) return true;
        let iType = item.type.toLowerCase();
        let nameStr = item.name.toLowerCase();
        let iTraining = item.training ? item.training.toLowerCase() : "";
        
        if (iType.includes("focus") || iTraining.includes("focus") || nameStr.includes("implement") || nameStr.includes("stave") || nameStr.includes("wand") || nameStr.includes("crosier") || nameStr.includes("scepter")) {
          iType = "focus";
        }
        
        return wString.includes(iType) || wString.includes("all") || (iTraining && wString.includes(iTraining));
      };

      const isTrainedArmor = (item) => {
        if (!state.class) return true;
        if (!item.type) return true;
        let iType = item.type.toLowerCase();
        if (item.slot === "Helm" || item.slot === "Head" || item.slot === "Hands" || item.slot === "Neck" || item.slot === "Waist" || item.slot === "Finger" || item.slot === "Feet") return true;
        if (iType.includes("shield") || (item.slot && item.slot.toLowerCase() === "shield")) return aString.includes("shield");
        return aString.includes(iType) || aString.includes("all");
      };

      const allWeapons = allItems.filter(i => i.slot === "Weapon" || i.type === "Implement");
      const allArmor = allItems.filter(i => i.slot === "Armor" || i.type === "Shield" || i.slot === "Shield" || i.slot === "Helm" || i.slot === "Head" || i.slot === "Hands" || i.slot === "Neck" || i.slot === "Waist" || i.slot === "Finger" || i.slot === "Feet");

      const weapons = allWeapons.filter(isTrainedWeapon);
      const armor = allArmor.filter(isTrainedArmor);
      const items = [...allItems.filter(i => !allWeapons.includes(i) && !allArmor.includes(i)), ...miscItems];
      
      let shopItemsHtml = "";
      const currentCat = eqState.activeCategory || "Weapons";
      let listToRender = [];
      let subCategories = new Set(["All"]);

      if (currentCat === "Weapons") {
        listToRender = weapons;
        weapons.forEach(w => { if(w.type) subCategories.add(w.type); if(w.class) subCategories.add(w.class); });
      } else if (currentCat === "Armor") {
        listToRender = armor;
        armor.forEach(a => { if(a.type) subCategories.add(a.type); else if(a.slot && a.slot !== "Armor") subCategories.add(a.slot); });
      } else {
        listToRender = items;
        items.forEach(i => { if(i.type) subCategories.add(i.type); else if(i.slot) subCategories.add(i.slot); });
      }

      const subCatFilters = Array.from(subCategories).sort();
      const currentSubCat = eqState.subCategory || "All";
      const currentSort = eqState.sortBy || "name_asc";

      if (currentSubCat !== "All") {
        listToRender = listToRender.filter(i => i.type === currentSubCat || i.class === currentSubCat || i.slot === currentSubCat);
      }

      listToRender.sort((a, b) => {
        if (currentSort === "name_asc") return a.name.localeCompare(b.name);
        if (currentSort === "name_desc") return b.name.localeCompare(a.name);
        
        let costA = parseInt(a.cost.replace(/,/g, '')) || 0;
        let costStrA = (a.cost || "").toLowerCase();
        if (costStrA.includes("bronze")) costA *= 0.02;
        else if (costStrA.includes("silver")) costA *= 0.2;
        else if (costStrA.includes("platinum")) costA *= 2;
        else if (costStrA.includes("crystal")) costA *= 20;
        
        let costB = parseInt(b.cost.replace(/,/g, '')) || 0;
        let costStrB = (b.cost || "").toLowerCase();
        if (costStrB.includes("bronze")) costB *= 0.02;
        else if (costStrB.includes("silver")) costB *= 0.2;
        else if (costStrB.includes("platinum")) costB *= 2;
        else if (costStrB.includes("crystal")) costB *= 20;
        
        if (currentSort === "cost_asc") return costA - costB;
        if (currentSort === "cost_desc") return costB - costA;
        return 0;
      });

      let categoryTabsHtml = `
        <div style="display:flex; flex-wrap:wrap; gap: 10px; margin-bottom: 15px; align-items:center;">
          <button class="btn btn-sm ${currentCat === 'Weapons' ? 'btn-primary' : 'btn-secondary'} btn-shop-tab" data-tab="Weapons">Weapons</button>
          <button class="btn btn-sm ${currentCat === 'Armor' ? 'btn-primary' : 'btn-secondary'} btn-shop-tab" data-tab="Armor">Armor</button>
          <button class="btn btn-sm ${currentCat === 'Gear' ? 'btn-primary' : 'btn-secondary'} btn-shop-tab" data-tab="Gear">Gear</button>
          
          <div style="flex-grow:1;"></div>
          
          <select id="shop-subcategory-select" class="glass" style="padding:5px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:4px; cursor:pointer;">
            ${subCatFilters.map(sc => `<option value="${sc}" ${sc === currentSubCat ? 'selected' : ''}>${sc}</option>`).join('')}
          </select>
          
          <select id="shop-sort-select" class="glass" style="padding:5px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:4px; cursor:pointer;">
            <option value="name_asc" ${currentSort === 'name_asc' ? 'selected' : ''}>Name (A-Z)</option>
            <option value="name_desc" ${currentSort === 'name_desc' ? 'selected' : ''}>Name (Z-A)</option>
            <option value="cost_asc" ${currentSort === 'cost_asc' ? 'selected' : ''}>Cost (Low-High)</option>
            <option value="cost_desc" ${currentSort === 'cost_desc' ? 'selected' : ''}>Cost (High-Low)</option>
          </select>
        </div>
      `;

      listToRender.filter(i => i.cost).forEach((item, index) => {
        let costVal = parseInt(item.cost.replace(/,/g, '')) || 0;
        let costStr = (item.cost || "").toLowerCase();
        if (costStr.includes("bronze")) costVal = costVal * 0.02;
        else if (costStr.includes("silver")) costVal = costVal * 0.2;
        else if (costStr.includes("platinum")) costVal = costVal * 2;
        else if (costStr.includes("crystal")) costVal = costVal * 20;
        const canAfford = remainingGold >= costVal;
        
        if (!canAfford) return;
        
        shopItemsHtml += `
          <div class="shop-item glass" data-item-name="${item.name.replace(/"/g, '&quot;')}" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:10px; cursor:help;">
            <div>
              <strong>${item.name}</strong> <span style="color:var(--amber);">(${item.cost})</span>
              <div style="font-size:0.8rem; color:#aaa;">${item.type || "Item"}</div>
            </div>
            <button class="btn btn-sm ${canAfford ? 'btn-primary' : 'btn-secondary'} btn-buy-item" data-name="${item.name}" data-cost="${item.cost}" data-type="${item.type}" ${!canAfford ? 'disabled' : ''}>Buy</button>
          </div>
        `;
      });

      let cartHtml = "";
      if (cart.length === 0) {
        cartHtml = `<p>Your cart is empty.</p>`;
      } else {
        cart.forEach((item, idx) => {
          cartHtml += `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
              <span>${item.name}</span>
              <button class="btn btn-sm btn-danger btn-remove-item" data-index="${idx}" style="padding: 2px 6px;">x</button>
            </div>
          `;
        });
      }

      goldHtml += `
        <div style="display:flex; gap:20px;">
          <div style="flex:2;">
            <h3>Compendium Shop</h3>
            ${categoryTabsHtml}
            <div style="max-height:400px; overflow-y:auto; padding-right:10px;">
              ${shopItemsHtml}
            </div>
          </div>
          <div style="flex:1;">
            <div class="glass" style="padding:15px; position:sticky; top:20px;">
              ${(function() {
                let currentGold = Math.max(0, Math.floor(remainingGold));
                let rem = remainingGold - currentGold;
                rem = Math.round(rem * 100) / 100;
                let currentSilver = Math.floor(rem / 0.2);
                rem = rem - (currentSilver * 0.2);
                rem = Math.round(rem * 100) / 100;
                let currentBronze = Math.round(rem / 0.02);
                
                let text = `Remaining: ${currentGold} GP`;
                if (currentSilver > 0) text += `, ${currentSilver} SP`;
                if (currentBronze > 0) text += `, ${currentBronze} BP`;
                return `<h3 style="color:var(--amber); text-align:center; font-size:1.1rem; margin-bottom:5px;">${text}</h3>`;
              })()}
              <div style="text-align:center; font-size:0.8rem; color:#aaa; margin-bottom:15px;">(Starting Gold: ${eqState.generatedGold})</div>
              <hr>
              <h4>Inventory</h4>
              ${cartHtml}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="wizard-step step-equipment">
        <h2>Starting Equipment</h2>
        ${goldHtml}
      </div>
    `;
  }

  // Step 6: Summary & Naming & Finish
  function renderStep6(state) {
    let speciesName = state.race ? state.race.name : "None";
    let className = state.class ? state.class.name : "None";
    let bgName = state.background ? state.background.name : "None";

    // Modifiers summary
    let statsSummary = "";
    for (let k in state.stats) {
      let raceBonus = state.race ? (state.race.bonuses[k] || 0) : 0;
      let total = state.stats[k] + raceBonus;
      statsSummary += `
        <div class="summary-stat-box glass">
          <span class="lbl">${k}</span>
          <span class="val">${total}</span>
          <span class="mod">${window.BB_STATE.getModifierString(total)}</span>
        </div>
      `;
    }

    // Hit points & resources summary
    const effectiveCon = state.stats.Con + (state.race ? (state.race.bonuses.Con || 0) : 0);
    const conMod = window.BB_STATE.getModifier(effectiveCon);
    let hpVal = (effectiveCon + conMod) * 5;

    const effectiveInt = state.stats.Int + (state.race ? (state.race.bonuses.Int || 0) : 0);
    const intMod = window.BB_STATE.getModifier(effectiveInt);
    let mpVal = effectiveInt + intMod;

    const effectiveDex = state.stats.Dex + (state.race ? (state.race.bonuses.Dex || 0) : 0);
    const dexMod = window.BB_STATE.getModifier(effectiveDex);
    let spVal = effectiveDex + dexMod;

    return `
      <div class="wizard-step step-summary">
        <h2>Forge Summary</h2>
        <p class="section-desc">Review your choices before forging your character sheet.</p>

        <div class="summary-overview glass">
          <div class="summary-identity">
            <h3>${state.name || "Unnamed Hunter"}</h3>
            <p>Level 1 | ${speciesName} | ${className}</p>
            <p>Background: <strong>${bgName}</strong></p>
          </div>
          
          <div class="summary-pools">
            <div class="pool-box hp">
              <span>HP</span>
              <strong>${hpVal}</strong>
            </div>
            <div class="pool-box mp">
              <span>Mana</span>
              <strong>${mpVal}</strong>
            </div>
            <div class="pool-box sp">
              <span>Stamina</span>
              <strong>${spVal}</strong>
            </div>
          </div>
        </div>

        <div class="summary-details-grid" style="grid-template-columns: 1fr;">
          <div class="summary-left">
            <h3 class="section-title-sm">Stats</h3>
            <div class="summary-stats-flex">
              ${statsSummary}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function setupEventListeners() {
    const state = window.BB_STATE.getBuilderState();

    // Text inputs
    const charName = document.getElementById("char-name");
    if (charName) {
      charName.addEventListener("input", (e) => {
        window.BB_STATE.updateBuilderState({ name: e.target.value });
      });
    }

    // Background Select
    const bgSelect = document.getElementById("builder-bg-select");
    if (bgSelect) {
      bgSelect.addEventListener("change", (e) => {
        const id = e.target.value;
        const found = window.BB_DATABASE.BACKGROUNDS.find(b => b.id === id) || null;
        window.BB_STATE.updateBuilderState({ 
          background: found, 
          backgroundTraits: { trait: "", ideal: "", bond: "", flaw: "" },
          characterDetails: { faith: "", lifestyle: "" },
          selectedSkills: [] 
        });
        render();
      });
    }

    // Background Accordion Toggle
    document.querySelectorAll(".bg-accordion-header").forEach(header => {
      header.addEventListener("click", () => {
        const body = header.nextElementSibling;
        const icon = header.querySelector('.bg-accordion-icon');
        if (body.style.maxHeight !== '0px') {
          body.style.maxHeight = '0px';
          body.style.padding = '0 15px';
          body.style.opacity = '0';
          body.style.borderTop = 'none';
          icon.innerText = '▶';
        } else {
          body.style.maxHeight = '2000px';
          body.style.padding = '15px';
          body.style.opacity = '1';
          body.style.borderTop = '1px solid rgba(255,255,255,0.1)';
          icon.innerText = '▼';
        }
      });
    });

    // Background Personality Selects
    document.querySelectorAll(".bg-trait-select").forEach(select => {
      select.addEventListener("change", (e) => {
        const type = e.target.getAttribute("data-type");
        const val = e.target.value;
        const currentState = window.BB_STATE.getBuilderState();
        const currentTraits = currentState.backgroundTraits || { trait: "", ideal: "", bond: "", flaw: "" };
        const newTraits = { ...currentTraits, [type]: val };
        window.BB_STATE.updateBuilderState({ backgroundTraits: newTraits });
      });
    });

    // Character Details Inputs
    document.querySelectorAll(".builder-detail-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const field = e.target.getAttribute("data-field");
        const val = e.target.value;
        const currentState = window.BB_STATE.getBuilderState();
        const currentDetails = currentState.characterDetails || { faith: "", lifestyle: "" };
        const newDetails = { ...currentDetails, [field]: val };
        window.BB_STATE.updateBuilderState({ characterDetails: newDetails });
      });
    });

    document.querySelectorAll(".builder-story-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const field = e.target.getAttribute("data-field");
        const val = e.target.value;
        const currentState = window.BB_STATE.getBuilderState();
        const currentStory = currentState.characterStory || { origins: "", motivation: "", allies: "", rivals: "", affiliations: "", notes: "" };
        const newStory = { ...currentStory, [field]: val };
        window.BB_STATE.updateBuilderState({ characterStory: newStory });
      });
    });

    document.querySelectorAll(".builder-phys-input").forEach(input => {
      input.addEventListener("change", (e) => {
        const field = e.target.getAttribute("data-field");
        const val = e.target.value;
        const currentState = window.BB_STATE.getBuilderState();
        const currentPhys = currentState.physicalCharacteristics || { hair: "", skin: "", eyes: "", height: "", weight: "", age: "", gender: "" };
        const newPhys = { ...currentPhys, [field]: val };
        window.BB_STATE.updateBuilderState({ physicalCharacteristics: newPhys });
      });
    });

    // Background Personality Roll Buttons
    document.querySelectorAll(".bg-roll-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const type = e.currentTarget.getAttribute("data-type");
        const currentState = window.BB_STATE.getBuilderState();
        if (!currentState.background) return;
        const list = currentState.background[type + "s"]; // map 'trait' -> 'traits'
        
        if (list && list.length > 0) {
          const randomIdx = Math.floor(Math.random() * list.length);
          const selected = list[randomIdx];
          const currentTraits = currentState.backgroundTraits || { trait: "", ideal: "", bond: "", flaw: "" };
          const newTraits = { ...currentTraits, [type]: selected };
          window.BB_STATE.updateBuilderState({ backgroundTraits: newTraits });
          window.BB_DICE.showToastNotification(`Rolled random ${type}: ${selected}`);
          
          const selectElement = document.querySelector(`.bg-trait-select[data-type="${type}"]`);
          if (selectElement) {
            selectElement.value = selected.replace(/"/g, '&quot;');
          }
        }
      });
    });

    const raceSelect = document.getElementById("builder-race-select");
    if (raceSelect) {
      raceSelect.addEventListener("change", (e) => {
        const id = e.target.value;
        const found = window.BB_DATABASE.SPECIES.find(s => s.id === id) || null;
        window.BB_STATE.updateBuilderState({ race: found, humanSkillBonuses: ["", ""], bonusLanguage: "" });
        render();
      });
    }

    const humanSkill1 = document.getElementById("builder-human-skill-1");
    if (humanSkill1) {
      humanSkill1.addEventListener("change", (e) => {
        const current = state.humanSkillBonuses || ["", ""];
        window.BB_STATE.updateBuilderState({ humanSkillBonuses: [e.target.value, current[1]] });
        render();
      });
    }

    const humanSkill2 = document.getElementById("builder-human-skill-2");
    if (humanSkill2) {
      humanSkill2.addEventListener("change", (e) => {
        const current = state.humanSkillBonuses || ["", ""];
        window.BB_STATE.updateBuilderState({ humanSkillBonuses: [current[0], e.target.value] });
        render();
      });
    }

    const bonusLang = document.getElementById("builder-bonus-lang");
    if (bonusLang) {
      bonusLang.addEventListener("change", (e) => {
        window.BB_STATE.updateBuilderState({ bonusLanguage: e.target.value });
        render();
      });
    }

    const classSelect = document.getElementById("builder-class-select");
    if (classSelect) {
      classSelect.addEventListener("change", (e) => {
        const id = e.target.value;
        const found = window.BB_DATABASE.CLASSES.find(c => c.id === id) || null;
        window.BB_STATE.updateBuilderState({ class: found, selectedSkills: [] });
        render();
      });
    }

    // Attribute Generation Method Toggle
    const statMethodSelect = document.getElementById("builder-stat-method");
    if (statMethodSelect) {
      statMethodSelect.addEventListener("change", (e) => {
        const method = e.target.value;
        let newStats;
        if (method === "point-buy") {
          newStats = { Str: 8, Dex: 8, Con: 8, Int: 8, Wis: 8, Lck: 8 };
        } else {
          newStats = { Str: 0, Dex: 0, Con: 0, Int: 0, Wis: 0, Lck: 0 };
        }
        let updatePayload = { statMethod: method, stats: newStats };
        if (method === "rolled") {
          updatePayload.rolledStats = [null, null, null, null, null, null];
        }
        window.BB_STATE.updateBuilderState(updatePayload);
        render();
      });
    }

    // Standard Array adjustments
    document.querySelectorAll(".stat-array-select").forEach(select => {
      select.addEventListener("change", (e) => {
        const stat = e.target.getAttribute("data-stat");
        const val = parseInt(e.target.value);
        const statsCopy = { ...state.stats };
        statsCopy[stat] = val;
        window.BB_STATE.updateBuilderState({ stats: statsCopy });
        render();
      });
    });

    // Rolled stats buttons
    document.querySelectorAll(".roll-stat-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const slot = parseInt(e.currentTarget.getAttribute("data-slot"));
        if (window.BB_DICE && window.BB_DICE.roll) {
          window.BB_DICE.roll("Attribute", 3, 6, 0, 2, 6, false, "", 0, "", true, (result) => {
            const currentState = window.BB_STATE.getBuilderState();
            const newRolledStats = [...(currentState.rolledStats || [null, null, null, null, null, null])];
            newRolledStats[slot] = result;
            window.BB_STATE.updateBuilderState({ rolledStats: newRolledStats });
            render();
          });
        }
      });
    });

    const resetRollsBtn = document.querySelector(".reset-rolls-btn");
    if (resetRollsBtn) {
      resetRollsBtn.addEventListener("click", () => {
        window.BB_STATE.updateBuilderState({ 
          rolledStats: [null, null, null, null, null, null],
          stats: { Str: 0, Dex: 0, Con: 0, Int: 0, Wis: 0, Lck: 0 }
        });
        render();
      });
    }

    // Point buy adjustments
    document.querySelectorAll(".stat-adjust-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const stat = btn.getAttribute("data-stat");
        const dir = parseInt(btn.getAttribute("data-dir"));
        const currentVal = state.stats[stat];
        const newVal = currentVal + dir;
        
        if (newVal >= 8 && newVal <= 15) {
          const statsCopy = { ...state.stats };
          statsCopy[stat] = newVal;
          
          // Verify remaining points is positive
          const remaining = getRemainingPoints(statsCopy);
          if (remaining >= 0) {
            window.BB_STATE.updateBuilderState({ stats: statsCopy });
            render();
          }
        }
      });
    });



    // Equipment Shop listeners
    const btnRollGold = document.getElementById("btn-roll-gold");
    if (btnRollGold) {
      btnRollGold.addEventListener("click", () => {
        const currentState = window.BB_STATE.getBuilderState();
        const classGoldDice = {
          "Archon": 3, "Berserker": 5, "Disciple": 2, "Herald": 2,
          "Invoker": 4, "Justicar": 5, "Mage": 3, "Occultist": 3,
          "Prowler": 4, "Tracker": 4, "Vanguard": 5, "Warden": 2
        };
        const numDice = classGoldDice[currentState.class ? currentState.class.name : ""] || 0;
        
        if (window.BB_DICE && window.BB_DICE.roll) {
          window.BB_DICE.roll("Starting Wealth", numDice, 4, 0, 0, 0, false, "", 0, "", true, (result) => {
            const luckMod = window.BB_STATE.getModifier(currentState.stats.Lck + (currentState.race.bonuses.Lck || 0));
            const totalGold = result * (10 + luckMod);
            
            const eqState = { 
              shoppingCart: [], 
              ...(currentState.equipmentState || {}), 
              goldMethod: "roll", 
              generatedGold: Math.max(0, totalGold) 
            };
            window.BB_STATE.updateBuilderState({ equipmentState: eqState });
            render();
          });
        }
      });
    }

    const btnAverageGold = document.getElementById("btn-average-gold");
    if (btnAverageGold) {
      btnAverageGold.addEventListener("click", () => {
        const currentState = window.BB_STATE.getBuilderState();
        const classGoldDice = {
          "Archon": 3, "Berserker": 5, "Disciple": 2, "Herald": 2,
          "Invoker": 4, "Justicar": 5, "Mage": 3, "Occultist": 3,
          "Prowler": 4, "Tracker": 4, "Vanguard": 5, "Warden": 2
        };
        const numDice = classGoldDice[currentState.class ? currentState.class.name : ""] || 0;
        const luckMod = window.BB_STATE.getModifier(currentState.stats.Lck + (currentState.race.bonuses.Lck || 0));
        const totalGold = Math.floor(numDice * 2.5) * (10 + luckMod);
        
        const eqState = { 
          shoppingCart: [], 
          ...(currentState.equipmentState || {}), 
          goldMethod: "average", 
          generatedGold: Math.max(0, totalGold) 
        };
        window.BB_STATE.updateBuilderState({ equipmentState: eqState });
        render();
      });
    }
    document.querySelectorAll(".shop-item").forEach(itemEl => {
      itemEl.addEventListener("mouseenter", (e) => {
        const itemName = itemEl.getAttribute("data-item-name");
        if (!itemName) return;
        const dbItems = window.BB_DATABASE.ITEMS || [];
        const miscItems = window.BB_DATABASE.MISC_ITEMS || [];
        let itemObj = dbItems.find(i => i.name === itemName);
        if (itemObj) {
          itemObj = { ...itemObj, category: "item" };
        } else {
          itemObj = miscItems.find(i => i.name === itemName);
          if (itemObj) itemObj = { ...itemObj, category: "misc" };
        }
        if (itemObj && window.BB_COMPENDIUM && window.BB_COMPENDIUM.generateDetailHTML) {
          const tooltip = document.getElementById("hover-tooltip");
          if (tooltip) {
            tooltip.innerHTML = window.BB_COMPENDIUM.generateDetailHTML(itemObj);
            tooltip.style.display = "block";
          }
        }
      });
      itemEl.addEventListener("mousemove", (e) => {
        const tooltip = document.getElementById("hover-tooltip");
        if (tooltip && tooltip.style.display === "block") {
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
      itemEl.addEventListener("mouseleave", () => {
        const tooltip = document.getElementById("hover-tooltip");
        if (tooltip) {
          tooltip.style.display = "none";
        }
      });
    });

    document.querySelectorAll(".btn-buy-item").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const currentState = window.BB_STATE.getBuilderState();
        const itemName = e.target.getAttribute("data-name");
        const itemCost = e.target.getAttribute("data-cost");
        const itemType = e.target.getAttribute("data-type");
        
        const eqState = { shoppingCart: [], ...(currentState.equipmentState || {}) };
        eqState.shoppingCart = [...eqState.shoppingCart, { name: itemName, cost: itemCost, type: itemType }];
        
        window.BB_STATE.updateBuilderState({ equipmentState: eqState });
        render();
      });
    });

    document.querySelectorAll(".btn-remove-item").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const currentState = window.BB_STATE.getBuilderState();
        const idx = parseInt(e.target.getAttribute("data-index"));
        
        const eqState = { shoppingCart: [], ...(currentState.equipmentState || {}) };
        const newCart = [...eqState.shoppingCart];
        newCart.splice(idx, 1);
        eqState.shoppingCart = newCart;
        
        window.BB_STATE.updateBuilderState({ equipmentState: eqState });
        render();
      });
    });

    document.querySelectorAll(".btn-shop-tab").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tab = e.target.getAttribute("data-tab");
        const currentState = window.BB_STATE.getBuilderState();
        const eqState = { ...(currentState.equipmentState || {}), activeCategory: tab, subCategory: "All" };
        window.BB_STATE.updateBuilderState({ equipmentState: eqState });
        render();
      });
    });

    const subCatSelect = document.getElementById("shop-subcategory-select");
    if (subCatSelect) {
      subCatSelect.addEventListener("change", (e) => {
        const currentState = window.BB_STATE.getBuilderState();
        const eqState = { ...(currentState.equipmentState || {}), subCategory: e.target.value };
        window.BB_STATE.updateBuilderState({ equipmentState: eqState });
        render();
      });
    }

    const sortSelect = document.getElementById("shop-sort-select");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        const currentState = window.BB_STATE.getBuilderState();
        const eqState = { ...(currentState.equipmentState || {}), sortBy: e.target.value };
        window.BB_STATE.updateBuilderState({ equipmentState: eqState });
        render();
      });
    }

    const prevBtn = document.getElementById("builder-prev-btn");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        const currentState = window.BB_STATE.getBuilderState();
        if (currentState.step > 1) {
          window.BB_STATE.updateBuilderState({ step: currentState.step - 1 });
          render();
        }
      });
    }

    const nextBtn = document.getElementById("builder-next-btn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const currentState = window.BB_STATE.getBuilderState();
        if (currentState.step === 6) {
          forgeCharacterAndSave();
        } else {
          if (validateStep(currentState.step, currentState)) {
            window.BB_STATE.updateBuilderState({ step: currentState.step + 1 });
            render();
          }
        }
      });
    }
  }

  function validateStep(step, state) {
    if (step === 1) { // Ancestry
      if (!state.race) {
        window.BB_DICE.showToastNotification("Select a species!");
        return false;
      }
      if (state.race.id === "human") {
        if (!state.humanSkillBonuses || !state.humanSkillBonuses[0] || !state.humanSkillBonuses[1]) {
          window.BB_DICE.showToastNotification("Please select two distinct skill bonuses for your Human ancestry.");
          return false;
        }
        if (state.humanSkillBonuses[0] === state.humanSkillBonuses[1]) {
          window.BB_DICE.showToastNotification("You must choose two DIFFERENT skills for your Human ancestry bonus.");
          return false;
        }
      }
      if (["changeling", "human", "ogre"].includes(state.race.id)) {
        if (!state.bonusLanguage) {
          window.BB_DICE.showToastNotification(`Please select an additional language for your ${state.race.name}.`);
          return false;
        }
      }
    } else if (step === 2) { // Class
      if (!state.class) {
        window.BB_DICE.showToastNotification("Select a class!");
        return false;
      }
    } else if (step === 3) { // Background
      if (!state.name || !state.name.trim()) {
        window.BB_DICE.showToastNotification("A hero needs a name!");
        return false;
      }
      if (!state.background) {
        window.BB_DICE.showToastNotification("Choose a background to understand your past!");
        return false;
      }
      if (!state.backgroundTraits || !state.backgroundTraits.trait || !state.backgroundTraits.ideal || !state.backgroundTraits.bond || !state.backgroundTraits.flaw) {
        window.BB_DICE.showToastNotification("Please select a Trait, Ideal, Bond, and Flaw before proceeding!");
        return false;
      }
    } else if (step === 4) {
      if (state.statMethod === "standard-array") {
        const hasUnassigned = Object.values(state.stats).some(v => v === 0);
        if (hasUnassigned) {
          window.BB_DICE.showToastNotification("Assign all standard array values before continuing.");
          return false;
        }
      } else if (state.statMethod === "rolled") {
        const hasUnrolled = !state.rolledStats || state.rolledStats.some(v => v === null);
        if (hasUnrolled) {
          window.BB_DICE.showToastNotification("Roll all 6 attributes before continuing.");
          return false;
        }
        const hasUnassigned = Object.values(state.stats).some(v => v === 0);
        if (hasUnassigned) {
          window.BB_DICE.showToastNotification("Assign all rolled values before continuing.");
          return false;
        }
      } else {
        const remaining = getRemainingPoints(state.stats);
        if (remaining > 0) {
          window.BB_DICE.showToastNotification("Allocate all 27 attribute points before continuing.");
          return false;
        }
      }
    } else if (step === 5) { // Equipment
      if (!state.equipmentState || typeof state.equipmentState.generatedGold === "undefined" || state.equipmentState.generatedGold === null) {
        window.BB_DICE.showToastNotification("Generate your starting gold before continuing!");
        return false;
      }
    }
    return true;
  }

  function forgeCharacterAndSave() {
    const builder = window.BB_STATE.getBuilderState();

    // Calc attribute totals (base + race)
    const finalStats = {};
    for (let k in builder.stats) {
      let bonus = builder.race.bonuses[k] || 0;
      finalStats[k] = builder.stats[k] + bonus;
    }

    // Health / Resource formulas
    const conMod = window.BB_STATE.getModifier(finalStats.Con);
    const intMod = window.BB_STATE.getModifier(finalStats.Int);
    const dexMod = window.BB_STATE.getModifier(finalStats.Dex);
    
    const hpVal = (finalStats.Con + conMod) * 5;
    const mpVal = finalStats.Int + intMod;
    const spVal = finalStats.Dex + dexMod;
    const encumbMax = finalStats.Con * 10;
    
    const eqState = builder.equipmentState || { generatedGold: 0, shoppingCart: [] };
    
    let remainingGold = eqState.generatedGold || 0;
    let inventorySlots = new Array(20).fill("");
    let invIndex = 0;

    let presets = {
      head: "", armor: "", hands: "", feet: "",
      mainHand: "", offHand: "", waist: "", neck: "",
      finger1: "", finger2: "", container1: "", container2: "",
      coins: { bronze: 0, silver: 0, gold: 0, platinum: 0, crystal: 0 }
    };

    eqState.shoppingCart.forEach(item => {
      let costVal = parseInt(item.cost) || 0;
      let costStr = (item.cost || "").toLowerCase();
      if (costStr.includes("bronze")) costVal = costVal * 0.02;
      else if (costStr.includes("silver")) costVal = costVal * 0.2;
      else if (costStr.includes("platinum")) costVal = costVal * 2;
      else if (costStr.includes("crystal")) costVal = costVal * 20;
      remainingGold -= costVal;

      if (item.type && (item.type.includes("Melee") || item.type.includes("Ranged") || item.type.includes("Weapon")) && !presets.mainHand) {
        presets.mainHand = item.name;
      } else if (item.type && item.type.includes("Armor") && !presets.armor) {
        presets.armor = item.name;
      } else {
        if (invIndex < 20) {
          inventorySlots[invIndex] = { name: item.name, quantity: 1 };
          invIndex++;
        }
      }
    });

    let finalGold = Math.max(0, remainingGold);
    presets.coins.gold = Math.floor(finalGold);
    
    let remainder = finalGold - presets.coins.gold;
    remainder = Math.round(remainder * 100) / 100; // Fix floating point errors
    
    presets.coins.silver = Math.floor(remainder / 0.2);
    remainder = remainder - (presets.coins.silver * 0.2);
    remainder = Math.round(remainder * 100) / 100;
    
    presets.coins.bronze = Math.round(remainder / 0.02);

    // Class starting spells
    let startSpells = [];


    const newCharacter = {
      id: "hunter-" + Date.now(),
      name: builder.name,
      race: builder.race.name,
      class: builder.class.name,
      background: builder.background ? builder.background.name : "None",
      backgroundTraits: builder.backgroundTraits || { trait: "", ideal: "", bond: "", flaw: "" },
      characterDetails: builder.characterDetails || { faith: "", lifestyle: "" },
      physicalCharacteristics: builder.physicalCharacteristics || { hair: "", skin: "", eyes: "", height: "", weight: "", age: "", gender: "" },
      characterStory: builder.characterStory || { origins: "", motivation: "", allies: "", rivals: "", affiliations: "", notes: "" },
      level: 1,
      xp: 0,
      hp: { current: hpVal, total: hpVal, temp: 0 },
      mp: { current: mpVal, total: mpVal },
      sp: { current: spVal, total: spVal },
      defense: 10 + window.BB_STATE.getModifier(finalStats.Dex) + (presets.armor === "Brigand's Leather" ? 3 : 0),
      resilience: 10 + window.BB_STATE.getModifier(finalStats.Con) + (presets.armor === "Brigand's Leather" ? 1 : 0),
      movement: 30 + (builder.race.name === "Elf" ? 5 : 0),
      attunement: { used: startSpells.length, total: 3 },
      restDice: { used: 0 },
      encumbrance: 0,
      stats: finalStats,
      spentStatPoints: 0,
      deathSaves: { successes: 0, failures: 0 },
      humanSkillBonuses: builder.humanSkillBonuses || ["", ""],
      bonusLanguage: builder.bonusLanguage || "",
      talents: ["", "", "", "", ""],
      feats: ["", "", "", "", "", ""],
      equipment: presets,
      inventorySlots: inventorySlots,
      spells: startSpells
    };

    window.BB_STATE.saveCharacter(newCharacter);
    window.BB_STATE.setActiveCharacter(newCharacter.id);

    // Reset the builder so the next character starts fresh
    window.BB_STATE.resetBuilderState();

    // Redirect to character sheets
    window.location.hash = `#/characters`;
    window.BB_DICE.showToastNotification(`${newCharacter.name} has been forged successfully!`);
  }

  return {
    init
  };
})();
