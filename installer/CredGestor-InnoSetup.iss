; ============================================================
;  CredGestor — Instalador Profissional Windows
;  Script Inno Setup 6.x
;  Autor: Carlos Antonio de Oliveira Piquet
;  Plataforma: Windows x64 APENAS
;  v6.0.1 — Offline local + canal update-ready
; ============================================================

#define MyAppName      "CredGestor"
#define MyAppVersion   "6.0.1"
#define MyAppPublisher "Carlos Antonio de Oliveira Piquet"
#define MyAppURL       ""
#define MyAppExeName   "CredGestor.exe"
#define MyAppId        "{{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}"
#define SourceDir      "..\dist\win-unpacked"

; ── Configurações gerais ─────────────────────────────────────────────────────
[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}

; [CORREÇÃO CRÍTICA] Admin obrigatório para instalar em Program Files.
; PrivilegesRequired=lowest + {autopf} é inválido no Windows 10+.
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline

; [SEGURANÇA/COMPAT] Electron atual requer Windows 10+ 64-bit.
MinVersion=10.0.17763

; [ARQUITETURA] Somente 64-bit — ConsistentWith com o binário Electron x64
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

; Diretório padrão em Program Files (x64)
DefaultDirName={autopf}\CredGestor
DefaultGroupName={#MyAppName}
AllowNoIcons=yes

; Saída
OutputDir=..\dist
OutputBaseFilename=CredGestor-InnoSetup-{#MyAppVersion}
SetupIconFile=..\assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

; Compressão máxima LZMA2
Compression=lzma2/ultra64
SolidCompression=yes

; UI moderna
WizardStyle=modern
WizardSizePercent=120
DisableProgramGroupPage=no
ShowLanguageDialog=no
LanguageDetectionMethod=none

; ── Informações de versão (aparece em Propriedades do instalador) ─────────────
AppCopyright=Copyright © 2026 {#MyAppPublisher}
VersionInfoVersion={#MyAppVersion}.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} — Sistema Profissional de Gestão de Crédito para Windows
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoTextVersion={#MyAppVersion}

; ── Idioma ───────────────────────────────────────────────────────────────────
[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

; ── Tarefas opcionais ─────────────────────────────────────────────────────────
[Tasks]
Name: "desktopicon";   Description: "Criar ícone na &Área de Trabalho";  GroupDescription: "Atalhos:"
Name: "startmenuicon"; Description: "Criar ícone no Menu &Iniciar";       GroupDescription: "Atalhos:"

; ── Arquivos a instalar ───────────────────────────────────────────────────────
[Files]
; Todos os arquivos do diretório win-unpacked (Electron + recursos embarcados)
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Ícone explícito para os atalhos
Source: "..\assets\icon.ico"; DestDir: "{app}\assets"; Flags: ignoreversion

; ── Ícones / Atalhos ──────────────────────────────────────────────────────────
[Icons]
; Menu Iniciar
Name: "{group}\{#MyAppName}";             Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\icon.ico"; Comment: "Sistema de Gestão de Crédito"; Tasks: startmenuicon
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}";                                                  Tasks: startmenuicon

; Área de Trabalho
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\icon.ico"; Comment: "Sistema de Gestão de Crédito"; Tasks: desktopicon

; ── Registro do Windows ───────────────────────────────────────────────────────
[Registry]
; [CORREÇÃO] Usando HKLM (consistente com PrivilegesRequired=admin)
; Registra o app para aparecer em "Programas e Recursos" com informações completas
Root: HKLM; Subkey: "Software\CredGestor\{#MyAppName}"; ValueType: string; ValueName: "Version";     ValueData: "{#MyAppVersion}"; Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\CredGestor\{#MyAppName}"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}";           Flags: uninsdeletekey
Root: HKLM; Subkey: "Software\CredGestor\{#MyAppName}"; ValueType: string; ValueName: "Publisher";   ValueData: "{#MyAppPublisher}"; Flags: uninsdeletekey

; ── Execução após instalação ──────────────────────────────────────────────────
[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar {#MyAppName} agora"; Flags: nowait postinstall skipifsilent shellexec

; ── Limpeza na desinstalação ──────────────────────────────────────────────────
[UninstallDelete]
; Remove logs e dados temporários gerados pelo app (NÃO remove %APPDATA% com dados do usuário)
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\resources\backend\data"

; ── Mensagens personalizadas ──────────────────────────────────────────────────
[Messages]
BeveledLabel=CredGestor v{#MyAppVersion} — Offline Local

; ── Código Pascal — Verificações avançadas ────────────────────────────────────
[Code]

// ── Verifica pré-requisitos do sistema ──
function InitializeSetup(): Boolean;
var
  OldVersion: String;
begin
  // [SEGURANÇA] Bloqueia instalação em Windows 32-bit.
  // O binário Electron foi compilado para x64 e não funciona em x86.
  if not IsWin64 then
  begin
    MsgBox(
      'CredGestor requer Windows 64-bit (x64).' + #13#10 +
      'Seu sistema operacional é 32-bit e não é compatível.',
      mbCriticalError, MB_OK
    );
    Result := False;
    Exit;
  end;

  Result := True;

  // Verifica e avisa sobre versão anterior instalada
  if RegQueryStringValue(HKLM, 'Software\CredGestor\{#MyAppName}', 'Version', OldVersion) then
  begin
    if OldVersion <> '{#MyAppVersion}' then
    begin
      if MsgBox(
        'Uma versão anterior (' + OldVersion + ') do CredGestor foi detectada.' + #13#10 +
        'Deseja prosseguir com a atualização para a versão {#MyAppVersion}?' + #13#10 + #13#10 +
        'NOVIDADES v6.0.1:' + #13#10 +
        '• Caixa centralizado em ledger transacional' + #13#10 +
        '• Pagamentos atualizam contrato, caixa, transação e score no backend' + #13#10 +
        '• Lista de Bloqueados com persistência de motivo' + #13#10 +
        '• Canal NSIS/GitHub Releases para atualizações remotas' + #13#10 +
        '• Build limpo sem resíduos de versões anteriores' + #13#10 + #13#10 +
        'Seus dados serão preservados em:' + #13#10 +
        '%APPDATA%\CredGestor\',
        mbConfirmation, MB_YESNO
      ) = IDNO then
      begin
        Result := False;
      end;
    end;
  end;
end;

// ── Encerra instâncias abertas antes de instalar (evita erro EBUSY) ──
procedure CloseRunningInstances();
var
  ResultCode: Integer;
begin
  Exec(
    ExpandConstant('{sys}\taskkill.exe'),
    '/F /IM "CredGestor.exe" /T',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode
  );
  // Aguarda processos encerrarem completamente
  Sleep(1500);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
    CloseRunningInstances();
end;

// ── Remove instâncias abertas antes de desinstalar ──
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec(
      ExpandConstant('{sys}\taskkill.exe'),
      '/F /IM "CredGestor.exe" /T',
      '', SW_HIDE, ewWaitUntilTerminated, ResultCode
    );
    Sleep(1000);
  end;
end;
