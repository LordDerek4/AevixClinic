import { NextResponse, type NextRequest } from 'next/server';
import { adminAuth, firebaseAdminConfigured } from './firebaseAdmin';
import { getDb } from './db';
import type { PractitionerDoc } from './firestoreModels';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export interface StaffPractitioner extends PractitionerDoc {
  id: string;
}

/**
 * Verifies the Firebase ID token sent as `Authorization: Bearer <token>` and resolves
 * it to a Practitioner doc by email. On first successful login for an account, the
 * Practitioner doc is back-filled with the Firebase UID so future logins are matched
 * by UID rather than email alone.
 */
export async function requireStaffAuth(request: NextRequest): Promise<StaffPractitioner> {
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

  const firestore = getDb();
  const snap = await firestore.collection('practitioners').where('email', '==', decoded.email).limit(1).get();
  if (snap.empty) throw new AuthError('No staff account found for this email', 403);

  const doc = snap.docs[0];
  const data = doc.data() as PractitionerDoc;

  if (!data.firebaseUid) {
    await doc.ref.update({ firebaseUid: decoded.uid });
    data.firebaseUid = decoded.uid;
  } else if (data.firebaseUid !== decoded.uid) {
    throw new AuthError('Account mismatch', 403);
  }

  return { id: doc.id, ...data };
}

type RouteHandler<Ctx> = (req: NextRequest, ctx: Ctx, practitioner: StaffPractitioner) => Promise<Response>;

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
