import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

// Express 5 forwards rejected promises from async handlers here automatically,
// so route handlers can `await schema.parseAsync(...)` and just let it throw.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: err.flatten() });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
