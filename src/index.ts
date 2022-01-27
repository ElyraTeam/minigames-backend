import express, { NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import * as errors from "./utils/errors";
import cookieSession from "cookie-session";
import helmet from "helmet";
import hpp from "hpp";
import cors from "cors";
import morgan from "morgan";

import wordRouter from "./routes/wordRoutes";
import storage from "./storage";
import { nanoid } from "nanoid";
import { AuthenticateRequest } from "./models/socket";

const app = express();
const http = createServer(app);

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
    maxAge: 604800000,
    secure: true,
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

app.get("/", (req, res) => {
  res.status(200).send("All good!");
});

app.use("/assets", express.static("./static"));
app.use("/word", wordRouter);

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json(errors.unexpectedError);
  }
);

storage.io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on(
    "authenticate",
    (data: AuthenticateRequest, ack?: (res: string) => void) => {
      const game = storage.games.find((g) => g.id == data.roomId);
      if (game) {
        const player = game.getPlayerWithName(data.nickname);
        if (player && player.authToken === data.authToken) {
          socket.on("disconnect", () => {
            player.online = false;
            game.syncPlayers();
          });

          socket.on("chat", (msg) => {
            storage.io.to(game.id).emit("chat", player.nickname, msg);
          });

          player.online = true;
          socket.join(game.id);
          game.sync();
          game.syncOptions();
          game.syncPlayers();
          storage.saveGames();

          //player.socket = socket;
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
