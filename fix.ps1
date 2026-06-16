$lines = Get-Content js/data.js -Encoding UTF8
$newLines = $lines[0..2346] + $lines[2663..($lines.Length-1)]
$newLines | Set-Content js/data.js -Encoding UTF8
