# Ashiato Singapore MRT

Personal Singapore MRT/LRT segment riding tracker.

## Structure

- `backend/`: FastAPI API, MySQL data model, SQL schema.
- `frontend/`: React + Vite UI on port `5293`.

## Database

Run the SQL file in MySQL:

```sql
source backend/sql/001_create_schema.sql;
```

It creates the database:

```text
ashiato_singapore_mrt
```

The backend intentionally does not auto-create the database on startup.

## Backend

```bash
cd backend
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 39250 --reload
```

On Windows, use the provided scripts. The backend scripts activate the conda environment `smrt`.

```bat
start.bat
stop.bat
restart.bat
```

Create the first administrator with `POST /api/auth/bootstrap-admin`, using the `BOOTSTRAP_ADMIN_TOKEN` from `.env`.

## Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open `http://127.0.0.1:5293`.

## First-Version Data Model

The schema separates real stations from line-specific stations:

- `physical_stations`: a real station entity, such as Outram Park.
- `line_stations`: a station on a specific line, such as EW16 / NE3 / TE17.
- `segments`: adjacent sections between two line stations.
- `ride_records`: one journey record.
- `ride_legs`: same-line continuous parts inside one journey.
- `ride_leg_segments`: expanded adjacent segments covered by each leg.

For non-loop lines, a leg is expanded by station order. For loop lines, the request must choose `clockwise` or `anticlockwise`.

Line and station names reserve English, Chinese, Malay, and Tamil columns. English is the primary display language for the first version.
