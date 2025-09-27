# Real-time Classroom Bingo

A web-based, real-time multiplayer bingo experience tailored for classroom participation tracking. Hosts can create a lobby, monitor players, draw numbers live, and automatically detect winners — all powered by Socket.IO with an in-memory game state.

## Features

- **Lobby management** – hosts create a game, share a join link, and see players arrive in real time.
- **Host authentication** – every lobby is protected by a per-game password that lives in server memory; only authenticated hosts can start, draw, reset, or call numbers.
- **Smart bingo boards** – players randomize 5×5 boards (with the classic FREE center space) until the game starts.
- **Live or manual number calls** – hosts can draw random numbers from 1–75 or manually call a specific number to handle corrections mid-game.
- **Automatic win detection** – rows, columns, and diagonals trigger instant BINGO announcements for everyone.
- **Custom number ranges** – hosts choose the minimum and maximum values for every game, making it easy to align with lesson numbers or smaller practice sets.
- **Pre-game draw estimates** – a quick Monte Carlo simulation predicts roughly how many draws it will take to crown the first winner based on the active range and player count.
- **Winner caps** – limit how many players can claim Bingo before the round ends to keep things moving.
- **Reset-ready** – hosts can spin up another round without leaving the lobby.

## Project layout

```
/ (project root)
├── client   # React front-end (Vite, React Router, Socket.IO client)
└── server   # Node.js + Express + Socket.IO backend
```

## Prerequisites

- Node.js 18 or later
- npm (bundled with Node)

## Setup

Install dependencies for both the server and client:

```powershell
cd "c:\Users\nuttachai.ku\Downloads\Local Learn\we-stride\Group Participation Rating"
npm install --prefix server
npm install --prefix client
```

## Running the app locally

In two separate terminals:

1. **Start the backend (port 4000)**

    ```powershell
    npm run dev --prefix server
    ```

2. **Start the frontend (port 5173)**

    ```powershell
    npm run dev --prefix client
    ```

Visit `http://localhost:5173` to create or join games. Socket.IO traffic is proxied to the backend during development.

## GitHub Pages deployment

This repository now ships with an automated GitHub Pages workflow that builds the client with Vite and publishes it to the `github-pages` environment. To activate it:

1. Push your changes to the `main` branch (the workflow triggers on pushes to `main` or via manual dispatch).
2. In your GitHub repository, open **Settings → Pages** and choose the **GitHub Actions** source if prompted.
3. Add a repository secret named `BINGO_SOCKET_URL` under **Settings → Secrets and variables → Actions**. Set it to the public URL where your Socket.IO backend is hosted (for local testing you can leave it blank and the workflow will fall back to `http://localhost:4000`).
4. The workflow builds the client with the appropriate base path (`/bingo-game/`) and deploys `client/dist` automatically. The published site will be available at `https://soncomqiq.github.io/bingo-game/`.

> ℹ️ GitHub Pages can only serve static assets. You still need to host the Node/Socket.IO server separately (Render, Railway, Fly.io, Azure Web Apps, etc.) and expose its URL via the `VITE_SOCKET_URL` environment variable when building.

### Host workflow

1. From the homepage, choose a password (minimum 4 characters), select a number range, and optionally set how many winners to allow.
2. On the host screen, re-enter the password to unlock controls. The password is never sent to players or persisted in a database.
3. Review the live draw estimate, then start the game once everyone is ready. Draw randomly or use **Call Number** to announce a specific value.
4. When the winner limit is reached, reset the lobby with **Play Again** to generate fresh boards for everyone.

## Tests

The client bundle includes Vitest specs for bingo board utilities:

```powershell
npm test --prefix client
```

## Production build

When you are ready to deploy:

```powershell
npm run build --prefix client
```

Serve the generated `client/dist` directory with any static host. Running the server with `NODE_ENV=production` will automatically serve those static assets.

## Environment configuration

Optional environment variables:

- `PORT` – backend listening port (defaults to `4000`).
- `VITE_SOCKET_URL` – override Socket.IO endpoint (defaults to `http://localhost:4000`).

## Next steps

- Add persistent storage (Redis or a database) if game history is required.
- Enhance the UI with animations and accessibility improvements.
- Expand testing to cover Socket.IO flows end-to-end.
