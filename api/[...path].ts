import { handle } from "hono/vercel";
import app from "../server/app.js";

// No `export const config = { runtime: "edge" }` here on purpose:
// the app uses the `postgres` driver (raw TCP), which needs the
// Node.js Serverless Function runtime, not the Edge runtime.
export default handle(app);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
