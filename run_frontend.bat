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

npm run dev

pause
