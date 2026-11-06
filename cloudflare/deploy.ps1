$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
npx wrangler login
if ($LASTEXITCODE -ne 0) { throw 'Cloudflare login failed.' }
node scripts/prepare-cloud.mjs
if ($LASTEXITCODE -ne 0) { throw 'Cloud resource setup failed.' }
$adminSecurePassword = Read-Host 'Set dawnsea administrator password (10+ characters)' -AsSecureString
$adminPasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecurePassword)
try {
    $adminPlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminPasswordPointer)
    $adminPlainPassword | node scripts/admin-secret.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Administrator secret setup failed.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminPasswordPointer)
    $adminPlainPassword = $null
}
npm run deploy
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed.' }
Read-Host 'Deployment finished. Press Enter to close'
