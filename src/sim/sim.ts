import { RawRng, Rng } from "@/sim/rng"
import { Item, Player, Team } from "@/chron"
import { GamePhase, GameState, startingGameState, tick } from "@/sim/game"
import assert from "assert"

const TICK = 5 * 1000

export type Universe = {
  origin: {
    season: number,
    day: number,
    offset: number,
  },
  sim: Sim,
}

export type RawUniverse = {
  origin: {
    season: number,
    day: number,
    offset: number,
  },
  sim: RawSim,
}

export type RawSim = {
  rng: RawRng,
  players: { [id: string]: Player },
  teams: { [id: string]: Team },
  state: RawSimState,
}

export type SimState = {
  day: number
  games: GameState[]
  records: Map<string, { wins: number, losses: number }>
  tick: number,
  time: Date,
}

export type RawSimState = {
  day: number
  games: GameState[]
  records: { [key: string]: { wins: number, losses: number } }
  tick: number,
  time: number,
}

function getNewMatchups(rng: Rng, teams: Team[]): GameState[] {
  return pairwise(shuffle(teams, rng))
    .map(([homeTeam, awayTeam]) => startingGameState(homeTeam, awayTeam))
}

function incrementRecord(records: Map<string, { "wins": number, "losses": number }>, teamId: string, key: "wins" | "losses") {
  if (!records.has(teamId)) {
    records.set(teamId, { wins: 0, losses: 0 })
  }

  records.get(teamId)![key] += 1
}

export class Sim {
  rng: Rng
  players: Map<string, Player>
  teams: Map<string, Team>

  // Everything that React needs to respond to should be in here
  state: SimState

  static fromChron(seed1: bigint, seed2: bigint, chronPlayers: Item<Player>[], chronTeams: Item<Team>[]) {
    const rng = new Rng(seed1, seed2)
    const players = new Map(chronPlayers.map(player => [player.entityId, player.data]))
    const teams = new Map(chronTeams.map(team => [team.entityId, team.data]))

    for (const team of teams.values()) {
      for (const id of team.lineup) {
        assert(players.has(id))
      }
      for (const id of team.rotation) {
        assert(players.has(id))
      }
    }

    const state = {
      day: 0,
      games: getNewMatchups(rng, [...teams.values()]),
      records: new Map(chronTeams.map(team => [team.entityId, { wins: 0, losses: 0 }])),
      tick: 0,
      // Get the current time, floored to an even multiple of TICK
      time: new Date(Math.floor(new Date().getTime() / TICK) * TICK),
    }

    return new this(rng, players, teams, state)
  }

  static fromJSON(rawSim: RawSim) {
    const rng = Rng.fromJSON(rawSim.rng)
    const players = new Map(Object.entries(rawSim.players))
    const teams = new Map(Object.entries(rawSim.teams))
    const state: SimState = {
      day: rawSim.state.day,
      games: rawSim.state.games,
      records: new Map(Object.entries(rawSim.state.records)),
      tick: rawSim.state.tick,
      time: new Date(rawSim.state.time),
    }

    return new this(rng, players, teams, state)
  }


  constructor(rng: Rng, players: Map<string, Player>, teams: Map<string, Team>, state: SimState) {
    this.rng = rng
    this.players = players
    this.teams = teams
    this.state = state
  }

  toJSON(key: string): RawSim {
    return {
      rng: this.rng.toJSON(),
      players: Object.fromEntries(this.players.entries()),
      teams: Object.fromEntries(this.teams.entries()),
      state: {
        day: this.state.day,
        games: this.state.games,
        records: Object.fromEntries(this.state.records.entries()),
        tick: this.state.tick,
        time: this.state.time.getTime(),
      },
    }
  }

  /**
   * Run the sim until the given goalTime. You probably want to pass in a time that's a multiple of TICK to get the most
   * up-to-date value. The most common way to use this is to pass it the value returned by `nextTickTime()`
   * @param goalTime
   */
  runToTime(goalTime: Date) {
    let ticks = 0
    while (this.state.time < goalTime) {
      this._tick()
      this.state.tick += 1
      this.state.time = new Date(this.state.time.getTime() + TICK)
      ticks++
    }
    console.log("Ran", ticks, "tick(s)")
  }

  nextTickTime() {
    return new Date(this.state.time.getTime() + TICK)
  }

  private _tick() {
    let anyGameRunning = false
    for (let i = 0; i < this.state.games.length; i++) {
      this.state.games[i] = tick(this.rng, this.players, this.state.games[i])
      if (this.state.games[i].phase != GamePhase.GameOver) {
        anyGameRunning = true
      }
    }

    if (!anyGameRunning) {
      this.state.day += 1
      for (const game of this.state.games) {
        // breath mints i do NOT want to hear it
        if (game.homeScore > game.awayScore) {
          incrementRecord(this.state.records, game.homeTeam.id, "wins")
          incrementRecord(this.state.records, game.awayTeam.id, "losses")
        } else {
          incrementRecord(this.state.records, game.homeTeam.id, "losses")
          incrementRecord(this.state.records, game.awayTeam.id, "wins")

        }
      }

      if (this.state.day % 3 === 0) {
        this.state.games = getNewMatchups(this.rng, [...this.teams.values()])
      } else {
        this.state.games = this.state.games.map(game => startingGameState(game.homeTeam, game.awayTeam))
      }
    }
  }
}


// https://stackoverflow.com/a/2450976/522118
function shuffle<T>(array: T[], rng: Rng) {
  let currentIndex = array.length, randomIndex

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(rng.next() * currentIndex)
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]]
  }

  return array
}

function pairwise<T>(array: T[]): [T, T][] {
  const outer = []

  for (let i = 0; i < array.length; i += 2) {
    const inner = []
    for (let j = 0; j < 2; j += 1) {
      // this will error if the array is of odd length
      inner.push(array[i + j])
    }
    outer.push(inner)
  }

  // @ts-ignore
  return outer
}