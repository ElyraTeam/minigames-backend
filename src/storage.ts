import { Server } from "socket.io";
import { WordGame } from "./models/word/game.js";
import { plainToInstance } from "class-transformer";
import { Feedback } from "./models/feedback.js";
import { MsGame } from "./models/minesweeper/game.js";
import { minigames_db } from "./db.js";

interface Games {
  word: WordGame[];
  minesweeper: MsGame[];
}

class Storage {
  public games: Games = {
    word: [],
    minesweeper: [],
  };
  public feedbacks: Feedback[] = [];
  public io!: Server;

  removeGame(id: string) {
    this.games.word = this.games.word.filter((g) => g.id !== id);
    this.saveGames();
  }

  async saveGames() {
    for (const game of this.games.word) {
      await minigames_db
        .collection("words_games")
        .updateOne({ id: game.id }, { $set: game }, { upsert: true });
    }
  }

  async loadGames() {
    const games = await minigames_db.collection("words_games").find();

    if (games) {
      for await (const game of games) {
        this.games.word.push(plainToInstance(WordGame, game));
      }

      this.games.minesweeper = [];
      // this.games.minesweeper = plainToInstance(MsGame, tempGames.minesweeper);
    }
  }

  saveFeedbacks() {
    minigames_db.collection("feedbacks").insertMany(this.feedbacks);
  }

  async loadFeedbacks() {
    const feedbacks = await minigames_db.collection("feedbacks").find();

    if (feedbacks) {
      for await (const f of feedbacks) {
        this.feedbacks.push(f as any);
      }
    }
  }
}

export default new Storage();
