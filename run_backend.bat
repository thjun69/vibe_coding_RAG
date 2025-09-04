@echo off
echo Starting ResearchBot Backend...
echo.

cd backend

echo Activating conda py311 environment...
call conda activate py311

echo Installing dependencies (if needed)...
pip install -r requirements.txt

echo.
echo Starting FastAPI server...
echo Make sure you have set your OPENAI_API_KEY in backend/.env file
echo.

uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
