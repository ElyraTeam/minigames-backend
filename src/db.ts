import { MongoClient } from "mongodb";
import env from "./env.js";

const db = new MongoClient(env.DATABASE_URL);

const minigames_db = db.db("minigames");

export { minigames_db };
