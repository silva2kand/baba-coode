@echo off
echo ========================================
echo   Building Baba Code Desktop for Windows 11
echo ========================================
echo.

REM Check if venv exists
if not exist "venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements-desktop.txt
pip install -r requirements.txt

echo.
echo Packaging Baba Code Desktop...
flet pack baba_desktop.py --name "Baba Code" --add-data "src;src" --add-data "reference_data;reference_data" --product-version 1.0.0

echo.
echo ========================================
echo   Build complete!
echo   Check the "dist" folder for Baba Code.exe
echo ========================================
pause
