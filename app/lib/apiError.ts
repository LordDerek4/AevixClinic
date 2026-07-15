import { NextResponse, type NextRequest } from 'next/server';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<Response>;

/** Wraps a public route handler with consistent JSON error responses. */
export function withErrorHandling<Ctx>(handler: Handler<Ctx>) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
