#!/bin/sh
set -e

# Wait for Postgres to be ready using SQLAlchemy (no extra apk packages)
python - <<'PY'
import time, os, sys
from sqlalchemy import create_engine, text

database_url = os.environ.get('DATABASE_URL')
if not database_url:
    print('DATABASE_URL not set; proceeding without DB wait')
    sys.exit(0)

engine = create_engine(database_url, pool_pre_ping=True)
for i in range(60):
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        print('Database is ready')
        break
    except Exception as e:
        print(f'Waiting for database... ({i+1}/60): {e}')
        time.sleep(2)
else:
    print('Database not ready in time')
    sys.exit(1)
PY

# Seed fake data (non-fatal if rerun)
echo "Seeding fake data..."
python /app/fake_data.py || true

# Start API server
exec uvicorn app.main:app --host 0.0.0.0 --port 8001


