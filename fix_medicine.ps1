$path = 'C:\Users\rcmil\.gemini\antigravity\scratch\beasts-and-bounties\js\data.js'
$c = Get-Content $path -Raw

# Replace type: "Vial" with type: "Medicine" for "Vial of..." and "Antitoxin"
$c = [regex]::Replace($c, '(?i)(name:\s*"(?:Vial of [^"]+|Antitoxin)",.*?)type:\s*"Vial"', '$1type: "Medicine"')

Set-Content -Path $path -Value $c
