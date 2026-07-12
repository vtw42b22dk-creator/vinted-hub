@echo off
title Vinted Hub - Push para GitHub
cd /d "%~dp0"

echo.
echo  A enviar alteracoes para o GitHub...
echo.

set GIT="C:\Program Files\Git\cmd\git.exe"
if not exist %GIT% (
  echo  ERRO: Git nao encontrado. Instala em https://git-scm.com
  pause
  exit /b 1
)

%GIT% add -A
%GIT% status -sb
echo.

set /p MSG=Descricao curta das alteracoes (Enter = atualizacao): 
if "%MSG%"=="" set MSG=Atualizacao Vinted Hub

%GIT% commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo  Nada novo para enviar, ou commit falhou.
) else (
  %GIT% push origin main
  if errorlevel 1 (
    echo.
    echo  Push falhou. Podes precisar de fazer login no GitHub no browser.
  ) else (
    echo.
    echo  PRONTO! Site a atualizar em 1-2 min:
    echo  https://github.com/vtw42b22dk-creator/vinted-hub/actions
    echo  https://vtw42b22dk-creator.github.io/vinted-hub/
  )
)

echo.
pause
