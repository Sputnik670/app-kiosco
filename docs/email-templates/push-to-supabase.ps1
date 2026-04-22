<#
.SYNOPSIS
  Empuja los 6 templates de mail de KioscoApp a Supabase via Management API.

.DESCRIPTION
  Lee los 6 archivos HTML de este folder y los pushea a la config de Auth
  del proyecto. Tambien setea los 6 subjects en castellano.

.PARAMETER Token
  Personal Access Token de Supabase. Si no se pasa, lee $env:SUPABASE_PAT.

.PARAMETER ProjectRef
  Ref del proyecto. Default: vrgexonzlrdptrplqpri (App Kiosco prod).

.PARAMETER DryRun
  Si se pasa, solo hace GET y muestra los fields actuales sin modificar nada.

.EXAMPLE
  $env:SUPABASE_PAT = "sbp_xxxxxxxxxxxx"
  .\push-to-supabase.ps1

.EXAMPLE
  .\push-to-supabase.ps1 -Token "sbp_xxxxxxxxxxxx"

.EXAMPLE
  .\push-to-supabase.ps1 -DryRun
#>

param(
    [string]$Token = $env:SUPABASE_PAT,
    [string]$ProjectRef = "vrgexonzlrdptrplqpri",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# --- Validaciones ---

if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "ERROR: falta token." -ForegroundColor Red
    Write-Host "   Pasalo como -Token 'sbp_...' o seteando la env var SUPABASE_PAT." -ForegroundColor Yellow
    exit 1
}

if (-not $Token.StartsWith("sbp_")) {
    Write-Host "WARNING: el token no empieza con 'sbp_'. Es un Personal Access Token de Supabase?" -ForegroundColor Yellow
}

# --- Setup ---

# Force UTF-8 output in PowerShell 5.1 (console + default encoding).
# Sin esto, los caracteres con acentos/enies del payload pueden degradarse
# al serializar JSON en PS 5.1 (que usa Windows-1252 por default).
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$BaseUrl = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"
$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json; charset=utf-8"
}

