$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$rawDir = Join-Path $root 'geographie\assets\raw'
$optimizedDir = Join-Path $root 'geographie\assets\optimized'

New-Item -ItemType Directory -Path $rawDir -Force | Out-Null
New-Item -ItemType Directory -Path $optimizedDir -Force | Out-Null

$franceUrl = 'https://upload.wikimedia.org/wikipedia/commons/5/52/Departements_de_France_map.svg'
$worldUrl = 'https://upload.wikimedia.org/wikipedia/commons/d/d9/7_continents_map%2C_dark_mode.svg'
$geojsonUrl = 'https://france-geojson.gregoiredavid.fr/repo/departements.geojson'

$franceRaw = Join-Path $rawDir 'france-departements.svg'
$worldRaw = Join-Path $rawDir 'world-continents.svg'
$geojsonRaw = Join-Path $rawDir 'departements.geojson'

Invoke-WebRequest -Uri $franceUrl -OutFile $franceRaw
Invoke-WebRequest -Uri $worldUrl -OutFile $worldRaw
Invoke-WebRequest -Uri $geojsonUrl -OutFile $geojsonRaw

Write-Host 'SVG bruts telecharges.'

node (Join-Path $PSScriptRoot 'normalize-geography-maps.js')

Write-Host "France  : $((Get-Item (Join-Path $optimizedDir 'france-departements.svg')).Length) octets"
Write-Host "Monde   : $((Get-Item (Join-Path $optimizedDir 'world-continents.svg')).Length) octets"
Write-Host 'Import geographie termine.'
