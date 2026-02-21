import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/errors";

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation failed.",
      details: error.flatten(),
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name: string }).name === "string"
  ) {
    const knownError = error as { name: string; message?: string };

    if (knownError.name === "ValidationError") {
      res.status(400).json({ message: knownError.message ?? "Validation error." });
      return;
    }

    if (knownError.name === "CastError") {
      res.status(400).json({ message: "Invalid identifier format." });
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ message: "Internal server error." });
};
