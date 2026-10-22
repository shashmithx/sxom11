/**
 * Cloudflare Workers entrypoint: same-origin React static assets + D1-backed game API.
 *
 * The Pages Function's implementation is reused so Pages and Workers behave
 * identically without maintaining two room state machines.
 */
import { onRequest as handleRoomRequest } from '../functions/api/rooms/[[path]]';

type WorkerEnvironment = {
  ROOMS_DB?: Parameters<typeof handleRoomRequest>[0]['env']['ROOMS_DB'];
  ASSETS: { fetch(request: Request): Promise<Response> };
};

export default {
  async fetch(request: Request, env: WorkerEnvironment): Promise<Response> {
    const path = new URL(request.url).pathname;

    // API routes must never be handled by Cloudflare's static asset fallback.
    if (path === '/api/rooms' || path.startsWith('/api/rooms/')) {
      return handleRoomRequest({ request, env });
    }

    if (path.startsWith('/api/')) {
      return Response.json(
        { success: false, error: 'Unknown API route' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return env.ASSETS.fetch(request);
  }
};
