import { Server } from "socket.io";
import { Game } from "./models/game";
import fs from "fs";

class Storage {
  public games: Game[] = [];
  public io!: Server;

  saveGames() {
    fs.writeFileSync("games.json", JSON.stringify(this.games, null, 2));
  }
}

export default new Storage();
