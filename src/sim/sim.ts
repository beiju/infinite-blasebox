import { Rng } from "@/sim/rng"
import { Item, Player, Team } from "@/chron"
import { GamePhase, GameState, startingGameState, tick } from "@/sim/game"

const TICK = 5 * 1000


export type Universe = {
  origin: {
    season: number,
    day: number,
    offset: number,
  },
  sim: Sim,
}


export type SimState = {
  day: number
  games: GameState[]
  records: Map<string, { wins: number, losses: number }>
  tick: number,
  time: Date,
}

export type TimeoutObject = { timeout: ReturnType<typeof setTimeout> | null }

function getNewMatchups(rng: Rng, teams: Team[]): GameState[] {
  return pairwise(shuffle(teams, rng))
    .map(([homeTeam, awayTeam]) => startingGameState(homeTeam, awayTeam))
}

export class Sim {
  rng: Rng
  players: Map<string, Player>
  teams: Map<string, Team>

  // Everything that React needs to respond to should be in here
  state: SimState

  activeTimeouts: TimeoutObject[]

  constructor(seed1: bigint, seed2: bigint, players: Item<Player>[], teams: Item<Team>[]) {
    this.rng = new Rng(seed1, seed2)
    this.players = new Map(players.map(player => [player.entityId, player.data]))
    this.teams = new Map(teams.map(team => [team.entityId, team.data]))

    this.state = {
      day: 0,
      games: getNewMatchups(this.rng, [...this.teams.values()]),
      records: new Map(teams.map(team => [team.entityId, { wins: 0, losses: 0 }])),
      tick: 0,
      // Get the current time, floored to an even multiple of TICK
      time: new Date(Math.floor(new Date().getTime() / TICK) * TICK),
    }
    this.activeTimeouts = []
  }

  /**
   * Run the sim until the given goalTime. You probably want to pass in a time that's a multiple of TICK to get the most
   * up-to-date value. The most common way to use this is to pass it the value returned by `nextTickTime()`
   * @param goalTime
   */
  runToTime(goalTime: Date) {
    while (this.state.time < goalTime) {
      this._tick()
      this.state.tick += 1
      this.state.time = new Date(this.state.time.getTime() + TICK)
    }
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