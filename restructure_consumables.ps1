$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw

# 1. Flip Food and Drink
$c = [regex]::Replace($c, '(?i)type:\s*"Consumable",\s*slot:\s*"Food"', 'type: "Food", slot: "Consumable"')
$c = [regex]::Replace($c, '(?i)type:\s*"Consumable",\s*slot:\s*"Drink"', 'type: "Drink", slot: "Consumable"')

# 2. Fix Potions (were previously Combat - Consumable or Consumable)
# They might not have a slot right now because we removed slot: "Consumable" earlier!
# So we look for names starting with "Potion" or containing "Potion"
$c = [regex]::Replace($c, '(?i)(name:\s*"[^"]*Potion[^"]*",.*?)type:\s*"(Combat - Consumable|Consumable)"', '$1type: "Potion", slot: "Consumable"')

# 3. Fix Vials
$c = [regex]::Replace($c, '(?i)(name:\s*"[^"]*Vial[^"]*",.*?)type:\s*"(Combat - Consumable|Consumable)"', '$1type: "Vial", slot: "Consumable"')

# 4. Fix Flasks
$c = [regex]::Replace($c, '(?i)(name:\s*"[^"]*Flask[^"]*",.*?)type:\s*"(Combat - Consumable|Consumable)"', '$1type: "Flask", slot: "Consumable"')

# 5. Fix Bombs
$c = [regex]::Replace($c, '(?i)(name:\s*"[^"]*Bomb[^"]*",.*?)type:\s*"(Combat - Consumable|Consumable)"', '$1type: "Explosive", slot: "Consumable"')

# 6. Any remaining Consumables like Phoenix Down or Basic Poison
$c = [regex]::Replace($c, '(?i)(name:\s*"Phoenix Down",.*?)type:\s*"Consumable"', '$1type: "Medical", slot: "Consumable"')
$c = [regex]::Replace($c, '(?i)(name:\s*"Basic Poison.*?",.*?)type:\s*"Consumable"', '$1type: "Poison", slot: "Consumable"')

Set-Content -Path $path -Value $c
