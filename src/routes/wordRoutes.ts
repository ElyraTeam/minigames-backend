import express from "express";
const router = express.Router();
import { v4 as uuidv4 } from "uuid";

import * as errors from "../utils/errors";
import { nanoid } from "nanoid";
import { Game, Player, RoomOptions } from "../models/game";
import { games } from "../storage";

router.post("/room/create", (req, res) => {
  const body = req.body as { nickname: string; options: RoomOptions };

  //TODO: validate body

  const roomId = nanoid(8);
  const game = new Game(roomId, body.nickname, body.options);

  games.push(game);

  return res.status(200).json({ roomId });
});

router.post("/room/join/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const { nickname } = req.body as { nickname: string };

  const game = games.find((g) => g.id == roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  if (game.isFull()) {
    return res.status(403).json(errors.roomFull);
  }

  if (game.hasPlayerWithName(nickname)) {
    return res.status(403).json(errors.nicknameInUse);
  }

  const player = new Player(nickname, false);
  player.authToken = nanoid();
  game.players.push(player);

  return res
    .status(200)
    .json({ roomId, roomOptions: game.options, authToken: player.authToken });
});
export = router;
