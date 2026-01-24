import * as Sentry from "@sentry/node";
import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import hpp from "hpp";
import { createServer } from "http";
import morgan from "morgan";
import "reflect-metadata";
import { Server } from "socket.io";

import { errors } from "./config/errors.js";
import env from "./env.js";
import { registerPlayerSocket } from "./games/word.js";
import { AuthenticateRequest } from "./models/base.js";
import AppError from "./models/error.js";
import { Feedback } from "./models/feedback.js";
import { State, WordGame, WordPlayer } from "./models/word/game.js";
import wordRouter from "./routes/wordRoutes.js";
import storage from "./storage.js";
import { errorHandler } from "./utils/errorHandler.js";
import jwt, { JwtPayload } from "jsonwebtoken";
import { nanoid } from "nanoid";

const app = express();
const http = createServer(app);

const corsOptions: cors.CorsOptions = {
  credentials: true,
  origin: true,
};

storage.io = new Server(http, {
  cors: corsOptions,
});

const setupExpressApp = async () => {
  app.enable("trust proxy");
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(hpp());
  app.use(morgan("combined"));
  app.use(cors(corsOptions));

  // const cookieMiddleware = cookieSession({
  //   name: "session",
  //   secret: env.COOKIE_SECRET,
  //   secure: isProd,
  //   maxAge: 604800000,
  //   httpOnly: true,
  //   sameSite: isProd ? "none" : "lax",
  // });
  // storage.io.engine.use(cookieMiddleware);
  // app.use(cookieMiddleware);
  // app.use(sessionMiddleware);

  setupRouters();

  setupErrorHandlers();
  errorHandler.listenToErrorEvents();
};

const setupRouters = () => {
  app.get("/", (req, res) => {
    res.status(200).send("All good!");
  });

  app.get("/token", async (req, res) => {
    const sessionId = nanoid();

    const token = jwt.sign({}, env.JWT_SECRET, {
      subject: sessionId,
      expiresIn: "7d",
    });

    return res.status(200).json({ token });
  });

  app.post("/feedback", (req, res) => {
    const feedback = req.body as Feedback;
    feedback.receivedAt = Date.now();

    if (!feedback.game || !feedback.message || !feedback.name) {
      throw errors.unexpected;
    }

    storage.feedbacks.push(feedback);
    storage.saveFeedbacks();
    return res.status(204).end();
  });

  app.use("/assets", express.static("./static"));
  app.use("/word", wordRouter);
};

const setupErrorHandlers = () => {
  Sentry.setupExpressErrorHandler(app);

  app.use((req, res, next) => {
    next(errors.notFound);
  });

  app.use(
    async (
      error: unknown,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      next(await errorHandler.handleError(error));
    },
  );

  app.use(
    async (
      error: AppError,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.status(error.statusCode).json({
        success: false,
        errorCode: error.errorCode,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        data: error.data,
      });
    },
  );
};

storage.io.use((socket, next) => {
  //TODO: Move to a middleware file
  const token = socket.handshake.auth.token;
  console.log("Token:", token);
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

      if (decoded.sub) {
        (socket.request as any).session = { id: decoded.sub as string };
        next();
      }
    } catch (err) {
      next(errors.invalidAuth);
    }
  }
});

storage.io.on("connection", (socket) => {
  socket.on(
    "authenticate",
    (data: AuthenticateRequest, ack?: (res: string) => void) => {
      const gameId = data.game;
      const gameRoom = storage.getStorageForGame(gameId).getGame(data.roomId);

      if (gameRoom) {
        console.log(
          "Authenticating game",
          gameRoom.id,
          (socket.request as any).session,
        );
        const player = gameRoom.getPlayerBySessionId(
          (socket.request as any).session.id,
        );
        console.log("Authenticating player", player?.nickname);
        //Word Specific
        if (
          player &&
          player.checkAuth(data.authToken) &&
          gameRoom instanceof WordGame &&
          player instanceof WordPlayer
        ) {
          socket.on("disconnect", () => {
            player.socketId = undefined;
            player.online = false;
            player.offlineAt = Date.now();
            gameRoom.syncPlayers();
            storage.saveGames();

            //   setTimeout(() => {
            //     if (
            //       game.hasPlayerWithName(player.nickname) &&
            //       player.offlineAt != 0 &&
            //       Date.now() >= player.offlineAt + 1 * 60 * 1000 &&
            //       player.online == false &&
            //       player.socketId == undefined
            //     ) {
            //       game.removePlayerLogic(player.nickname);
            //       game.chat(
            //         "system",
            //         "تم طرد " + player.nickname + " لعدم النشاط."
            //       );
            //       game.sync();
            //       game.syncPlayers();
            //       storage.saveGames();
            //     }
            //   }, 1 * 60 * 1000);
          });

          socket.on("ping", (cb) => {
            player.offlineAt = 0;
            if (typeof cb === "function") cb();
          });

          player.offlineAt = 0;
          player.socketId = socket.id;
          player.online = true;

          socket.data.nickname = player.nickname;
          socket.data.sessionId = player.sessionId;

          registerPlayerSocket(socket, gameRoom, player);

          socket.join(gameRoom.id);

          if (gameRoom.state == State.VOTING) {
            socket.emit("start-vote", gameRoom.getCurrentCategoryVoteData());
            gameRoom.updatePlayerVotes();
            gameRoom.updateVoteCount();
          }

          gameRoom.syncRoom();
          gameRoom.syncOptions();
          gameRoom.syncPlayers();

          if (gameRoom.state == State.GAME_OVER) {
            gameRoom.emitGameOver(player);
          }

          storage.saveGames();
          if (ack) {
            ack("good");
          }
        }
      }
    },
  );
});

const main = async () => {
  console.log("Environment: " + env.NODE_ENV);

  console.log("Loading data...");
  await Promise.all([storage.loadGames(), storage.loadFeedbacks()]);
  setupExpressApp();
  startServer();
};

const startServer = () => {
  const PORT = env.PORT || 4000;
  console.log("Starting server..");
  http.listen(PORT, () => {
    console.log("listening on *:" + PORT);
  });
};

main();
