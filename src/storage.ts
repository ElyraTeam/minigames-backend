import { Server } from "socket.io";
import { Game } from "./models/game";
import fs from "fs";

class Storage {
  public games: Game[] = [];
  public io!: Server;

  removeGame(id: string) {
    this.games = this.games.filter((g) => g.id !== id);
  }

  saveGames() {
    fs.writeFileSync("games.json", JSON.stringify(this.games, null, 2));
  }
}

export default new Storage();
