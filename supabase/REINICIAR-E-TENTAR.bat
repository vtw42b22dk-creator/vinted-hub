@echo off
title Vinted Hub - Reiniciar Supabase + SQL
echo.
echo  PASSO A — Reinicia a base de dados:
echo  https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/settings/general
echo  (desce ate "Restart project" ou "Pause project" / Resume)
echo.
echo  PASSO B — Espera 1-2 minutos
echo.
echo  PASSO C — Abre SQL Editor (1 linha de cada vez):
echo  https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/sql/new
echo.
start https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/settings/general
timeout /t 3 /nobreak >nul
start notepad "%~dp0micro\01.sql"
timeout /t 2 /nobreak >nul
start https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/sql/new
echo.
echo  Copia UMA linha do Notepad, cola no Supabase, RUN.
echo  Se der erro de rede, reinicia o projeto (Passo A) e tenta outra vez.
pause
