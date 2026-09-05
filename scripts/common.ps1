# จุดรวม: โฟลเดอร์ชั่วคราว + port + ชื่อไฟล์ (แก้ที่นี่ที่เดียว)
$RuntimeDir = Join-Path $env:TEMP "ups-regis"
$BackendLog = Join-Path $RuntimeDir "backend.log"
$TunnelLog  = Join-Path $RuntimeDir "tunnel.log"
$BackendPid = Join-Path $RuntimeDir "backend.pid"
$TunnelPid  = Join-Path $RuntimeDir "tunnel.pid"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ApiJs = Join-Path $ProjectRoot "api.js"
$Cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"

function Ensure-RuntimeDir {
  if (-not (Test-Path -LiteralPath $RuntimeDir)) {
    New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
  }
}

function Get-BackendPid {
  $c = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.OwningProcess } else { return $null }
}

function Get-TunnelUrl {
  if (-not (Test-Path -LiteralPath $TunnelLog)) { return $null }
  $m = Select-String -LiteralPath $TunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches |
    Select-Object -Last 1
  if ($m) { return $m.Matches.Value } else { return $null }
}

function Test-TunnelAlive {
  $p = Get-Process cloudflared -ErrorAction SilentlyContinue
  return ($null -ne $p)
}

