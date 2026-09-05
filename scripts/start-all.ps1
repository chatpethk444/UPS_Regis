# start-all: backend + tunnel รันเบื้องหลัง (ปิด terminal ได้) + sync BASE_URL อัตโนมัติ
# ใช้: คลิกขวา -> Run with PowerShell (ครั้งเดียวหลังเปิดคอม)
. (Join-Path $PSScriptRoot "common.ps1")
Ensure-RuntimeDir

# 1. Backend: ถ้า port 8000 มีคนฟังอยู่แล้ว ใช้ต่อเลย ไม่สตาร์ทซ้ำ
$bp = Get-BackendPid
if ($bp) {
  Write-Output "backend: ใช้ตัวที่รันอยู่แล้ว (PID $bp)"
} else {
  $BackendDir = Join-Path $ProjectRoot "backend"
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = "cmd /c cd /d `"$BackendDir`" && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > `"$BackendLog`" 2>&1"
  }
  Set-Content -LiteralPath $BackendPid -Value $r.ProcessId
  Write-Output "backend: สตาร์ทแล้ว (PID $($r.ProcessId)) รอ 10 วิ..."
  Start-Sleep -Seconds 10
}

# 2. Tunnel: ถ้า cloudflared รันอยู่ + มี URL ใช้ต่อเลย ไม่งั้นสตาร์ทใหม่
$url = $null
if ((Test-TunnelAlive) -and (Get-TunnelUrl)) {
  $url = Get-TunnelUrl
  Write-Output "tunnel: ใช้ตัวที่รันอยู่แล้ว"
} else {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = "`"$Cloudflared`" tunnel --url http://localhost:8000 --logfile `"$TunnelLog`""
  }
  Set-Content -LiteralPath $TunnelPid -Value $r.ProcessId
  Write-Output "tunnel: สตาร์ทแล้ว (PID $($r.ProcessId)) รอ URL 20 วิ..."
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    $url = Get-TunnelUrl
    if ($url) { break }
  }
}

if (-not $url) {
  Write-Output "tunnel: ยังไม่ได้ URL ดู log ที่ $TunnelLog"
  exit 1
}

# 3. Patch api.js
& (Join-Path $PSScriptRoot "sync-baseurl.ps1") -Url $url

Write-Output ""
Write-Output "URL: $url"
Write-Output "เสร็จ. ปิดหน้านี้ได้เลย แล้วไปกด r ใน Expo เพื่อ reload"

