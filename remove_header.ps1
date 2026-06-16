$content = Get-Content 'js\character-sheet.js' -Raw
$content = $content -replace '(?s)\s*<!-- Sheet Top Header Bar -->.*?<!-- Sheet Three-Column Grid -->', "`n        <!-- Sheet Three-Column Grid -->"
$content | Set-Content 'js\character-sheet.js' -Encoding UTF8
