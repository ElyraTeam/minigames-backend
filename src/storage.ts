import { Server } from "socket.io";
import { Game } from "./models/game";

class Storage {
  public games: Game[] = [];
  public io!: Server;
}

export default new Storage();
