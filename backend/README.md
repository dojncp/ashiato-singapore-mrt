# Ashiato Singapore MRT Backend

FastAPI backend for personal Singapore MRT/LRT riding records.

## Setup

1. Create a MySQL database and tables with `backend/sql/001_create_schema.sql`.
2. Copy `.env.example` to `.env` and adjust credentials.
3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Run the API with the Windows script, which activates the conda environment `smrt`:

```bat
start.bat
```

Or run it manually:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 39250 --reload
```

5. Create the first administrator account:

```bash
curl -X POST http://127.0.0.1:39250/api/auth/bootstrap-admin ^
  -H "Content-Type: application/json" ^
  -d "{\"token\":\"change-me-bootstrap-token\",\"username\":\"admin\",\"email\":\"admin@example.com\",\"password\":\"change-me\"}"
```

## Notes

The app does not create the database automatically. This keeps startup predictable when MySQL is not ready yet.
