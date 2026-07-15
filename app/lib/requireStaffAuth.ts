import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, firebaseAdminConfigured } from './firebaseAdmin';
import { prisma } from './db';
import type { Practitioner } from '../prisma/generated/prisma/client';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies the Firebase ID token sent as `Authorization: Bearer <token>` and resolves
 * it to a Practitioner row by email. On first successful login for an account, the
 * Practitioner row is back-filled with the Firebase UID so future logins are matched
 * by UID rather than email alone.
 */
export async function requireStaffAuth(request: NextRequest): Promise<Practitioner> {
  if (!firebaseAdminConfigured || !adminAuth) {
    throw new AuthError(
      'Staff authentication is not configured on the server (missing FIREBASE_ADMIN_* env vars).',
      500,
    );
  }

  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) throw new AuthError('Missing bearer token', 401);

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(match[1]);
  } catch {
    throw new AuthError('Invalid or expired session', 401);
  }

  if (!decoded.email) throw new AuthError('Firebase account has no email', 401);

  let practitioner = await prisma.practitioner.findUnique({ where: { email: decoded.email } });
  if (!practitioner) throw new AuthError('No staff account found for this email', 403);

  if (!practitioner.firebaseUid) {
    practitioner = await prisma.practitioner.update({
      where: { id: practitioner.id },
      data: { firebaseUid: decoded.uid },
    });
  } else if (practitioner.firebaseUid !== decoded.uid) {
    throw new AuthError('Account mismatch', 403);
  }

  return practitioner;
}

type RouteHandler<Ctx> = (req: NextRequest, ctx: Ctx, practitioner: Practitioner) => Promise<Response>;

/** Wraps a route handler so it only runs for authenticated staff, handling error responses. */
export function withStaffAuth<Ctx>(handler: RouteHandler<Ctx>) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      const practitioner = await requireStaffAuth(req);
      return await handler(req, ctx, practitioner);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
