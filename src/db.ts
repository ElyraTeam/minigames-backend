import { MongoClient } from "mongodb";

const db = new MongoClient(process.env.DATABASE_URL!);

const minigames_db = db.db("minigames");

export { minigames_db };
