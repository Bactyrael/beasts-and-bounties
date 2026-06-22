const char = {
  level: 10,
  trackers: { "Intervention Uses": 0 }
};

const t = {
  name: "Intervention Uses",
  type: "number",
  maxCalc: "1",
  shortRestRecover: "level >= 10 ? 'all' : null"
};

// Simulated extraction
let maxVal = 0;
const expression = t.maxCalc.replace(/level/g, char.level);
maxVal = eval(expression);

let srr = t.shortRestRecover;
if (srr && srr.includes && srr.includes("char.level")) {
  try {
    srr = eval(srr);
  } catch(e) {}
}

const trackerDef = {
  name: t.name,
  type: t.type,
  max: maxVal,
  shortRestRecover: srr
};

console.log("Tracker Def:", trackerDef);

// Simulated recovery
let srrStr = String(trackerDef.shortRestRecover).toLowerCase();
console.log("Initial srrStr:", srrStr);

let amount = 0;
if (srrStr.includes("level")) {
  try {
    let replaced = srrStr.replace(/level/g, char.level);
    console.log("Replaced string for eval:", replaced);
    let evalRes = eval(replaced);
    console.log("evalRes:", evalRes);
    if (!evalRes) {
      console.log("evalRes was falsy. returning.");
      // return; -> simulated
    } else {
      srrStr = String(evalRes).toLowerCase();
      console.log("New srrStr:", srrStr);
    }
  } catch(e) {
    console.log("Eval error:", e);
  }
}

if (srrStr === "half_up") {
  amount = Math.ceil(trackerDef.max / 2);
} else if (srrStr === "half_down") {
  amount = Math.floor(trackerDef.max / 2);
} else if (srrStr === "full" || srrStr === "all") {
  amount = trackerDef.max;
} else if (srrStr === "one") {
  amount = 1;
} else {
  amount = parseInt(srrStr) || 0;
}

console.log("Final Amount:", amount);
char.trackers[trackerDef.name] = Math.min(trackerDef.max, (char.trackers[trackerDef.name] || 0) + amount);
console.log("Final Trackers:", char.trackers);
