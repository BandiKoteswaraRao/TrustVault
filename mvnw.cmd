@echo off
setlocal
set "DIR=%~dp0"
if exist "%DIR%.tools\maven\bin\mvn.cmd" (
    "%DIR%.tools\maven\bin\mvn.cmd" %*
) else (
    mvn %*
)
