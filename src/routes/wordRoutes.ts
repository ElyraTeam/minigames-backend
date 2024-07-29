import express from "express";
import * as basicAuth from "express-basic-auth";
import { nanoid } from "nanoid";
import env from "../env.js";
import { GameStats } from "../models/models.js";
import {
  CHARS_ARABIC,
  DEFAULT_CATEGORIES_ARABIC,
  State,
  WordGame,
  WordPlayer,
  WordRoomOptions,
} from "../models/word/game.js";
import storage from "../storage.js";
import * as errors from "../utils/errors.js";
import { ChatMessageBuilder } from "../utils/chat.js";
const router = express.Router();

const authOptions: basicAuth.BasicAuthMiddlewareOptions = {
  challenge: true,
  users: {
    admin: env.ADMIN_PASS,
  },
};

router.get("/stats", basicAuth.default(authOptions), (req, res) => {
  const stats: GameStats = {
    gameCount: storage.wordStorage.getGames().length,
    playerCount: storage.wordStorage
      .getGames()
      .reduce((acc, game) => acc + game.players.length, 0),
  };
  return res.status(200).json(stats);
});

router.get(
  "/room/debug/:roomId",
  basicAuth.default(authOptions),
  (req, res) => {
    const roomId = req.params.roomId;
    const game = storage.wordStorage.getGame(roomId);

    if (!game) {
      return res.status(404).json(errors.roomNotFound);
    }

    res.header("Content-Type", "application/json");
    return res.send(game.toJson());
  }
);

router.post("/room/create", (req, res) => {
  const defaultOptions: WordRoomOptions = {
    maxPlayers: 4,
    categories: DEFAULT_CATEGORIES_ARABIC,
    letters: CHARS_ARABIC,
    rounds: 5,
    isPrivate: true,
  };

  const roomId = nanoid(8);
  const game = new WordGame(roomId, req.session!.id!, defaultOptions);
  storage.wordStorage.addGame(game);

  return res.status(200).json({ roomId });
});

//check room exists
router.get("/room/check/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const nickname = req.query.nickname;
  const game = storage.wordStorage.getGame(roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  if (nickname) {
    const foundPlayer = game.getPlayerByNickname(nickname as string);
    if (foundPlayer) {
      if (foundPlayer.sessionId != req.session!.id) {
        return res.status(403).json(errors.nicknameInUse);
      }

      if (foundPlayer.sessionId == req.session!.id && foundPlayer.online) {
        return res.status(403).json(errors.alreadyInRoom);
      }
    }
  }

  return res.status(200).json({ roomId });
});

router.post("/room/join/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const { nickname } = req.body as { nickname: string };

  const game = storage.wordStorage.getGame(roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  const foundPlayer = game.getPlayerByNickname(nickname);
  if (foundPlayer) {
    if (foundPlayer.sessionId != req.session!.id) {
      return res.status(403).json(errors.nicknameInUse);
    }
    if (foundPlayer.sessionId == req.session!.id && foundPlayer.online) {
      return res.status(403).json(errors.alreadyInRoom);
    }
  }

  if (!foundPlayer && game.isFull()) {
    return res.status(403).json(errors.roomFull);
  }

  if (game.kickedPlayerSessions.includes(req.session!.id!)) {
    return res.status(403).json(errors.playerBanned);
  }

  let player: WordPlayer;
  let reconnect = false;
  const authToken = nanoid();
  if (foundPlayer) {
    player = foundPlayer;
    reconnect = true;
  } else {
    if (game.state != State.LOBBY) {
      return res.status(403).json(errors.gameRunning);
    }

    player = new WordPlayer(nickname, req.session!.id!, authToken);
    if (game.ownerId === player.sessionId) {
      player.ready = true;
    }
    game.players.push(player);
  }

  if (reconnect) {
    game.chat(
      ChatMessageBuilder.new("system", "system")
        .addText("عاد ")
        .addText(player.nickname, true)
        .addText(".")
        .build()
    );
  } else {
    game.chat(
      ChatMessageBuilder.new("system", "system")
        .addText("انضم ")
        .addText(player.nickname, true)
        .addText(".")
        .build()
    );
  }

  player.setAuthToken(authToken);

  storage.saveGames();

  game.syncRoom();
  game.syncPlayers();

  return res.status(200).json({
    roomId,
    roomOptions: game.options,
    authToken,
    playerId: player.sessionId,
  });
});

router.post("/room/leave/:roomId", (req, res) => {
  const roomId = req.params.roomId;

  const game = storage.wordStorage.getGame(roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  const foundPlayer = game.getPlayerBySessionId(req.session!.id!);
  if (!foundPlayer) {
    return res.status(404).json(errors.unknownPlayer);
  }

  game.leave(foundPlayer);
  storage.saveGames();

  game.syncRoom();
  game.syncPlayers();

  return res.status(204).end();
});

router.post("/room/kick/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  const { toKickId } = req.body as {
    toKickId: string;
  };

  const game = storage.wordStorage.getGame(roomId);

  if (!game) {
    return res.status(404).json(errors.roomNotFound);
  }

  const owner = game.getPlayerBySessionId(req.session!.id!);
  if (!owner) {
    return res.status(403).json(errors.noPermission);
  }

  const toKick = game.getPlayerBySessionId(toKickId);
  if (!toKick) {
    return res.status(404).json(errors.unknownPlayer);
  }

  if (owner.sessionId === toKick.sessionId) {
    return res.status(403).json(errors.cantKick);
  }

  game.kick(toKick);
  storage.saveGames();

  game.syncRoom();
  game.syncPlayers();
  return res.status(204).end();
});

// router.post("/room/options/:roomId", (req, res) => {
//   const roomId = req.params.roomId;
//   const { nickname, options } = req.body as {
//     nickname: string;
//     options: WordRoomOptions;
//   };

//   const game = storage.getGame(roomId);

//   if (!game) {
//     return res.status(404).json(errors.roomNotFound);
//   }

//   const owner = game.getPlayerByName(nickname);
//   if (!owner || owner.sessionId != req.session!.id) {
//     return res.status(404).json(errors.unknownPlayer);
//   }

//   if (!owner.owner) {
//     return res.status(403).json(errors.noPermission);
//   }

//   if (
//     options.maxPlayers < game.players.length ||
//     options.categories.length == 0 ||
//     options.letters.length == 0 ||
//     options.maxPlayers < 2 ||
//     options.rounds < 1
//   ) {
//     return res.status(403).json(errors.invalidRoomOptions);
//   }

//   game.options = options;

//   storage.saveGames();

//   game.sync();
//   game.syncOptions();

//   return res.status(204).end();
// });
export default router;
