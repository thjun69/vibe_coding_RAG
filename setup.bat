@echo off
echo Setting up ResearchBot project...
echo.

echo Creating necessary directories...
if not exist "backend\uploads" mkdir backend\uploads
if not exist "backend\chroma_db" mkdir backend\chroma_db

echo.
echo Copying environment file...
if not exist "backend\.env" (
    copy "backend\env.example" "backend\.env"
    echo Please edit backend\.env and set your OPENAI_API_KEY
) else (
    echo .env file already exists
)

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Edit backend\.env and set your OPENAI_API_KEY
echo 2. Run run_backend.bat to start the backend server
echo 3. Run run_frontend.bat to start the frontend
echo.
echo Backend will run on http://localhost:8000
echo Frontend will run on http://localhost:3000
echo.

pause
