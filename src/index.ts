import express, { NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import * as errors from "./utils/errors";
import cookieSession from "cookie-session";

import wordRouter from "./routes/wordRoutes";
import storage from "./storage";
import { nanoid } from "nanoid";

const app = express();
const http = createServer(app);

storage.io = new Server(http);

const PORT = process.env.PORT || 3000;

const helmet = require("helmet");
const hpp = require("hpp");
const cors = require("cors");
const morgan = require("morgan");

app.set("trust proxy", "loopback");
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(hpp());
app.use(
  cors({
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(
  cookieSession({
    name: "session",
    //TODO: move secret
    secret: "37n6bfuZy&5uoXjJkhcfvfjlghbgkjunli",
    sameSite: "lax",
    maxAge: 604800000,
    //secure: !dev,
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

  socket.on("authenticate", (data: any) => {
    console.log(data);
  });
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
