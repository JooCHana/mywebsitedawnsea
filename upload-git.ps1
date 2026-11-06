param(
    [string]$Message = '',
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
# Git emits UTF-8 paths. Match that encoding in Windows PowerShell 5.1 too.
$gitUtf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $gitUtf8
$OutputEncoding = $gitUtf8
Set-Location -LiteralPath $PSScriptRoot
function Invoke-Git {
    param([string[]]$GitArgs)
    & git @GitArgs
    if ($LASTEXITCODE -ne 0) { throw ('Git failed: ' + ($GitArgs -join ' ')) }
}
# Restrict both repository and destination. Never force-push or rewrite history.
# An empty prefix means this directory itself is the worktree root.
# This avoids decoding/comparing absolute Chinese paths from Git output.
$repoPrefix = @(& git rev-parse --show-prefix)
if ($LASTEXITCODE -ne 0) { throw 'This folder is not a Git repository.' }
if (-not [string]::IsNullOrWhiteSpace(($repoPrefix -join ''))) { throw 'Run this script from the repository root.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git'))) { throw 'Repository metadata is missing from this folder.' }
$remote = (& git remote get-url origin)
if ($remote -notin @('https://github.com/JooCHana/mywebsitedawnsea.git','git@github.com:JooCHana/mywebsitedawnsea.git')) { throw 'Unexpected origin. Review this script before changing the destination.' }
$branch = (& git branch --show-current)
if ($branch -ne 'main') { throw 'Switch to main before using this uploader.' }

# Only current source and the documented root files can be added.
$rootFiles = @('README.md','.gitignore','upload-git.ps1','上传到GitHub.cmd')
$legacyFiles = @('server','创建管理员.cmd','启动网站.cmd','使用说明.txt','diary.html','essays.html','index.html','login.html','observations.html','register.html','script.js','server.log','start_site.py','style.css','dawnsea-cloudflare.zip')
function Test-SourcePath([string]$Name) {
    if ($Name -match '(^|/)(node_modules|private|\.wrangler|dist|\.git|\.venv|__pycache__)(/|$)' -or $Name -match '(^|/)\.env' -or $Name -match '(^|/)\.dev\.vars' -or $Name -match '\.(log|sqlite3|db)$') { return $false }
    return $Name.StartsWith('cloudflare/') -or $Name -in $rootFiles
}
# Reject unexpected additions/modifications already staged by the user.
$staged = @(& git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMRT)
foreach ($name in $staged) { if ($name -and -not (Test-SourcePath $name)) { throw "Unexpected staged file: $name. Review the Git staging area first." } }
$tracked = @(& git -c core.quotepath=false ls-files cloudflare)
foreach ($name in $tracked) { if ($name -and -not (Test-SourcePath $name)) { throw "Private/runtime file already tracked: $name. Remove it from the Git index before uploading." } }
Write-Host "Repository: $remote"
Write-Host "Branch: $branch"
Invoke-Git -GitArgs @('-c','core.quotepath=false','status','--short')
if ($CheckOnly) { Write-Host 'CHECK PASSED. No commit or push performed.'; exit 0 }

# Require the remote branch to be an ancestor: no automatic merge of user edits.
Invoke-Git -GitArgs @('fetch','origin','main')
& git merge-base --is-ancestor origin/main HEAD
if ($LASTEXITCODE -ne 0) { throw 'Remote main has commits missing locally. Pull/merge and resolve conflicts before retrying; nothing was overwritten.' }
Push-Location -LiteralPath (Join-Path $PSScriptRoot 'cloudflare')
try {
    # Reproduce the checked-in dependency lock on each upload.
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) { throw 'Syntax check failed.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed. Upload stopped.' }
} finally { Pop-Location }
Invoke-Git -GitArgs (@('add','--all','--','cloudflare') + $rootFiles)
# Record removal of archived, previously tracked files without adding the archive.
foreach ($name in $legacyFiles) {
    $known = @(& git ls-files -- $name)
    if ($known.Count -gt 0 -and $known[0]) { Invoke-Git -GitArgs @('add','--update','--',$name) }
}
$added = @(& git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMRT)
foreach ($name in $added) { if ($name -and -not (Test-SourcePath $name)) { throw "Blocked staged file: $name" } }
& git diff --cached --quiet
$diffCode = $LASTEXITCODE
if ($diffCode -eq 1) {
    if ([string]::IsNullOrWhiteSpace($Message)) { $Message = 'Update dawnsea website ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') }
    Invoke-Git -GitArgs @('commit','-m',$Message)
} elseif ($diffCode -ne 0) { throw 'Could not inspect staged changes.' }
Invoke-Git -GitArgs @('push','origin','main')
Write-Host 'GitHub upload succeeded.' -ForegroundColor Green
Write-Host 'Cloudflare updates automatically ONLY if dawnsea > Settings > Builds is connected to this repository, branch main, root cloudflare.'
