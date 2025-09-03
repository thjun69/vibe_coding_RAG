@echo off
echo Starting ResearchBot Backend...
echo.

cd backend

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting FastAPI server...
echo Make sure you have set your OPENAI_API_KEY in backend/.env file
echo.

uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
