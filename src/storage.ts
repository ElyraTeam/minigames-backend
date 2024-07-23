import { Server } from "socket.io";
import { WordGame } from "./models/word/game.js";
import { plainToInstance } from "class-transformer";
import { Feedback } from "./models/feedback.js";
import { MsGame } from "./models/minesweeper/game.js";
import { minigames_db } from "./db.js";
import { BaseGame, GameId } from "./models/base.js";

class GameStorage<T extends BaseGame> {
  private games: T[] = [];

  //save function
  protected doSave?: () => void;

  setSaveFunction(save: () => void) {
    this.doSave = save;
  }

  getGames() {
    return this.games;
  }

  getGame(id: string) {
    return this.games.find((g) => g.id == id);
  }

  addGame(game: T) {
    this.games.push(game);
    this.doSave && this.doSave();
  }

  removeGame(id: string) {
    this.games = this.games.filter((g) => g.id !== id);
    this.doSave && this.doSave();
  }
}

class Storage {
  public io!: Server;

  public feedbacks: Feedback[] = [];

  public wordStorage = new GameStorage<WordGame>();
  public minesweeperStorage = new GameStorage<MsGame>();

  constructor() {
    this.wordStorage.setSaveFunction(() => this.saveGames());
    this.minesweeperStorage.setSaveFunction(() => this.saveGames());
  }

  getStorageForGame(gameId: GameId) {
    switch (gameId) {
      case "word":
        return this.wordStorage;
      case "minesweeper":
        return this.minesweeperStorage;
      default:
        throw new Error("Invalid game id");
    }
  }

  async saveGames() {
    //TODO make this universal
    for (const game of this.wordStorage.getGames()) {
      const toSave: any = { ...game };
      delete toSave._id;
      await minigames_db
        .collection("words_games")
        .updateOne({ id: game.id }, { $set: toSave }, { upsert: true });
    }
  }

  async loadGames() {
    const wordGames = await minigames_db.collection("words_games").find();

    if (wordGames) {
      for await (const game of wordGames) {
        this.wordStorage.getGames().push(plainToInstance(WordGame, game));
      }
    }
  }

  async saveFeedbacks() {
    for (const f of this.feedbacks) {
      await minigames_db
        .collection("feedbacks")
        .updateOne({ _id: f._id }, { $set: f }, { upsert: true });
    }
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
