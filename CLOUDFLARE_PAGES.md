# SHANEX OMI on Cloudflare Pages

The original `server.ts` is an Express/Node server for AI Studio or local development. **Cloudflare Pages does not run `server.ts` on a static Vite deployment.** The production room endpoints now live under `functions/api/rooms/[[path]].ts` and use Cloudflare D1.

## First-time setup (required)

1. In **Cloudflare > Workers & Pages**, open your existing **Pages** project. Confirm Git builds use repository root `/`, build command `npm run build`, and output directory `dist`.
2. Create a D1 database named `sxom11-rooms` (any name is fine).
3. Apply `migrations/0001_omi_rooms.sql` to that database. Either use the D1 dashboard SQL console and paste the file, or run:
   `npx wrangler d1 execute sxom11-rooms --remote --file=./migrations/0001_omi_rooms.sql`
   while authenticated to the matching Cloudflare account.
4. In **Pages project > Settings > Bindings** add a **D1 database** binding, with variable name exactly `ROOMS_DB`, selecting that D1 database. Add this to both Production and Preview if testing preview deployments.
5. Redeploy the Pages project. Dashboard bindings only apply after redeploying.
6. Verify `GET /api/rooms/health` returns JSON `{"success":true,...}`.
7. Test Room Create in the browser. It should return a room code like `OMI-AB23`. Test Join from a second browser/device.

**Important:** Deploying code alone will not work until the D1 migration and `ROOMS_DB` binding are configured. A missing binding or schema produces a JSON 503 rather than silently returning your SPA index page.

## Architecture

- Pages serves the compiled React/Vite app from `dist`.
- Pages Functions serve `/api/rooms/*` from the same origin.
- D1 stores room records and ordered signaling/relay messages so requests from different Cloudflare locations see the same room.
- The existing WebRTC client attempts direct peer-to-peer communication. It polls signaling messages every ~1.2 seconds, and the fallback game relay uses the same persisted message queue. No sticky server or in-memory global Map is assumed.
- `/api/rooms/:code/events` returns HTTP 204 because Cloudflare Pages Functions cannot share the original Express process's SSE client map. Polling is the supported path.
- Old rooms are cleaned up on creation after 3 hours of no activity.

## Local testing

For Express-based AI Studio/local testing, `npm run dev` still uses `server.ts`.
For Pages+D1 testing, use `npm run build`, then `npx wrangler pages dev dist --d1 ROOMS_DB=<D1_DATABASE_ID>` after applying the migration to a local test D1 binding (refer to the official Cloudflare Pages/D1 development documentation).

## Troubleshooting

- `/api/rooms/create` returns HTML / HTTP 404: Pages Functions did not deploy; confirm the `functions` folder is in the repository root and that you deployed a **Pages** Git project.
- HTTP 503 `ROOMS_DB binding is missing`: configure the Pages D1 binding and redeploy.
- HTTP 503 `Database tables are missing`: apply the SQL migration to the correct database.
- Room joins but P2P fails: inspect the browser's WebRTC logs and whether both clients can reach STUN. A TURN server may be needed for some symmetric NAT/mobile networks; the current D1 relay is a low-frequency fallback rather than a high-throughput transport.
- Unexpected Cloudflare challenge/403: inspect WAF rules affecting `/api/rooms/*`.
