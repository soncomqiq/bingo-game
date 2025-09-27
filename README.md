# Real-time Classroom Bingo

A web-based, real-time multiplayer bingo experience tailored for classroom participation tracking. Hosts can create a lobby, monitor players, draw numbers live, and automatically detect winners — all powered by Socket.IO with an in-memory game state.

## Features

- **Lobby management** – hosts create a game, share a join link, and see players arrive in real time.
- **Host authentication** – every lobby is protected by a per-game password that lives in server memory; only authenticated hosts can start, draw, reset, or call numbers.
- **Smart bingo boards** – players randomize 5×5 boards (with the classic FREE center space) until the game starts.
- **Live or manual number calls** – hosts can draw random numbers from 1–75 or manually call a specific number to handle corrections mid-game.
- **Automatic win detection** – rows, columns, and diagonals trigger instant BINGO announcements for everyone.
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

### Host workflow

1. From the homepage, enter a password (minimum 4 characters) and create a new game.
2. On the host screen, re-enter the same password to unlock controls. The password is never sent to players or persisted in a database.
3. After the game starts you can draw randomly or use **Call Number** to announce a specific value that was missed.
4. Use **Play Again** to reset the lobby and generate fresh boards for everyone.

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
