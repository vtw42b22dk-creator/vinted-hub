@echo off
title Vinted Hub - SQL Setup
echo.
echo  A abrir o SQL no Bloco de Notas...
echo  A abrir o Supabase SQL Editor no browser...
echo.
echo  INSTRUCOES:
echo  1. Copia PASSO-1 (depois PASSO-2, PASSO-3) do Notepad
echo  2. Cola no Supabase SQL Editor
echo  3. Clica RUN (ou Ctrl+Enter)
echo  4. Repete para cada passo
echo.
start notepad "%~dp0PASSO-1.sql"
timeout /t 2 /nobreak >nul
start https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/sql/new
pause
