import { handle } from "hono/vercel";

// Loads the app lazily so a startup failure (e.g. a missing environment
// variable) is returned as readable JSON instead of a blank Vercel crash page.
let handler: ((req: Request) => Response | Promise<Response>) | undefined;
let startupError: string | undefined;

async function run(req: Request): Promise<Response> {
  if (!handler && !startupError) {
    try {
      const { default: app } = await import("../server/app.js");
      handler = handle(app);
    } catch (e) {
      startupError = e instanceof Error ? e.message : String(e);
    }
  }
  if (startupError || !handler) {
    return new Response(JSON.stringify({ startupError }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return handler(req);
}

export const GET = run;
export const POST = run;
export const PUT = run;
export const PATCH = run;
export const DELETE = run;
