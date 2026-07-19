import * as cookie from "cookie";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { User } from "@db/schema";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { hashPassword, verifyPassword } from "./lib/password";
import { signSessionToken } from "./lib/session";
import { createUser, findUserByEmail, touchLastSignIn } from "./queries/users";
import { createRouter, authedQuery, publicQuery } from "./middleware";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

// Never send the password hash to the client, even hashed.
function sanitizeUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function setSessionCookie(resHeaders: Headers, req: Request, token: string) {
  const opts = getSessionCookieOptions(req.headers);
  resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => sanitizeUser(opts.ctx.user)),

  signup: publicQuery
    .input(
      z.object({
        email: emailSchema,
        password: passwordSchema,
        name: z.string().trim().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await findUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await hashPassword(input.password);
      const user = await createUser({
        email: input.email,
        passwordHash,
        name: input.name,
        lastSignInAt: new Date(),
      });

      if (!user) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account.",
        });
      }

      const token = await signSessionToken({ userId: user.id });
      setSessionCookie(ctx.resHeaders, ctx.req, token);
      return sanitizeUser(user);
    }),

  login: publicQuery
    .input(
      z.object({
        email: emailSchema,
        password: z.string().min(1, "Password is required"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await findUserByEmail(input.email);
      const valid = user
        ? await verifyPassword(input.password, user.passwordHash)
        : false;

      if (!user || !valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Incorrect email or password.",
        });
      }

      await touchLastSignIn(user.id);

      const token = await signSessionToken({ userId: user.id });
      setSessionCookie(ctx.resHeaders, ctx.req, token);
      return sanitizeUser(user);
    }),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
