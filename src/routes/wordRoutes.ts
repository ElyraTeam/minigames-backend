import express from "express";
const router = express.Router();

import * as errors from "../utils/errors";
import { nanoid } from "nanoid";
import { Game, Player, RoomOptions, State } from "../models/game";
import storage from "../storage";

router.get("/stats", (req, res) => {
  const stats = {
    gameCount: storage.games.length,
    playerCount: storage.games.reduce(
      (total, g) => total + g.players.length,
      0
    ),
    players: storage.games.reduce(
      (total, g) => total.concat(g.players.map((p) => p.nickname) as never[]),
      []
    ),
    games: storage.games.map((g) => g.id),
  };
  return res.status(200).json(stats);
});

router.get("/room/debug/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const game = storage.games.find((g) => g.id == roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  res.header("Content-Type", "application/json");
  return res.send(game.toJson());
});

router.post("/room/create", (req, res) => {
  const body = req.body as { nickname: string; options: RoomOptions };

  if (
    body.options.categories.length == 0 ||
    body.options.letters.length == 0 ||
    body.options.maxPlayers < 2 ||
    body.options.rounds < 1
  ) {
    return res.status(403).json(errors.invalidRoomOptions);
  }

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

  const foundPlayer = game.getPlayerWithName(nickname);
  if (foundPlayer) {
    if (foundPlayer.sessionId != req.session!.id) {
      return res.status(403).json(errors.nicknameInUse);
    } else if (foundPlayer.sessionId == req.session!.id && foundPlayer.online) {
      return res.status(403).json(errors.alreadyInRoom);
    }
  }

  if (!foundPlayer && game.isFull()) {
    return res.status(403).json(errors.roomFull);
  }

  if (game.kickedPlayerSessions.includes(req.session!.id!)) {
    return res.status(403).json(errors.playerBanned);
  }

  let player: Player;
  let reconnect = false;
  if (foundPlayer) {
    player = foundPlayer;
    reconnect = true;
  } else {
    if (game.state != State.LOBBY) {
      return res.status(403).json(errors.gameRunning);
    }

    player = new Player(nickname, false, req.session!.id!);
    game.players.push(player);
  }
  player.authToken = nanoid();
  player.owner = player.nickname === game.owner;

  if (!reconnect) {
    game.chat("system", `انضم ${player.nickname}.`);
  }

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

  game.removePlayerLogic(nickname);
  storage.saveGames();

  if (foundPlayer.socketId) {
    storage.io.sockets.sockets.get(foundPlayer.socketId)?.disconnect();
  }

  game.sync();
  game.syncPlayers();

  game.chat("system", `خرج ${foundPlayer.nickname}.`);

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

  game.chat("system", `تم طرد ${toKick.nickname}.`);

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

  if (
    options.maxPlayers < game.players.length ||
    options.categories.length == 0 ||
    options.letters.length == 0 ||
    options.maxPlayers < 2 ||
    options.rounds < 1
  ) {
    return res.status(403).json(errors.invalidRoomOptions);
  }

  game.options = options;

  storage.saveGames();

  game.sync();
  game.syncOptions();

  return res.status(204).end();
});
export = router;
