@echo off
echo ==========================================================
echo  Starting JanaDhwani Platform - Kalyana Karnataka Solvathon
echo ==========================================================

if exist .venv\Scripts\python.exe (
    set PYTHON_CMD=.venv\Scripts\python.exe
) else (
    set PYTHON_CMD=python
)

%PYTHON_CMD% run.py
pause