function Read-TemplateFile {
    param([string]$FileName)
    $path = Join-Path $PSScriptRoot $FileName
    if (-not (Test-Path $path)) {
        throw "No encuentro el archivo: $path"
    }
    # [System.IO.File]::ReadAllText devuelve System.String puro.
    # Get-Content -Raw en PS 5.1 devuelve un PSObject envuelto que ConvertTo-Json
    # serializa como objeto en vez de string. Este metodo evita ese bug.
    return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

# --- Dry run ---

if ($DryRun) {
    Write-Host "DRY RUN - GET a $BaseUrl" -ForegroundColor Cyan
    try {
        $current = Invoke-RestMethod -Uri $BaseUrl -Headers $Headers -Method Get
    } catch {
        Write-Host "ERROR en GET:" -ForegroundColor Red
        Write-Host $_.Exception.Message
        exit 1
    }
    Write-Host ""
    Write-Host "Fields de mailer/subject actuales:" -ForegroundColor Cyan
    $current.PSObject.Properties |
      Where-Object { $_.Name -match "mailer|subject|smtp" } |
      Sort-Object Name |
      ForEach-Object {
        $val = $_.Value
        if ($null -eq $val) { $val = "<null>" }
        elseif ($val -is [string] -and $val.Length -gt 80) { $val = $val.Substring(0, 80) + "..." }
        "{0,-50} {1}" -f $_.Name, $val
      }
    Write-Host ""
    Write-Host "Dry run OK. Corre sin -DryRun para aplicar cambios." -ForegroundColor Green
    exit 0
}

# --- Payload ---

Write-Host "Leyendo 6 templates desde $PSScriptRoot ..." -ForegroundColor Cyan

# Subjects con acentos via [char] Unicode. Evita depender del encoding del .ps1:
# si el archivo se guarda como Windows-1252, un string literal con "á" llega
# corrupto al server. Construyendo con [char]0x00E1 garantiza que la letra
# tiene el code point Unicode correcto en memoria.
$subj_confirmation     = "Confirm{0} tu cuenta en KioscoApp" -f [char]0x00E1
$subj_recovery         = "Restablec{0} tu contrase{1}a de KioscoApp" -f [char]0x00E9, [char]0x00F1
$subj_invite           = "Te invitaron a unirte a un kiosco en KioscoApp"
$subj_magic_link       = "Tu enlace de acceso a KioscoApp"
$subj_email_change     = "Confirm{0} tu nueva direcci{1}n de mail" -f [char]0x00E1, [char]0x00F3
$subj_reauthentication = "Tu c{0}digo de verificaci{0}n de KioscoApp" -f [char]0x00F3

$payload = @{
    mailer_subjects_confirmation     = $subj_confirmation
    mailer_subjects_recovery         = $subj_recovery
    mailer_subjects_invite           = $subj_invite
    mailer_subjects_magic_link       = $subj_magic_link
    mailer_subjects_email_change     = $subj_email_change
    mailer_subjects_reauthentication = $subj_reauthentication

    mailer_templates_confirmation_content     = Read-TemplateFile "01-confirm-signup.html"
    mailer_templates_recovery_content         = Read-TemplateFile "02-reset-password.html"
    mailer_templates_invite_content           = Read-TemplateFile "03-invite-user.html"
    mailer_templates_magic_link_content       = Read-TemplateFile "04-magic-link.html"
    mailer_templates_email_change_content     = Read-TemplateFile "05-change-email.html"
    mailer_templates_reauthentication_content = Read-TemplateFile "06-reauthentication.html"
}

$jsonBody = $payload | ConvertTo-Json -Depth 3 -Compress

# Serializar el JSON a bytes UTF-8 explicitos. Sin esto, PS 5.1 manda el body
# como string y el server lo interpreta como Windows-1252, lo que rompe
# acentos y enies (llegan como "?" o caracteres basura en los mails).
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
$sizeKb = [Math]::Round($utf8Bytes.Length / 1024, 1)
Write-Host "Payload: 12 fields, $sizeKb KB (UTF-8)" -ForegroundColor Green

# --- PATCH ---

Write-Host ""
Write-Host "PATCH a $BaseUrl ..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri $BaseUrl -Headers $Headers -Method Patch -Body $utf8Bytes
    Write-Host "OK. Config de auth actualizada." -ForegroundColor Green
} catch {
    Write-Host "ERROR en PATCH:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message
    }
    exit 1
}

# --- Verificar subjects ---

Write-Host ""
Write-Host "Verificando subjects..." -ForegroundColor Cyan
try {
    $check = Invoke-RestMethod -Uri $BaseUrl -Headers $Headers -Method Get
    $expected = @{
        "mailer_subjects_confirmation"     = $subj_confirmation
        "mailer_subjects_recovery"         = $subj_recovery
        "mailer_subjects_invite"           = $subj_invite
        "mailer_subjects_magic_link"       = $subj_magic_link
        "mailer_subjects_email_change"     = $subj_email_change
        "mailer_subjects_reauthentication" = $subj_reauthentication
    }
    $allOk = $true
    foreach ($key in $expected.Keys) {
        $actual = $check.$key
        $want   = $expected[$key]
        if ($actual -eq $want) {
            Write-Host ("  OK  {0,-40} = {1}" -f $key, $actual) -ForegroundColor Green
        } else {
            Write-Host ("  X   {0,-40} tengo: {1}" -f $key, $actual) -ForegroundColor Red
            $allOk = $false
        }
    }
    Write-Host ""
    if ($allOk) {
        Write-Host "TODO OK. Proba mandandote un signup real desde la app." -ForegroundColor Green
        Write-Host "  Dashboard: https://supabase.com/dashboard/project/$ProjectRef/auth/templates" -ForegroundColor Gray
    } else {
        Write-Host "Algunos fields no matchean. Revisa la API." -ForegroundColor Yellow
    }
} catch {
    Write-Host "ERROR en verificacion:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host ""
Write-Host "RECORDATORIO: revoca el token en https://supabase.com/dashboard/account/tokens" -ForegroundColor Yellow
