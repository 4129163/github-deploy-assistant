<#
GitHub Deploy Assistant Windows PowerShell 一键安装脚本
兼容 Win10 / Win11
#>

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "GitHub Deploy Assistant 一键安装脚本" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# 检查Node.js是否安装
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 已安装: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js 未安装，正在下载安装..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.12.0/node-v20.12.0-x64.msi" -OutFile "$env:TEMP\node-installer.msi"
    Start-Process msiexec.exe -ArgumentList "/i $env:TEMP\node-installer.msi /qn" -Wait
    $env:Path += ";C:\Program Files\nodejs\"
}

# 检查Git是否安装
try {
    $gitVersion = git --version
    Write-Host "✅ Git 已安装: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git 未安装，正在下载安装..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.44.0.windows.1/Git-2.44.0-64-bit.exe" -OutFile "$env:TEMP\git-installer.exe"
    Start-Process "$env:TEMP\git-installer.exe" -ArgumentList "/VERYSILENT" -Wait
    $env:Path += ";C:\Program Files\Git\cmd\"
}

# 安装项目依赖
Write-Host "📦 正在安装项目依赖..." -ForegroundColor Cyan
npm install

# 创建桌面快捷方式
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\GitHub Deploy Assistant.lnk")
$Shortcut.TargetPath = "npm"
$Shortcut.Arguments = "run start-all"
$Shortcut.WorkingDirectory = $PWD.Path
$Shortcut.IconLocation = "$PWD.Path\public\favicon.ico"
$Shortcut.Save()

Write-Host "=====================================" -ForegroundColor Green
Write-Host "✅ 安装完成！" -ForegroundColor Green
Write-Host "👉 桌面快捷方式已创建，双击即可启动服务" -ForegroundColor Green
Write-Host "👉 也可以在当前目录执行 npm run start-all 启动" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

Pause