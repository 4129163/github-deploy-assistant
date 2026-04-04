@echo off
REM GADA Windows Service Installation Batch File
REM Version: 1.0.0

echo.
echo ========================================================
echo  GitHub Deploy Assistant (GADA) Windows Service Manager
echo ========================================================
echo.

REM 检查是否以管理员身份运行
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires administrator privileges.
    echo Please run Command Prompt as Administrator.
    echo.
    pause
    exit /b 1
)

REM 设置脚本目录
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

REM 显示帮助信息
if "%~1"=="" (
    goto show_help
)
if "%~1"=="/?" (
    goto show_help
)
if /i "%~1"=="help" (
    goto show_help
)

REM 解析参数
set ACTION=install
set SERVICE_NAME=GADA
set DISPLAY_NAME=GitHub Deploy Assistant

:parse_args
if "%~1"=="" goto run_script
if /i "%~1"=="uninstall" set ACTION=uninstall
if /i "%~1"=="start" set ACTION=start
if /i "%~1"=="stop" set ACTION=stop
if /i "%~1"=="restart" set ACTION=restart
if /i "%~1"=="status" set ACTION=status
if /i "%~1"=="-name" (
    set SERVICE_NAME=%~2
    shift
)
if /i "%~1"=="-display" (
    set DISPLAY_NAME=%~2
    shift
)
shift
goto parse_args

:show_help
echo Usage: install-windows-service.bat [options] [action]
echo.
echo Actions:
echo   install      Install GADA as a Windows service (default)
echo   uninstall    Uninstall the service
echo   start        Start the service
echo   stop         Stop the service
echo   restart      Restart the service
echo   status       Show service status
echo.
echo Options:
echo   -name <name>       Service name (default: GADA)
echo   -display <name>    Service display name
echo.
echo Examples:
echo   install-windows-service.bat
echo   install-windows-service.bat uninstall
echo   install-windows-service.bat -name "MyGADA" install
echo   install-windows-service.bat status
echo.
pause
exit /b 0

:run_script
echo.
echo Service Name: %SERVICE_NAME%
echo Display Name: %DISPLAY_NAME%
echo Action: %ACTION%
echo.

REM 检查PowerShell执行策略
powershell -Command "Get-ExecutionPolicy" | findstr "Restricted" >nul
if %errorLevel% equ 0 (
    echo.
    echo WARNING: PowerShell execution policy is Restricted.
    echo Attempting to set execution policy temporarily...
    powershell -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force"
)

echo Running PowerShell script...
echo.

REM 构建PowerShell命令
set PS_COMMAND=.\install-windows-service.ps1 -ServiceName "%SERVICE_NAME%" -DisplayName "%DISPLAY_NAME%"

if "%ACTION%"=="uninstall" (
    set PS_COMMAND=%PS_COMMAND% -Uninstall
) else if "%ACTION%"=="start" (
    set PS_COMMAND=%PS_COMMAND% -Start
) else if "%ACTION%"=="stop" (
    set PS_COMMAND=%PS_COMMAND% -Stop
) else if "%ACTION%"=="restart" (
    set PS_COMMAND=%PS_COMMAND% -Restart
) else if "%ACTION%"=="status" (
    set PS_COMMAND=%PS_COMMAND% -Status
)

REM 运行PowerShell脚本
powershell -NoProfile -ExecutionPolicy Bypass -Command "%PS_COMMAND%"

REM 检查执行结果
if %errorLevel% equ 0 (
    echo.
    echo Operation completed successfully.
) else (
    echo.
    echo Operation failed with error code: %errorLevel%
)

echo.
pause