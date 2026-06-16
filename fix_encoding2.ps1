$content = Get-Content 'js\character-sheet.js' -Raw -Encoding UTF8

$content = $content -replace 'ðŸ”“', '🔓'
$content = $content -replace 'ðŸ”’', '🔒'
$content = $content -replace 'â–¼', '▼'

Set-Content -Path 'js\character-sheet.js' -Value $content -Encoding UTF8
Write-Host "Success"
