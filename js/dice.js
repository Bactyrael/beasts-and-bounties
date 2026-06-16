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

  function roll(label, dieCount, dieType, modifier = 0, advantageMode = 0, critRange = 0, canCrit = true, grip = "", extraModifier = 0, extraBreakdown = "", isPrivate = false, onComplete = null) {
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
    const dieElement = document.getElementById("virtual-die-element");
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

    // Configure dice shape based on die type
    dieElement.className = "virtual-die";
    if (dieType === 20) dieElement.classList.add("d20-die");
    else if (dieType === 6) dieElement.classList.add("d6-die");
    else if (dieType === 10) dieElement.classList.add("d10-die");
    else if (dieType === 8) dieElement.classList.add("d8-die");
    else if (dieType === 4) dieElement.classList.add("d4-die");
    else dieElement.classList.add("d20-die"); // fallback

    // Show overlay
    diceOverlay.classList.add("active");

    // Animation
    dieElement.classList.add("rolling");
    
    let iterations = 10;
    let interval = setInterval(() => {
      // Show random numbers while rolling
      dieElement.textContent = Math.floor(Math.random() * dieType) + 1;
    }, 60);

    setTimeout(() => {
      clearInterval(interval);
      dieElement.classList.remove("rolling");

      let inspDieResult = 0;
      if (char && char.useInspiration && char.inspirationDie) {
        let inspDieType = parseInt(char.inspirationDie.replace("d", ""));
        if (inspDieType) {
          inspDieResult = Math.floor(Math.random() * inspDieType) + 1;
          extraModifier += inspDieResult;
          extraBreakdown += (extraBreakdown ? " | " : "") + `Inspiration (${char.inspirationDie}): +${inspDieResult}`;
          
          char.inspirationDie = "";
          char.useInspiration = false;
          window.BB_STATE.saveCharacter(char);
          if (window.BB_APP && window.BB_APP.renderActiveTab) {
             window.BB_APP.renderActiveTab();
          }
        }
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
        }
        breakdownText = `Roll: ${displayPairs.join(" ")} ${modSign} ${absMod}`;
      } else if (advantageMode === 2 || advantageMode === -2) {
        let pool = [];
        for (let i = 0; i < dieCount + 1; i++) {
          pool.push(rollSingleDie());
        }
        pool.sort((a, b) => a - b);
        let dropped = 0;
        if (advantageMode === 2) {
          dropped = pool.shift();
        } else {
          dropped = pool.pop();
        }
        
        pool.forEach(val => {
          rolls.push(val);
          rollSum += val;
          if (canCrit && val >= critThreshold) hasCrit = true;
        });
        
        breakdownText = `Roll: [${rolls.join(", ")}] (Dropped: ${dropped}) ${modSign} ${absMod}`;
      } else {
        for (let i = 0; i < dieCount; i++) {
          let val = rollSingleDie();
          rolls.push(val);
          rollSum += val;
          if (canCrit && val >= critThreshold) hasCrit = true;
        }
        breakdownText = `Roll: [${rolls.join(", ")}] ${modSign} ${absMod}`;
      }

      if (hasCrit) {
        criticalBonus = rollSingleDie();
        rollSum += criticalBonus;
        dieElement.classList.add("crit-pulse");
        setTimeout(() => dieElement.classList.remove("crit-pulse"), 1000);
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

  return {
    roll,
    addRollToHistory,
    showToastNotification
  };
})();
