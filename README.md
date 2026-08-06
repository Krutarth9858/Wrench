# Wrench

AI-powered roadside assistance platform.

## Architecture

- **Backend**: FastAPI, PostgreSQL, SQLAlchemy, Alembic
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, shadcn/ui

## Prerequisites

- Docker and Docker Compose
- Node.js (for local frontend development)
- Python 3.11+ (for local backend development)

## Getting Started

### Running with Docker (Recommended for Backend/Database)

The easiest way to start the backend and database is using Docker Compose.

```bash
# Start the PostgreSQL database and backend server
docker-compose up --build -d

# Check the logs
docker-compose logs -f
```

The backend API will be available at `http://localhost:8000`.
API documentation is available at `http://localhost:8000/docs`.

### Local Frontend Development

To run the frontend locally:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.
