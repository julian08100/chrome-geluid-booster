@echo off
chcp 65001 >nul
title Geluid Booster installeren
set "MAP=%~dp0extensie"

if not exist "%MAP%\manifest.json" (
  echo.
  echo  Het mapje "extensie" is niet gevonden.
  echo  Heb je het zip-bestand eerst uitgepakt?
  echo  Rechtermuisknop op het zip-bestand ^> "Alles uitpakken..." en start dit bestand daarna opnieuw.
  echo.
  pause
  exit /b 1
)

rem Pad naar de extensie op het klembord zetten (zonder enter erachter)
<nul set /p "=%MAP%" | clip

start "" chrome "chrome://extensions/" 2>nul

cls
echo.
echo  ==============================================================
echo                 GELUID BOOSTER - 3 STAPPEN
echo  ==============================================================
echo.
echo  Chrome opent nu de pagina met extensies.
echo  (Gebeurt dat niet? Typ in Chrome bovenin:  chrome://extensions )
echo.
echo   1. Zet rechtsboven  "Ontwikkelaarsmodus"  AAN.
echo.
echo   2. Klik linksboven op  "Uitgepakte extensie laden".
echo.
echo   3. Klik bovenin het venster in de adresbalk, druk op
echo      Ctrl+V  en dan Enter, en klik op  "Map selecteren".
echo      (Het juiste pad staat al voor je klaar.)
echo.
echo  Klaar! Klik in Chrome op het puzzelstukje rechtsboven en
echo  daarna op de punaise bij "Geluid Booster", zodat het oranje
echo  luidspreker-icoontje altijd zichtbaar is.
echo.
echo  Map van de extensie:
echo  %MAP%
echo.
echo  Let op: laat dit mapje staan. Verwijder je het mapje,
echo  dan is de Geluid Booster ook weg.
echo.
pause
