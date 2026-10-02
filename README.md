# BigMart Backend Foundation

Production-oriented backend foundation for a multi-vendor e-commerce marketplace platform built with Node.js, Express, MongoDB, and Mongoose.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Environment**: dotenv
- **Middleware**: CORS, Helmet, Morgan

---

## Directory Structure

```text
backend/
├── src/
│   ├── config/          # Configuration files (Database, etc.)
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom Express middleware (Error handling, 404, etc.)
│   ├── models/          # Mongoose data models
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic services
│   ├── utils/           # Utility helpers (ApiError, etc.)
│   ├── validators/      # Request validation schemas
│   ├── app.js           # Express app setup and middleware configuration
│   └── server.js        # Entry point for database connection and HTTP server
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore file
├── package.json         # Project dependencies and scripts
└── README.md            # Documentation
```

---

## Getting Started

### 1. Installation

Install all required dependencies:

```bash
npm install
```

### 2. Environment Configuration

Create a local `.env` file in the root of the `backend` directory by copying `.env.example`:

```bash
cp .env.example .env
```

#### Required Environment Variables

| Variable Name | Description | Example / Default |
| `NODE_ENV` | Application environment (`development` / `production`) | `development` |
| `PORT` | HTTP server port | `5000` |
| `MONGO_URI` | MongoDB connection URI string | `mongodb://localhost:27017/bigmart` |

> **Note**: Never commit your local `.env` file to source control.

---

## Running the Application

### Development Mode

Start the development server with hot-reloading powered by `nodemon`:

```bash
npm run dev
```

### Production Mode

Start the production server:

```bash
npm start
```

---

## Health Check Endpoint

### `GET /api/v1/health`

Verifies that the API server is operational.

#### Response Example (200 OK)

```json
{
  "success": true,
  "message": "API is running",
  "environment": "development",
  "timestamp": "2026-10-02T10:30:00.000Z"
}
```
