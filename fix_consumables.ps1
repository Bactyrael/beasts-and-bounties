$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw

$items = @(
    "Blackpowder Bomb",
    "Flask of Acid",
    "Flask of Conflagrating",
    "Flask of Darkness",
    "Flask of Electrocuting",
    "Flask of Flooding",
    "Flask of Glaciating",
    "Flask of Quaking",
    "Flask of Radiance",
    "Flask of Rumbling",
    "Flask of Sorcery",
    "Flask of Squalling"
)

foreach ($item in $items) {
    # We look for the object that has this name and update its type and slot.
    # The regex needs to carefully replace type: "Adventuring Gear", slot: "Explosive" etc.
    # We can just match the name, and then replace type and slot in that line since they are defined on one line in MISC_ITEMS.
    # Typical line: { name: "Flask of Acid", ..., type: "Adventuring Gear", slot: "Flask" },
    $pattern = '(?i)(\{\s*name:\s*"' + $item + '".*?)type:\s*"[^"]*",\s*slot:\s*"[^"]*"(\s*\})'
    $replacement = '$1type: "Combat - Consumable", slot: "Consumable"$2'
    $c = [regex]::Replace($c, $pattern, $replacement)
}

Set-Content -Path $path -Value $c
