@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if not exist out\main\index.js call npm run build
start "" node_moduleslectron\distlectron.exe .
