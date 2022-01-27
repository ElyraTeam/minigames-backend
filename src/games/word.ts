import { Socket } from "socket.io";
import { stringify } from "uuid";
import { Game, Player, State } from "../models/game";
import storage from "../storage";

export const registerPlayerSocket = (
  socket: Socket,
  game: Game,
  player: Player
) => {
  socket.on("chat", (msg) => {
    game.chat(player.nickname, msg);
  });

  socket.on("start-game", () => {
    console.log(player.owner, game.state);
    if (player.owner && game.state == State.LOBBY) {
      const letter = game.newRandomLetter();
      game.toAllPlayers().emit("start-timer", 3);

      setTimeout(() => {
        game.currentLetter = letter;
        game.state = State.INGAME;

        game.roundData.set(game.currentRound, {
          round: game.currentRound,
          letter: game.currentLetter,
          stopClicker: "",
          playerValues: new Map(),
          votes: new Map(),
          recievedVotes: [],
        });

        game.sync();
        storage.saveGames();
      }, 2200);
    }
  });

  socket.on("stop-game", () => {
    if (game.state != State.INGAME) return;

    const roundData = game.roundData.get(game.currentRound)!;
    roundData.stopClicker = player.nickname;

    game.state = State.WAITING;
    game.sync();
    storage.saveGames();

    game.players.forEach((p) => {
      //Values is a map of category => value
      p.getSocket()?.emit(
        "request-values",
        (values: { [name: string]: string }) => {
          //TODO: sanitize values
          roundData.playerValues.set(p.nickname, values);

          //Check if every player sent their data
          if (roundData.playerValues.size === game.players.length) {
            //Start voting process
            game.state = State.VOTING;
            game.sync();
            storage.saveGames();

            game.options.categories.forEach((category) => {
              let plrData: Map<string, string> = new Map();
              roundData.playerValues.forEach((val, key) => {
                const categoryValue = val[category];
                plrData.set(key, categoryValue);

                //TODO: calculate initial votes
                roundData.votes.set(key, 0);
              });

              const categoryData = {
                category,
                values: plrData,
                votes: roundData.votes,
              };
              game.toAllPlayers().emit("start-vote", categoryData);
            });
          }
        }
      );
    });
  });

  socket.on("vote", (voteData: Map<string, number>) => {
    if (game.state != State.VOTING) return;
    //Someone voted
    const roundData = game.roundData.get(game.currentRound)!;
    roundData.recievedVotes.push(player.nickname);

    if (roundData.recievedVotes.length === game.players.length) {
      //voting done, update final points and initiate new round
      game.state = State.LOBBY;
      game.currentLetter = "";
      game.currentRound++;
      game.sync();
      game.syncPlayers();
      storage.saveGames();
    }
  });
};
