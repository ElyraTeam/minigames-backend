import { Server } from "socket.io";
import { Game } from "./models/game";
import fs from "fs";
import { Dropbox } from "dropbox";
import { plainToInstance } from "class-transformer";
import { Feedback } from "./models/feedback";

const dbx = new Dropbox({ accessToken: process.env.DBX_TOKEN });
class Storage {
  public games: Game[] = [];
  public feedbacks: Feedback[] = [];
  public io!: Server;

  removeGame(id: string) {
    this.games = this.games.filter((g) => g.id !== id);
    this.saveGames();
  }

  saveGames() {
    fs.writeFileSync("games.json", JSON.stringify(this.games, null, 2));
    dbx
      .filesUpload({
        path: "/games.json",
        mode: { ".tag": "overwrite" },
        contents: JSON.stringify(this.games, null, 2),
      })
      .catch((err) => {
        console.log("Error uploading games", err);
      });
  }

  async loadGames() {
    const games = await dbx
      .filesDownload({ path: "/games.json" })
      .catch((err) => console.log("Error loading games", err));
    if (games && games.result) {
      const tempGames: Object[] = JSON.parse((<any>games.result).fileBinary);
      this.games = plainToInstance(Game, tempGames);
    }
  }

  saveFeedbacks() {
    fs.writeFileSync("feedbacks.json", JSON.stringify(this.feedbacks, null, 2));
    dbx
      .filesUpload({
        path: "/feedbacks.json",
        mode: { ".tag": "overwrite" },
        contents: JSON.stringify(this.feedbacks, null, 2),
      })
      .catch((err) => {
        console.log("Error uploading feedbacks", err);
      });
  }

  async loadFeedbacks() {
    const feedbacks = await dbx
      .filesDownload({ path: "/feedbacks.json" })
      .catch((err) => console.log("Error loading feedbacks", err));
    if (feedbacks && feedbacks.result) {
      this.feedbacks = JSON.parse((<any>feedbacks.result).fileBinary);
    }
  }
}

export default new Storage();
