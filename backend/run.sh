#!/bin/bash

# Activate virtual environment and run the application
cd "$(dirname "$0")"
source venv/bin/activate

# Run the FastAPI application
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
