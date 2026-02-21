import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { User, UserRole } from "../models/User";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/errors";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["Admin", "Manager"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signToken = (user: { id: string; email: string; role: UserRole }): string =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const email = payload.email.toLowerCase().trim();

    const existing = await User.findOne({ email });
    if (existing) {
      throw new ApiError(409, "Email is already registered.");
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await User.create({
      email,
      passwordHash,
      role: payload.role ?? "Manager",
    });

    const token = signToken({
      id: String(user._id),
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const email = payload.email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const validPassword = await bcrypt.compare(payload.password, user.passwordHash);
    if (!validPassword) {
      throw new ApiError(401, "Invalid email or password.");
    }

    const token = signToken({
      id: String(user._id),
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required.");
    }

    const user = await User.findById(req.user.id).select("_id email role createdAt");
    if (!user) {
      throw new ApiError(401, "User no longer exists.");
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  })
);

export default router;
