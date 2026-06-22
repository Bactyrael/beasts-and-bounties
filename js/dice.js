// B&B Virtual Dice Roller
window.BB_DICE = (() => {
  let diceOverlay = null;

  function init() {
    // Create dice overlay container if not exists
    if (!document.getElementById("dice-roller-overlay")) {
      diceOverlay = document.createElement("div");
      diceOverlay.id = "dice-roller-overlay";
      diceOverlay.className = "dice-overlay";
      diceOverlay.innerHTML = `
        <div class="dice-modal-content glass">
          <div class="dice-title" id="dice-roll-title">Rolling Athletics...</div>
          <div class="dice-visual-container">
            <div class="virtual-die d20-die" id="virtual-die-element">20</div>
          </div>
          <div class="dice-result-label" id="dice-roll-total">Total: --</div>
          <div class="dice-breakdown" id="dice-roll-breakdown">Roll: [15] + Modifier: 3</div>
          <button class="btn btn-primary dice-close-btn" id="close-dice-btn">Accept</button>
        </div>
      `;
      document.body.appendChild(diceOverlay);

      document.getElementById("close-dice-btn").addEventListener("click", hideDiceOverlay);
    } else {
      diceOverlay = document.getElementById("dice-roller-overlay");
    }
  }

  function hideDiceOverlay() {
    if (diceOverlay) {
      diceOverlay.classList.remove("active");
    }
  }

  function roll(label, dieCount, dieType, modifier = 0, advantageMode = 0, critRange = 0, canCrit = true, grip = "", extraModifier = 0, extraBreakdown = "", isPrivate = false, onComplete = null, extraDice = null) {
    init();

    // Read global advantage toggle
    const advToggle = document.getElementById("advantage-toggle");
    if (advToggle && advToggle.value !== "normal") {
      if (advToggle.value === "adv_dice" || advToggle.value === "advantage") advantageMode = 1;
      else if (advToggle.value === "dis_dice" || advToggle.value === "disadvantage") advantageMode = -1;
      else if (advToggle.value === "adv_die") advantageMode = 2;
      else if (advToggle.value === "dis_die") advantageMode = -2;
    }

    // Global Untrained Armor Penalty
    const char = window.BB_STATE.getActiveCharacter && window.BB_STATE.getActiveCharacter();
    if (char && char.hasUntrainedArmor) {
      advantageMode = -1;
      if (!label.includes("(Untrained Armor)")) {
        label += " (Untrained Armor)";
      }
    }

    const overlayTitle = document.getElementById("dice-roll-title");
    let dieElement = document.getElementById("virtual-die-element");
    if (!dieElement) {
      const container = document.querySelector(".dice-visual-container");
      container.innerHTML = '<div class="virtual-die" id="virtual-die-element"></div>';
      dieElement = document.getElementById("virtual-die-element");
    }
    const totalElement = document.getElementById("dice-roll-total");
    const breakdownElement = document.getElementById("dice-roll-breakdown");

    let titleSuffix = "";
    if (advantageMode === 1) titleSuffix = " (Advantage Dice)";
    else if (advantageMode === -1) titleSuffix = " (Disadvantage Dice)";
    else if (advantageMode === 2) titleSuffix = " (Advantage Die)";
    else if (advantageMode === -2) titleSuffix = " (Disadvantage Die)";

    if (isPrivate) titleSuffix += " [Private]";

    overlayTitle.textContent = `Rolling ${label}${titleSuffix}...`;
    totalElement.textContent = "Total: --";
    breakdownElement.textContent = "Rolling...";

    // Configure dice visual container
    const container = document.querySelector(".dice-visual-container");
    container.innerHTML = "";
    container.style.display = "flex";
    container.style.gap = "10px";
    container.style.flexWrap = "wrap";
    container.style.justifyContent = "center";

    // Determine how many dice to spawn
    let spawnCount = dieCount;
    if (advantageMode === 1 || advantageMode === -1) {
      spawnCount = dieCount * 2;
    } else if (advantageMode === 2 || advantageMode === -2) {
      spawnCount = dieCount + 1;
    }

    const virtualDice = [];
    for (let i = 0; i < spawnCount; i++) {
      const dieEl = document.createElement("div");
      dieEl.className = `virtual-die d${dieType}-die rolling`;
      dieEl.style.width = "60px";
      dieEl.style.height = "60px";
      dieEl.style.fontSize = "1.5rem";
      dieEl.style.lineHeight = "60px";
      container.appendChild(dieEl);
      virtualDice.push(dieEl);
    }
    
    const extraVirtualDice = [];
    if (extraDice) {
      for (let i = 0; i < extraDice.count; i++) {
        const dieEl = document.createElement("div");
        dieEl.className = `virtual-die d${extraDice.type}-die rolling extra-die`;
        dieEl.style.width = "60px";
        dieEl.style.height = "60px";
        dieEl.style.fontSize = "1.5rem";
        dieEl.style.lineHeight = "60px";
        dieEl.style.borderColor = "#a855f7";
        dieEl.style.color = "#a855f7";
        container.appendChild(dieEl);
        extraVirtualDice.push(dieEl);
      }
    }

    let inspDieEl = null;
    let inspDieType = 0;
    if (char && char.useInspiration && char.inspirationDie && (char.inspirationCount || 0) > 0) {
      try {
        inspDieType = parseInt(String(char.inspirationDie).replace("d", "")) || 0;
        if (inspDieType > 0) {
          inspDieEl = document.createElement("div");
          inspDieEl.className = `virtual-die d${inspDieType}-die rolling insp-die`;
          inspDieEl.style.width = "60px";
          inspDieEl.style.height = "60px";
          inspDieEl.style.fontSize = "1.5rem";
          inspDieEl.style.lineHeight = "60px";
          inspDieEl.style.borderColor = "var(--amber)";
          inspDieEl.style.color = "var(--amber)";
          container.appendChild(inspDieEl);
        }
      } catch (e) { console.error("Error setting up inspDie:", e); }
    }

    // Show overlay
    diceOverlay.classList.add("active");

    let iterations = 10;
    let interval = setInterval(() => {
      try {
        virtualDice.forEach(el => {
          el.textContent = Math.floor(Math.random() * dieType) + 1;
        });
        extraVirtualDice.forEach(el => {
          el.textContent = Math.floor(Math.random() * extraDice.type) + 1;
        });
        if (inspDieEl) {
          inspDieEl.textContent = Math.floor(Math.random() * inspDieType) + 1;
        }
      } catch(e) { console.error("Interval error:", e); }
    }, 60);

    setTimeout(() => {
      clearInterval(interval);

      virtualDice.forEach(el => el.classList.remove("rolling"));
      extraVirtualDice.forEach(el => el.classList.remove("rolling"));
      if (inspDieEl) inspDieEl.classList.remove("rolling");

      let inspDieResult = 0;
      if (inspDieEl) {
        try {
          inspDieResult = Math.floor(Math.random() * inspDieType) + 1;
          inspDieEl.textContent = inspDieResult;
          extraModifier = (extraModifier || 0) + inspDieResult;
          extraBreakdown = (extraBreakdown ? extraBreakdown + " | " : "") + `Inspiration (${char.inspirationDie}): +${inspDieResult}`;
          
          char.useInspiration = false;
          char.inspirationCount = Math.max(0, (char.inspirationCount || 0) - 1);
          if (char.inspirationCount === 0) {
             char.inspirationDie = "";
          }
          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) {
             window.BB_APP.renderActiveTab();
          }
        } catch (e) { console.error("Error processing inspDieResult:", e); }
      }

      // Calculate final roll
      const rolls = [];
      let rollSum = 0;
      let hasCrit = false;
      let criticalBonus = 0;
      
      let critThreshold = dieType - critRange;
      if (critThreshold < 1) critThreshold = 1;
      if (dieType <= 1) canCrit = false;
      
      let breakdownText = "";
      
      const modSign = modifier >= 0 ? "+" : "-";
      const absMod = Math.abs(modifier);

      const rollSingleDie = () => {
        let val = Math.floor(Math.random() * dieType) + 1;
        if (grip === "Double" && (val === 1 || val === 2)) {
          val = Math.floor(Math.random() * dieType) + 1;
        }
        return val;
      };

      if (advantageMode === 1 || advantageMode === -1) {
        let displayPairs = [];
        for (let i = 0; i < dieCount; i++) {
          let val1 = rollSingleDie();
          let val2 = rollSingleDie();
          let kept = advantageMode === 1 ? Math.max(val1, val2) : Math.min(val1, val2);
          rolls.push(kept);
          rollSum += kept;
          if (canCrit && kept >= critThreshold) hasCrit = true;
          displayPairs.push(`[${val1},${val2}->${kept}]`);

          // Update visuals
          const el1 = virtualDice[i * 2];
          const el2 = virtualDice[i * 2 + 1];
          el1.textContent = val1;
          el2.textContent = val2;

          if (kept === val1 && kept !== val2) {
            el2.classList.add("dropped-die");
          } else if (kept === val2 && kept !== val1) {
            el1.classList.add("dropped-die");
          } else {
             // they tied, drop the second one
             el2.classList.add("dropped-die");
          }
        }
        breakdownText = `Roll: ${displayPairs.join(" ")} ${modSign} ${absMod}`;
      } else if (advantageMode === 2 || advantageMode === -2) {
        let pool = [];
        for (let i = 0; i < dieCount + 1; i++) {
          pool.push({ val: rollSingleDie(), index: i });
        }
        pool.sort((a, b) => a.val - b.val);
        
        let droppedIndex = -1;
        let droppedVal = 0;
        if (advantageMode === 2) {
          let dropped = pool.shift();
          droppedIndex = dropped.index;
          droppedVal = dropped.val;
        } else {
          let dropped = pool.pop();
          droppedIndex = dropped.index;
          droppedVal = dropped.val;
        }
        
        pool.forEach(item => {
          rolls.push(item.val);
          rollSum += item.val;
          if (canCrit && item.val >= critThreshold) hasCrit = true;
        });

        // Restore original order for visuals
        let originalOrder = [];
        if (advantageMode === 2) {
          originalOrder = [ {val: droppedVal, index: droppedIndex}, ...pool ].sort((a,b) => a.index - b.index);
        } else {
          originalOrder = [ ...pool, {val: droppedVal, index: droppedIndex} ].sort((a,b) => a.index - b.index);
        }

        originalOrder.forEach((item, i) => {
          virtualDice[i].textContent = item.val;
          if (i === droppedIndex) {
            virtualDice[i].classList.add("dropped-die");
          }
        });
        
        breakdownText = `Roll: [${rolls.join(", ")}] (Dropped: ${droppedVal}) ${modSign} ${absMod}`;
      } else {
        for (let i = 0; i < dieCount; i++) {
          let val = rollSingleDie();
          rolls.push(val);
          rollSum += val;
          if (canCrit && val >= critThreshold) hasCrit = true;
          virtualDice[i].textContent = val;
        }
        breakdownText = `Roll: [${rolls.join(", ")}] ${modSign} ${absMod}`;
      }

      if (hasCrit) {
        criticalBonus = rollSingleDie();
        rollSum += criticalBonus;
        
        virtualDice.forEach(el => {
          if (!el.classList.contains("dropped-die")) {
            el.classList.add("crit-pulse");
          }
        });
        setTimeout(() => {
          virtualDice.forEach(el => el.classList.remove("crit-pulse"));
        }, 1000);
      }

      if (extraDice) {
        let extraSum = 0;
        let extraRolls = [];
        for (let i = 0; i < extraDice.count; i++) {
           let v = Math.floor(Math.random() * extraDice.type) + 1;
           extraRolls.push(v);
           extraSum += v;
           if (extraVirtualDice[i]) extraVirtualDice[i].textContent = v;
        }
        rollSum += extraSum;
        breakdownText += ` | + [${extraRolls.join(", ")}] ${extraDice.label || ""}`;
      }

      const totalResult = rollSum + modifier + extraModifier;

      try {
        clearInterval(interval);

        virtualDice.forEach(el => el.classList.remove("rolling"));
        extraVirtualDice.forEach(el => el.classList.remove("rolling"));
        if (inspDieEl) inspDieEl.classList.remove("rolling");

        let inspDieResult = 0;
        if (inspDieEl) {
          try {
            inspDieResult = Math.floor(Math.random() * inspDieType) + 1;
            inspDieEl.textContent = inspDieResult;
            extraModifier = (extraModifier || 0) + inspDieResult;
            extraBreakdown = (extraBreakdown ? extraBreakdown + " | " : "") + `Inspiration (${char.inspirationDie}): +${inspDieResult}`;
            
            char.useInspiration = false;
            char.inspirationCount = Math.max(0, (char.inspirationCount || 0) - 1);
            if (char.inspirationCount === 0) {
               char.inspirationDie = "";
            }
            window.BB_STATE.saveCharacter(char);
            if (window.BB_APP && window.BB_APP.renderActiveTab) {
               window.BB_APP.renderActiveTab();
            }
          } catch (e) { console.error("Error processing inspDieResult:", e); }
        }

        // Calculate final roll
        const rolls = [];
        let rollSum = 0;
        let hasCrit = false;
        let criticalBonus = 0;
        
        let critThreshold = dieType - critRange;
        if (critThreshold < 1) critThreshold = 1;
        if (dieType <= 1) canCrit = false;
        
        let breakdownText = "";
        
        const modSign = modifier >= 0 ? "+" : "-";
        const absMod = Math.abs(modifier);

        const rollSingleDie = () => {
          let val = Math.floor(Math.random() * dieType) + 1;
          if (grip === "Double" && (val === 1 || val === 2)) {
            val = Math.floor(Math.random() * dieType) + 1;
          }
          return val;
        };

        if (advantageMode === 1 || advantageMode === -1) {
          let displayPairs = [];
          for (let i = 0; i < dieCount; i++) {
            let val1 = rollSingleDie();
            let val2 = rollSingleDie();
            let kept = advantageMode === 1 ? Math.max(val1, val2) : Math.min(val1, val2);
            rolls.push(kept);
            rollSum += kept;
            if (canCrit && kept >= critThreshold) hasCrit = true;
            displayPairs.push(`[${val1},${val2}->${kept}]`);

            // Update visuals
            const el1 = virtualDice[i * 2];
            const el2 = virtualDice[i * 2 + 1];
            el1.textContent = val1;
            el2.textContent = val2;

            if (kept === val1 && kept !== val2) {
              el2.classList.add("dropped-die");
            } else if (kept === val2 && kept !== val1) {
              el1.classList.add("dropped-die");
            } else {
               // they tied, drop the second one
               el2.classList.add("dropped-die");
            }
          }
          breakdownText = `Roll: ${displayPairs.join(" ")} ${modSign} ${absMod}`;
        } else if (advantageMode === 2 || advantageMode === -2) {
          let pool = [];
          for (let i = 0; i < dieCount + 1; i++) {
            pool.push({ val: rollSingleDie(), index: i });
          }
          pool.sort((a, b) => a.val - b.val);
          
          let droppedIndex = -1;
          let droppedVal = 0;
          if (advantageMode === 2) {
            let dropped = pool.shift();
            droppedIndex = dropped.index;
            droppedVal = dropped.val;
          } else {
            let dropped = pool.pop();
            droppedIndex = dropped.index;
            droppedVal = dropped.val;
          }
          
          pool.forEach(item => {
            rolls.push(item.val);
            rollSum += item.val;
            if (canCrit && item.val >= critThreshold) hasCrit = true;
          });

          // Restore original order for visuals
          let originalOrder = [];
          if (advantageMode === 2) {
            originalOrder = [ {val: droppedVal, index: droppedIndex}, ...pool ].sort((a,b) => a.index - b.index);
          } else {
            originalOrder = [ ...pool, {val: droppedVal, index: droppedIndex} ].sort((a,b) => a.index - b.index);
          }

          originalOrder.forEach((item, i) => {
            virtualDice[i].textContent = item.val;
            if (i === droppedIndex) {
              virtualDice[i].classList.add("dropped-die");
            }
          });
          
          breakdownText = `Roll: [${rolls.join(", ")}] (Dropped: ${droppedVal}) ${modSign} ${absMod}`;
        } else {
          for (let i = 0; i < dieCount; i++) {
            let val = rollSingleDie();
            rolls.push(val);
            rollSum += val;
            if (canCrit && val >= critThreshold) hasCrit = true;
            virtualDice[i].textContent = val;
          }
          breakdownText = `Roll: [${rolls.join(", ")}] ${modSign} ${absMod}`;
        }

        if (hasCrit) {
          criticalBonus = rollSingleDie();
          rollSum += criticalBonus;
          
          virtualDice.forEach(el => {
            if (!el.classList.contains("dropped-die")) {
              el.classList.add("crit-pulse");
            }
          });
          setTimeout(() => {
            virtualDice.forEach(el => el.classList.remove("crit-pulse"));
          }, 1000);
        }

        if (extraDice) {
          let extraSum = 0;
          let extraRolls = [];
          for (let i = 0; i < extraDice.count; i++) {
             let v = Math.floor(Math.random() * extraDice.type) + 1;
             extraRolls.push(v);
             extraSum += v;
             if (extraVirtualDice[i]) extraVirtualDice[i].textContent = v;
          }
          rollSum += extraSum;
          breakdownText += ` | + [${extraRolls.join(", ")}] ${extraDice.label || ""}`;
        }

        const totalResult = rollSum + modifier + extraModifier;

        // Render results
        dieElement.textContent = totalResult;
        totalElement.textContent = `Total: ${totalResult}`;
        
        if (hasCrit) {
          breakdownText += ` | CRIT! (+${criticalBonus})`;
        }
        
        if (extraBreakdown) {
          breakdownText += ` | ${extraBreakdown}`;
        }
        
        breakdownElement.textContent = breakdownText;

        // Save to state history
        if (!isPrivate) {
          window.BB_STATE.addDiceRoll(label, dieCount, dieType, modifier + extraModifier, totalResult, breakdownText);
          showToastNotification(`Rolled ${label}: ${totalResult} (${breakdownText})`);
        } else {
          showToastNotification(`[PRIVATE] Rolled ${label}: ${totalResult} (${breakdownText})`);
        }

        if (onComplete) onComplete(totalResult);
      } catch(e) { console.error("Cleanup timeout error:", e); }
    }, 800);
  }

  function addRollToHistory(message) {
    // Allows custom messages to be pushed to the dice history
    window.BB_STATE.addDiceRoll("Custom Action", 0, 0, 0, 0, message);
  }

  function showToastNotification(message) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast-message glass";
    toast.innerHTML = `
      <div class="toast-icon">❖</div>
      <div class="toast-text">${message}</div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }


  function rollMixed(label, diceList, modifier = 0) {
    init();

    const overlayTitle = document.getElementById("dice-roll-title");
    const container = document.querySelector(".dice-visual-container");
    const totalElement = document.getElementById("dice-roll-total");
    const breakdownElement = document.getElementById("dice-roll-breakdown");

    overlayTitle.textContent = `Rolling ${label}...`;
    totalElement.textContent = "Total: --";
    breakdownElement.textContent = "Rolling...";

    container.innerHTML = "";
    container.style.display = "flex";
    container.style.gap = "10px";
    container.style.flexWrap = "wrap";
    container.style.justifyContent = "center";

    const virtualDice = [];
    diceList.forEach(diceDef => {
      for (let i = 0; i < diceDef.count; i++) {
        const dieEl = document.createElement("div");
        dieEl.className = `virtual-die d${diceDef.type}-die rolling`;
        dieEl.style.width = "40px";
        dieEl.style.height = "40px";
        dieEl.style.fontSize = "1rem";
        dieEl.style.lineHeight = "40px";
        
        container.appendChild(dieEl);
        virtualDice.push({
          el: dieEl,
          type: diceDef.type,
          sign: diceDef.sign
        });
      }
    });

    diceOverlay.classList.add("active");

    let interval = setInterval(() => {
      virtualDice.forEach(d => {
        d.el.textContent = Math.floor(Math.random() * d.type) + 1;
      });
    }, 60);

    setTimeout(() => {
      clearInterval(interval);
      let rollSum = 0;
      let breakdownParts = [];

      virtualDice.forEach(d => {
        d.el.classList.remove("rolling");
        let val = Math.floor(Math.random() * d.type) + 1;
        d.el.textContent = val;
        let effectiveVal = val * d.sign;
        rollSum += effectiveVal;
        
        let signStr = d.sign < 0 ? "-" : "+";
        if (breakdownParts.length === 0 && d.sign > 0) signStr = ""; 
        breakdownParts.push(`${signStr}[d${d.type}: ${val}]`);
      });

      const totalResult = rollSum + modifier;
      
      const modSign = modifier >= 0 ? "+" : "-";
      const absMod = Math.abs(modifier);
      if (modifier !== 0) {
        breakdownParts.push(`${modSign} ${absMod}`);
      }

      const breakdownText = `Roll: ${breakdownParts.join(" ")}`;

      totalElement.textContent = `Total: ${totalResult}`;
      breakdownElement.textContent = breakdownText;

      window.BB_STATE.addDiceRoll(label, virtualDice.length, 0, modifier, totalResult, breakdownText);
      showToastNotification(`Rolled ${label}: ${totalResult} (${breakdownText})`);

    }, 800);
  }
  return {
    roll,
    rollMixed,
    addRollToHistory,
    showToastNotification
  };
})();
