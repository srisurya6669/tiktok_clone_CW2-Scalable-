# ScaleTok

A TikTok-style video sharing web app built for COM769 (Scalable Advanced Software Solutions).
Users sign up, log in, upload or record videos (up to 30s from the camera), scroll an infinite
feed, like and comment, and manage their own videos on a profile page.

## Architecture

| Part | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router |
| Backend | Node.js, Express 5, JWT auth, helmet, rate limiting |
| Database | MongoDB (Atlas) via Mongoose: users, video metadata, likes, comments |
| Video storage | Azure Blob Storage (private container) |

Video flow: the browser asks the API for a short-lived upload URL (SAS), uploads the file
directly to Blob Storage, then tells the API to save the video's metadata. Playback uses
short-lived read-only SAS URLs, so only signed-in users can watch.

## Run locally

Requirements: Node.js 20+, a MongoDB database, and an Azure Storage account with a private
container named `videos` (with a CORS rule allowing `http://localhost:5173`).

```bash
# Backend
cd Backend
cp .env.example .env      # then fill in the values
npm install
npm run dev               # http://localhost:3000

# Frontend (second terminal)
cd Frontend/Frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

Health check: `GET /health` returns 200 when the API is up and connected to MongoDB.

## API overview

All routes except `/health` and `/api/auth/register|login` need `Authorization: Bearer <token>`.

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/videos?limit=&before=&user=`: cursor-paginated feed
- `POST /api/videos/upload-url`, then `POST /api/videos`: upload flow
- `DELETE /api/videos/:id`
- `PUT|DELETE /api/videos/:id/like`
- `GET|POST /api/videos/:id/comments`, `DELETE /api/videos/:id/comments/:commentId`
