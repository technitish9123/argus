# Agent Backend

Scalable Node.js TypeScript backend for agent protocol with Akave/Filecoin integration.

## Features
- Express REST API for agent instructions
- JSON strategy publishing to Akave/Filecoin (S3-compatible)
- Modular structure for cloud deployment

## Getting Started
1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Set environment variables in a `.env` file:
   ```env
   RPC_URL=<your_rpc_url>
   PRIVATE_KEY=<your_private_key>
   AKAVE_ACCESS_KEY=<your_akave_access_key>
   AKAVE_SECRET_KEY=<your_akave_secret_key>
   AKAVE_ENDPOINT=<your_akave_endpoint>
   ```
3. Run in development mode:
   ```sh
   pnpm dev
   ```

## API Endpoints
- `POST /intent` — Submit agent instructions/strategy
- `POST /publish` — Publish strategy JSON to Akave/Filecoin

## License
MIT
