# stop-all: หยุด backend + tunnel ที่สคริปต์นี้สตาร์ทไว้
. (Join-Path $PSScriptRoot "common.ps1")

foreach ($pf in @($BackendPid, $TunnelPid)) {
  if (Test-Path -LiteralPath $pf) {
    $pid = (Get-Content -LiteralPath $pf).Trim()
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $pf -Force -ErrorAction SilentlyContinue
    Write-Output "หยุด PID $pid แล้ว"
  }
}
Write-Output "เสร็จ (ถ้า backend รันใน terminal ของคุณเอง ต้อง Ctrl+C เอง)"

