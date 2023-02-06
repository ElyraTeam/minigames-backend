export enum MsDifficulty {
    EASY, // 9x9
    MEDIUM, // 16x16
    HARD, // 32x16
    CUSTOM
}

export interface MsRoomOptions {
    coop: boolean,
    difficulty: MsDifficulty
}

export class MsGame {
    public players?: MsPlayer[] = [];

    constructor(
        public id: string,
        public owner: MsPlayer,
        public options: MsRoomOptions
    ) { }
}

export class MsPlayer {

}