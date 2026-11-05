
param(
    [ValidateSet("Full", "PowerShell")]
    [string]$Mode = "PowerShell"
)

$ErrorActionPreference = "Stop"

$InstallRoot = Join-Path $env:LOCALAPPDATA "Modder"
$PackageRoot = Split-Path -Parent $PSScriptRoot

$ReleaseUrl = "https://github.com/zackdebono11-ux/Modder-Early-Access/releases/download/0.1.0/Modder-Full.zip"
$ExpectedHash = "1EFAE0C6344EA546D09698F62A299E508BA4B7FF702EA706D016FC390E2E5D88"

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "       JUNGLE MODDER" -ForegroundColor Green
Write-Host "       INSTALLER" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required. Install Node.js and run this installer again."
}

New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null

if ($Mode -eq "Full") {
    Write-Host "Downloading Modder Full v0.1.0..." -ForegroundColor Cyan

    $WorkRoot = Join-Path $env:TEMP ("Modder-Install-" + [guid]::NewGuid())
    $ZipPath = Join-Path $WorkRoot "Modder-Full.zip"
    $ExtractRoot = Join-Path $WorkRoot "Extracted"
    $PreserveRoot = Join-Path $WorkRoot "Preserved"

    New-Item -ItemType Directory -Force -Path $WorkRoot | Out-Null

    try {
        # Download the official GitHub release.
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

        Invoke-WebRequest `
            -Uri $ReleaseUrl `
            -OutFile $ZipPath `
            -UseBasicParsing

        # Verify the download before extracting it.
        $ActualHash = (Get-FileHash $ZipPath -Algorithm SHA256).Hash

        if ($ActualHash -ne $ExpectedHash) {
            throw "The downloaded archive failed SHA256 verification. Installation cancelled."
        }

        Write-Host "Download verified!" -ForegroundColor Green

        # Preserve existing user data before updating files.
        $ExistingMods = Join-Path $InstallRoot "backend\data\mods.json"
        $ExistingUploads = Join-Path $InstallRoot "backend\uploads"

        if (Test-Path $ExistingMods) {
            New-Item -ItemType Directory -Force -Path "$PreserveRoot\data" | Out-Null
            Copy-Item $ExistingMods "$PreserveRoot\data\mods.json" -Force
        }

        if (Test-Path $ExistingUploads) {
            New-Item -ItemType Directory -Force -Path $PreserveRoot | Out-Null
            Copy-Item $ExistingUploads "$PreserveRoot\uploads" -Recurse -Force
        }

        # Extract the release.
        Write-Host "Extracting Modder Full..." -ForegroundColor Cyan

        Expand-Archive -Path $ZipPath -DestinationPath $ExtractRoot -Force

        # Install the release files.
        Write-Host "Installing Modder files..." -ForegroundColor Cyan

        Copy-Item "$ExtractRoot\*" $InstallRoot -Recurse -Force

        # Restore existing user data.
        if (Test-Path "$PreserveRoot\data\mods.json") {
            Copy-Item "$PreserveRoot\data\mods.json" `
                "$InstallRoot\backend\data\mods.json" -Force
        }

        if (Test-Path "$PreserveRoot\uploads") {
            New-Item -ItemType Directory -Force `
                -Path "$InstallRoot\backend\uploads" | Out-Null

            Copy-Item "$PreserveRoot\uploads\*" `
                "$InstallRoot\backend\uploads" -Recurse -Force
        }

        # Set up the existing working CLI launcher.
        New-Item -ItemType Directory -Force `
            -Path "$InstallRoot\bin" | Out-Null

        # Install the current CLI and .modder format module.
        Copy-Item "$PackageRoot\bin\modder-cli.js" `
            "$InstallRoot\bin\modder-cli.js" -Force

        Copy-Item "$PackageRoot\bin\modder-format.js" `
            "$InstallRoot\bin\modder-format.js" -Force

        # Ensure Full mode has the ZIP dependency too.
        Copy-Item "$PackageRoot\backend\package.json" `
            "$InstallRoot\backend\package.json" -Force

        Copy-Item "$PackageRoot\backend\package-lock.json" `
            "$InstallRoot\backend\package-lock.json" -Force

        Copy-Item "$PackageRoot\bin\modder.js" `
            "$InstallRoot\bin\modder.js" -Force

        Write-Host "Modder Full files installed!" -ForegroundColor Green
    }
    finally {
        if (Test-Path $WorkRoot) {
            Remove-Item $WorkRoot -Recurse -Force
        }
    }
}
else {
    Write-Host "Installing Modder PowerShell support..." -ForegroundColor Cyan

    New-Item -ItemType Directory -Force -Path "$InstallRoot\bin" | Out-Null
    New-Item -ItemType Directory -Force -Path "$InstallRoot\backend\data" | Out-Null
    New-Item -ItemType Directory -Force -Path "$InstallRoot\backend\uploads\mods" | Out-Null
    New-Item -ItemType Directory -Force -Path "$InstallRoot\backend\uploads\screenshots" | Out-Null

    Copy-Item "$PackageRoot\bin\modder.js" "$InstallRoot\bin\modder.js" -Force
    Copy-Item "$PackageRoot\bin\modder-cli.js" "$InstallRoot\bin\modder-cli.js" -Force
    Copy-Item "$PackageRoot\bin\modder-format.js" "$InstallRoot\bin\modder-format.js" -Force

    Copy-Item "$PackageRoot\backend\server.js" "$InstallRoot\backend\server.js" -Force
    Copy-Item "$PackageRoot\backend\package.json" "$InstallRoot\backend\package.json" -Force
    Copy-Item "$PackageRoot\backend\package-lock.json" "$InstallRoot\backend\package-lock.json" -Force

    if (-not (Test-Path "$InstallRoot\backend\data\mods.json")) {
        Copy-Item "$PackageRoot\backend\data\mods.json" "$InstallRoot\backend\data\mods.json"
    }
}

# Install backend dependencies.
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan

Push-Location "$InstallRoot\backend"
try {
    npm.cmd ci --omit=dev

    if ($LASTEXITCODE -ne 0) {
        throw "Backend dependency installation failed."
    }
}
finally {
    Pop-Location
}

# Add the CLI folder to the user's PATH.
$BinPath = "$InstallRoot\bin"
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")

$PathEntries = @()
if ($UserPath) {
    $PathEntries = $UserPath -split ";" | Where-Object { $_ }
}

if ($PathEntries -notcontains $BinPath) {
    $NewPath = if ($UserPath) {
        "$UserPath;$BinPath"
    }
    else {
        $BinPath
    }

    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
}

if ($env:Path -notlike "*$BinPath*") {
    $env:Path += ";$BinPath"
}

Write-Host ""
Write-Host "Modder installation completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Installation folder: $InstallRoot"
Write-Host "CLI command: modder"
Write-Host "Restart PowerShell if necessary."
Write-Host ""
