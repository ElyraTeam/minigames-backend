import express, { NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import * as errors from "./utils/errors";
import cookieSession from "cookie-session";
import helmet from "helmet";
import hpp from "hpp";
import cors from "cors";
import morgan from "morgan";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

import wordRouter from "./routes/wordRoutes";
import storage from "./storage";
import { nanoid } from "nanoid";
import { AuthenticateRequest } from "./models/socket";
import { registerPlayerSocket } from "./games/word";
import { State } from "./models/game";

const app = express();
const http = createServer(app);

Sentry.init({
  dsn: "https://9bdafc7f662f41f5bc0c846024ec92f4@o260487.ingest.sentry.io/6179839",
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],

  tracesSampleRate: 1.0,
});

const corsOptions = {
  origin: (origin: any, callback: (err: any, origin?: any) => void) => {
    callback(null, origin);
  },
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

storage.io = new Server(http, {
  cors: corsOptions,
});

const PORT = process.env.PORT || 3000;

app.set("trust proxy", "loopback");
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(hpp());
app.use(cors(corsOptions));
app.use(
  cookieSession({
    name: "session",
    //TODO: move secret
    secret: "37n6bfuZy&5uoXjJkhcfvfjlghbgkjunli",
    sameSite: "none",
    secureProxy: true,
    maxAge: 604800000,
    httpOnly: true,
  })
);
app.use(morgan("combined"));

//Assign random id to each session
app.use((req, res, next) => {
  if (!req.session) {
    req.session = {};
  }

  if (!req.session.id) {
    req.session.id = nanoid();
  }
  next();
});

app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

app.get("/", (req, res) => {
  res.status(200).send("All good!");
});

app.use("/assets", express.static("./static"));
app.use("/word", wordRouter);

app.use(Sentry.Handlers.errorHandler());

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: NextFunction
  ) => {
    console.error(err.stack);
    res
      .status(500)
      .json({ ...errors.unexpectedError, id: (res as any).sentry });
  }
);

storage.io.on("connection", (socket) => {
  socket.on(
    "authenticate",
    (data: AuthenticateRequest, ack?: (res: string) => void) => {
      const game = storage.games.find((g) => g.id == data.roomId);
      if (game) {
        const player = game.getPlayerWithName(data.nickname);
        if (player && player.authToken === data.authToken) {
          socket.on("disconnect", () => {
            player.socketId = undefined;
            player.online = false;
            player.offlineAt = Date.now();
            game.syncPlayers();
            storage.saveGames();
            setTimeout(() => {
              // console.log(
              //   player.nickname,
              //   Date.now(),
              //   player.offlineAt,
              //   player.offlineAt + 60 * 1000
              // );
              if (
                game.hasPlayerWithName(player.nickname) &&
                Date.now() >= player.offlineAt + 1 * 60 * 1000 &&
                player.online == false
              ) {
                game.removePlayerLogic(player.nickname);
                game.chat(
                  "system",
                  "تم طرد " + player.nickname + " لعدم النشاط."
                );
                game.syncPlayers();
                storage.saveGames();
              }
            }, 1 * 60 * 1000);
          });

          socket.on("ping", (cb) => {
            if (typeof cb === "function") cb();
          });

          player.offlineAt = 0;
          player.socketId = socket.id;
          player.online = true;

          socket.data.nickname = player.nickname;
          socket.data.sessionId = player.sessionId;

          registerPlayerSocket(socket, game, player);

          socket.join(game.id);

          if (game.state == State.VOTING) {
            socket.emit("start-vote", game.getCurrentCategoryVoteData());
            game.updatePlayerVotes();
            game.updateVoteCount();
          }

          game.sync();
          game.syncOptions();
          game.syncPlayers();
          storage.saveGames();
          if (ack) {
            ack("good");
          }
        }
      }
    }
  );
});

function loadData() {
  startServer();
}

function startServer() {
  console.log("Starting server..");
  http.listen(PORT, () => {
    console.log("listening on *:" + PORT);
  });
}

loadData();
