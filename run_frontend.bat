@echo off
echo Starting ResearchBot Frontend...
echo.

cd frontend

echo Installing dependencies...
npm install

echo.
echo Starting development server...
echo Frontend will be available at http://localhost:3000
echo.
echo Note: Deprecation warnings are suppressed for cleaner output
echo Use 'npm run dev:verbose' to see all warnings
echo.

npm run dev

pause
