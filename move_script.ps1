$content = Get-Content 'js\character-sheet.js' -Raw

# We know exactly where the block starts and ends.
# It starts at:           <!-- Right side: Combat Stats -->
# It ends at the </div> right before:         </div>\r\n      `;\r\n    } \r\n    \r\n    else if (activeTab === "equipment")

$patternSkills = '(?s)          <!-- Right side: Combat Stats -->.*?          </div>\r?\n        </div>\r?\n      `;\r?\n    \} \r?\n    \r?\n    else if \(activeTab === "equipment"\)'
$replaceSkills = "        </div>`r`n      `;`r`n    } `r`n    `r`n    else if (activeTab === `"equipment`")"

# We can first extract the block using regex matches:
if ($content -match '(?s)(          <!-- Right side: Combat Stats -->.*?          </div>\r?\n)        </div>\r?\n      `;\r?\n    \} \r?\n    \r?\n    else if \(activeTab === "equipment"\)') {
    $combatStatsBlock = $matches[1]

    # Now remove it from skills tab
    $content = $content -replace $patternSkills, $replaceSkills

    # Now insert it into spells tab
    # Find spells tab return statement
    $patternSpells = '(?s)      return `\r?\n        <div class="spells-tab-view".*?          </div>\r?\n        </div>\r?\n      `;\r?\n    \} \r?\n    \r?\n    else if \(activeTab === "talents"\)'

    if ($content -match '(?s)(      return `\r?\n)(        <div class="spells-tab-view".*?          </div>\r?\n        </div>\r?\n)(      `;\r?\n    \} \r?\n    \r?\n    else if \(activeTab === "talents"\))') {
        
        $spellsPrefix = $matches[1]
        $spellsInner = $matches[2]
        $spellsSuffix = $matches[3]

        # We wrap spellsInner in a flex container, and append the combatStatsBlock
        $newSpellsBlock = $spellsPrefix + "        <div style=`"display:flex; gap:20px; justify-content:center; align-items:flex-start;`">`r`n          <div style=`"flex:1; max-width:500px;`">`r`n" + $spellsInner + "          </div>`r`n" + $combatStatsBlock + "        </div>`r`n" + $spellsSuffix

        $content = $content -replace '(?s)      return `\r?\n        <div class="spells-tab-view".*?          </div>\r?\n        </div>\r?\n      `;\r?\n    \} \r?\n    \r?\n    else if \(activeTab === "talents"\)', $newSpellsBlock

        Set-Content -Path 'js\character-sheet.js' -Value $content -Encoding UTF8
        Write-Host "Success!"
    } else {
        Write-Host "Could not match spells block!"
    }

} else {
    Write-Host "Could not match skills block!"
}
