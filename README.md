# Venerdi — Support Chat Server

Real-time customer support chat for the Venerdi store. Node.js, Express 5, Socket.IO and MongoDB.

## How it works
1. A logged-in user asks the main API for a short-lived chat token (`GET /api/v1/auth/chat-token`).
2. The client connects to this server with `io(url, { auth: { token } })`.
3. Customers join their own room; `support` / `admin` users join the `support_team` room.
4. Messages are stored in MongoDB and pushed live to both sides.

## Socket events
`chat message`, `typing`, `stop typing`, `mark read`, `messages read`

## REST endpoints (Bearer chat token)
- `GET /conversations` — support/admin only, list of conversations with unread counts
- `GET /messages/:conversationId` — message history (customers can only read their own)

## Getting started
```bash
cp .env.example .env
npm install
npm start      # http://localhost:4000
```

Health check: `GET /health`

## Notes
- Only tokens issued for chat (`type: "chat"`) are accepted, normal access tokens are rejected.
- Deployed on Render free tier, so the first connection after idle can take 30–60 s.