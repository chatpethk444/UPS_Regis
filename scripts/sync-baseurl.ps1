# sync-baseurl: อ่าน URL จาก tunnel log แล้ว patch api.js (เรียกเดี่ยวก็ได้)
param([string]$Url = "")
. (Join-Path $PSScriptRoot "common.ps1")

if (-not $Url) { $Url = Get-TunnelUrl }
if (-not $Url) {
  Write-Output "ไม่เจอ URL ใน $TunnelLog (tunnel อาจยังไม่ติด)"
  exit 1
}

$text = Get-Content -LiteralPath $ApiJs -Raw
# แทนเฉพาะบรรทัดจริง (ขึ้นต้นบรรทัด) ไม่แตะบรรทัด comment
$new = $text -replace '(?m)^export const BASE_URL = ".*?";', "export const BASE_URL = `"$Url`";"
if ($new -eq $text) {
  Write-Output "api.js ตรงอยู่แล้ว ($Url)"
} else {
  Set-Content -LiteralPath $ApiJs -Value $new -NoNewline
  Write-Output "api.js -> $Url"
}

