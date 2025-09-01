import express from "express";
import type { Request, Response } from "express";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pgPromise from "pg-promise";

const app = express();
app.use(bodyParser.json());

// cors middleware : allow localhost:4200
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:4200");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// --- PostgreSQL connection (service name from Docker network) ---
const db = pgPromise()({
  host: "sql-db-service",
  port: 5432,
  database: "sensorwatch-userDB",
  user: "admin",
  password: "admin",
});

// --- JWT Secret (keep secure in real apps, e.g., env variable) ---
const JWT_SECRET = "supersecretkey";

// --- Types ---
type AuthData = {
  username: string;
  password: string;
};

// --- Create New User ---
async function createNewUser(request: Request, response: Response) {
  const authData: AuthData = {
    username: request.body.username,
    password: request.body.password,
  };

  try {
    // 1. Hash + salt the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(authData.password, saltRounds);

    // 2. Insert into DB
    const sql = `INSERT INTO "Users" (username, password) VALUES ($1, $2) RETURNING id, username`;
    const values = [authData.username, hashedPassword];

    const user = await db.one(sql, values);

    // 3. Create JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    response.json({ message: "User created", token });
  } catch (error) {
    console.error("Error saving auth data:", error);
    response.status(500).json({ error: "Failed to create user" });
  }
}

// --- Validate Existing User ---
async function validateUser(request: Request, response: Response) {
  const { username, password } = request.body;

  try {
    // 1. Get user by username
    const sql = `SELECT * FROM "Users" WHERE username = $1`;
    const user = await db.one(sql, [username]);

    // 2. Compare hashed password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return response.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Create JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "1h",
    });

    response.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error validating user:", error);
    response.status(401).json({ error: "Invalid credentials" });
  }
}

// --- Routes ---
app.post("/signup", createNewUser);
app.post("/login", validateUser);

// --- Start server ---
app.listen(5000, () => {
  console.log("Auth server running on port 5000");
});
