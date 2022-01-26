import express from "express";
const router = express.Router();
import { v4 as uuidv4 } from "uuid";

import * as errors from "../utils/errors";
import { nanoid } from "nanoid";
import { Game, Player, RoomOptions, State } from "../models/game";
import storage from "../storage";

router.post("/room/create", (req, res) => {
  const body = req.body as { nickname: string; options: RoomOptions };

  //TODO: validate body

  const roomId = nanoid(8);
  const game = new Game(roomId, body.nickname, body.options);

  storage.games.push(game);
  storage.saveGames();

  return res.status(200).json({ roomId });
});

router.post("/room/join/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const { nickname } = req.body as { nickname: string };

  const game = storage.games.find((g) => g.id == roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  if (game.isFull()) {
    return res.status(403).json(errors.roomFull);
  }

  const foundPlayer = game.getPlayerWithName(nickname);
  if (foundPlayer && foundPlayer.sessionId != req.session!.id) {
    return res.status(403).json(errors.nicknameInUse);
  }

  let player: Player;
  if (foundPlayer) {
    player = foundPlayer;
  } else {
    if (game.state != State.LOBBY) {
      return res.status(403).json(errors.gameRunning);
    }

    player = new Player(nickname, false, req.session!.id!);
    game.players.push(player);
  }
  player.authToken = nanoid();
  player.owner = player.nickname === game.owner;

  storage.saveGames();

  game.sync();
  game.syncPlayers();

  return res
    .status(200)
    .json({ roomId, roomOptions: game.options, authToken: player.authToken });
});
export = router;
