import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "Admin" | "Manager";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["Admin", "Manager"], default: "Manager" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", userSchema);
