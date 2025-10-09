# GraphiTi Admin UI

GraphiTi Admin is a React + TypeScript console for managing the GraphiTi knowledge graph and the Neo4j backup pipeline. It delivers:

- Interactive Sigma.js visualization with entity search, priority filters, and node drill-in panels
- Dashboard cards for graph statistics per group
- Backup configuration editor with cron + retention controls
- Manual backup launcher with realtime status feedback
- Historical backup table with download and delete actions

## Getting started

```bash
cd graphiti-admin
npm install
npm run dev
```

Set proxy targets via environment variables (create `.env.local`):

```bash
VITE_GRAPHITI_PROXY_TARGET=http://localhost:8000
VITE_BACKUP_PROXY_TARGET=http://localhost:8080
```

When deploying behind a reverse proxy, expose the services under `/graphiti-api` and `/backup-api`, or override `VITE_GRAPHITI_API_URL` / `VITE_BACKUP_API_URL` with the public endpoints you prefer.

The top-level `docker-compose.yml` includes an `nginx` gateway on port `3333` that forwards:

- `/` → GraphiTi Admin UI (`graphiti-admin`)
- `/graphiti-api` → FastAPI graph service (`graphiti-api`)
- `/backup-api` → Backup service (`neo4j-backup`)
- `/mcp` → MCP HTTP server (`mcp-http-server`) – requires `X-GraphiTi-Token` header when `MCP_REQUIRE_AUTH=true`

You can point your public DNS or load balancer at `http://<host>:3333` to expose all three services under a single origin.

## Available scripts

- `npm run dev` – launch the Vite dev server with HMR
- `npm run build` – type-check and build production assets
- `npm run preview` – preview the production build
- `npm run lint` – run ESLint across the project

## Tech stack

- **React 18** with **React Router 6**
- **TanStack Query** for data fetching and caching
- **Zustand** for lightweight client state
- **@react-sigma/core** + Graphology for WebGL graph rendering
- **Tailwind CSS** for styling
- **Axios** clients for the GraphiTi and backup services
