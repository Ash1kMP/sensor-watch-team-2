import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const MONGO = process.env.MONGO_URL || "mongodb://db-service:27017/sensorwatch";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
await mongoose.connect(MONGO);

const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      name: String,
      email: { type: String, unique: true },
      passwordHash: String,
    },
    { timestamps: true }
  )
);

function tokenFor(u) {
  return jwt.sign({ sub: u._id, name: u.name, email: u.email }, JWT_SECRET, {
    expiresIn: "14d",
  });
}

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "missing" });
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: "exists" });
  const passwordHash = await bcrypt.hash(password, 10);
  const u = await User.create({ name, email, passwordHash });
  return res.json({
    user: { id: u._id, name: u.name, email: u.email },
    token: tokenFor(u),
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  const u = await User.findOne({ email });
  if (!u) return res.status(401).json({ error: "invalid" });
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid" });
  return res.json({
    user: { id: u._id, name: u.name, email: u.email },
    token: tokenFor(u),
  });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log("auth-service on", PORT));
