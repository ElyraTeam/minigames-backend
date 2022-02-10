import { Server } from "socket.io";
import { Game } from "./models/game";
import fs from "fs";
import { Dropbox } from "dropbox";

const dbx = new Dropbox({ accessToken: process.env.DBX_TOKEN });
class Storage {
  public games: Game[] = [];
  public io!: Server;

  removeGame(id: string) {
    this.games = this.games.filter((g) => g.id !== id);
    this.saveGames();
  }

  saveGames() {
    fs.writeFileSync("games.json", JSON.stringify(this.games, null, 2));
    dbx.filesUpload({
      path: "/games.json",
      mode: { ".tag": "overwrite" },
      contents: JSON.stringify(this.games, null, 2),
    });
  }

  async loadGames() {
    const games = await dbx
      .filesDownload({ path: "/games.json" })
      .catch((err) => console.log("Error loading games", err));
    if (games && games.result) {
      this.games = JSON.parse((<any>games.result).fileBinary);
    }
  }
}

export default new Storage();
