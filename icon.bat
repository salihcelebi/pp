@echo off
setlocal

REM Hedef klasör: pp altında "icons" oluştur
set "BASE=C:\Users\salih\Desktop\33\DATDAT\dd\pp"
set "DEST=%BASE%\icons"

if not exist "%DEST%" mkdir "%DEST%"

REM Dosyaları icons içine taşı
for %%F in (256.png 16.png 32.png 48.png 128.png) do (
  if exist "%BASE%\%%F" (
    move /Y "%BASE%\%%F" "%DEST%\"
  ) else (
    echo Bulunamadi: "%BASE%\%%F"
  )
)

echo Bitti.
endlocal