# Deploy SHANEX OMI on Cloudflare Workers (workers.dev)

The deployed site `sxom11.shashmithx.workers.dev` is a **Worker**, not a Pages site. A static-only Worker returns HTTP 405 to the game's `POST /api/rooms/create`; the frontend then incorrectly tries to parse its non-JSON response.

The production setup is now:
- `worker/index.ts` routes `/api/rooms/*` to the shared D1-backed room API and serves all React assets via the `ASSETS` binding.
- `wrangler.jsonc` configures Worker name **sxom11**, assets under `dist`, API-first routing, and `ROOMS_DB`.
- The `ROOMS_DB` D1 database is **automatically provisioned** on deployment when Wrangler 4.45+ is used, since the binding has no database ID. In GitHub-connected builds the generated database ID stays visible in Cloudflare; it is not automatically committed to Git.
- The API initializes its necessary D1 tables and indexes automatically on the first request. The SQL file under `migrations/` is an optional manual equivalent.

## Cloudflare Workers Builds settings

Open **Workers & Pages > sxom11 > Settings > Builds**:

| Setting | Value |
| --- | --- |
| Git repo | `shashmithx/sxom11` |
| Production branch | `main` (after merging PR) |
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

Wrangler's current version is pinned in package.json. Verify the deployment uses the repo's **wrangler.jsonc**, not a previous asset-only command such as `wrangler deploy --assets dist` or a dashboard-edited Worker script.

Merging the PR doesn't itself deploy the Worker unless GitHub production builds are connected and enabled.

## After deployment

1. Open `https://sxom11.shashmithx.workers.dev/api/rooms/health`. It must return HTTP 200, `Content-Type: application/json`, and `{"success":true,"service":"shanex-omi-rooms","storage":"D1"}`.
2. Create a room in one browser. Network `POST /api/rooms/create` should return HTTP 200 JSON with `roomCode` and `hostId`.
3. Open the room link on a second browser/device and join. Verify the host receives the peer join signal and both begin the WebRTC handshake.
4. For NAT-restricted networks, test both WebRTC and the fallback D1 message relay.

## Diagnose failures

| Result | Meaning |
| --- | --- |
| HTTP 405 with empty body | Stale/static-only Worker is deployed, or the Worker script does not run for `/api/*`. Verify the Build and Deploy commands, branch, and `wrangler.jsonc` entrypoint. |
| HTTP 503 JSON with missing ROOMS_DB binding | The D1 resource was not provisioned/bound. Check Worker > Bindings and Workers Builds logs; ensure Wrangler >=4.45. |
| HTTP 503 JSON with room service unavailable | Check Worker logs for schema initialization, D1 quotas, and permissions. |
| HTTP 403 HTML challenge | Check WAF/security rules targeting `/api/rooms/*`. |
| Health works but peers cannot connect directly | Check signaling packets, STUN connectivity, and whether TURN is needed; app has a limited D1 relay fallback. |

## Local dev

`npm run dev` continues to use the original Express server for AI Studio.
For Worker/D1 integration, use `npm run build` followed by `npx wrangler dev`.

**Note:** The D1 auto-provisioned resource is tied to this Worker. Avoid changing the binding name or Worker name without migrating data.
