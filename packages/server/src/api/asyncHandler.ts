import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Express 4 does not forward a rejected promise from an async handler to
// error middleware -- it becomes an unhandled rejection, which (Node 15+)
// terminates the whole process. Every route in this app is async, so a
// single malformed file anywhere (a hand-edited registry.json, a truncated
// catalog.json write) would otherwise take down every project's live
// terminal session, not just fail that one request. Wrap every handler with
// this.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
