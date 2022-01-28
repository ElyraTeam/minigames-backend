import express from "express";
const router = express.Router();

import * as errors from "../utils/errors";
import { nanoid } from "nanoid";
import { Game, Player, RoomOptions, State } from "../models/game";
import storage from "../storage";

router.get("/room/debug/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const game = storage.games.find((g) => g.id == roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  return res.status(200).json({ game });
});

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

  if (game.kickedPlayerSessions.includes(req.session!.id!)) {
    return res.status(403).json(errors.playerBanned);
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

router.post("/room/leave/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const { nickname } = req.body as { nickname: string };

  const game = storage.games.find((g) => g.id == roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  const foundPlayer = game.getPlayerWithName(nickname);
  if (!foundPlayer || foundPlayer.sessionId != req.session!.id) {
    return res.status(404).json(errors.unknownPlayer);
  }

  game.removePlayer(nickname);
  if (game.players.length == 0) {
    //last player, delete game;
    storage.removeGame(game.id);
  } else if (game.players.length > 0) {
    //find another owner, for now get next player
    if (foundPlayer.owner) {
      const newOwner = game.players[0];
      newOwner.owner = true;
      game.owner = newOwner.nickname;
    }
  }

  storage.saveGames();

  if (foundPlayer.socketId) {
    storage.io.sockets.sockets.get(foundPlayer.socketId)?.disconnect();
  }

  game.sync();
  game.syncPlayers();

  game.chat("system", foundPlayer.nickname + " left.");

  return res.status(204).end();
});

router.post("/room/kick/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const { ownerNickname, toKickNickname } = req.body as {
    ownerNickname: string;
    toKickNickname: string;
  };

  const game = storage.games.find((g) => g.id == roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  const owner = game.getPlayerWithName(ownerNickname);
  if (!owner || owner.sessionId != req.session!.id) {
    return res.status(404).json(errors.unknownPlayer);
  }

  if (!owner.owner) {
    return res.status(403).json(errors.noPermission);
  }

  const toKick = game.getPlayerWithName(toKickNickname);
  if (!toKick) {
    return res.status(404).json(errors.unknownPlayer);
  }

  if (owner.nickname === toKick.nickname) {
    return res.status(403).json(errors.cantKick);
  }

  game.kick(toKick);
  game.removePlayer(toKick.nickname);
  game.kickedPlayerSessions.push(toKick.sessionId);
  storage.saveGames();

  game.sync();
  game.syncPlayers();

  game.chat("system", toKick.nickname + " was kicked.");

  return res.status(204).end();
});

router.post("/room/options/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const { nickname, options } = req.body as {
    nickname: string;
    options: RoomOptions;
  };

  const game = storage.games.find((g) => g.id == roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  const owner = game.getPlayerWithName(nickname);
  if (!owner || owner.sessionId != req.session!.id) {
    return res.status(404).json(errors.unknownPlayer);
  }

  if (!owner.owner) {
    return res.status(403).json(errors.noPermission);
  }

  game.options = options;

  storage.saveGames();

  game.sync();
  game.syncOptions();

  return res.status(204).end();
});
export = router;
