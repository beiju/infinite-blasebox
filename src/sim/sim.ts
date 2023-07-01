import { Rng } from "@/sim/rng"
import { Item, Player, Team } from "@/chron"
import { GamePhase, GameState, startingGameState, tick } from "@/sim/game"
import { checkedGet } from "@/util"

export type SimState = {
  day: number
  games: GameState[]
  records: Map<string, { wins: number, losses: number }>
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
    }
    this.activeTimeouts = []
  }

  start(callback: (newState: SimState) => void) {
    this.state.games.forEach((game, gameIdx) => {
      const timeoutObject: TimeoutObject = { timeout: null }

      const onStateUpdate = (newState: GameState) => {
        const newGames = [...this.state.games]
        newGames[gameIdx] = newState

        this.state = {
          ...this.state,
          games: newGames,
        }
        callback(this.state)
      }

      const onGameEnd = (winnerId: string, loserId: string) => {
        checkedGet(this.state.records, winnerId).wins += 1
        checkedGet(this.state.records, loserId).losses += 1

        if (this.state.games.every(game => game.phase === GamePhase.GameOver)) {
          console.log("All games stopped for today")
          // reuse the timeout for one last delay
          timeoutObject.timeout = setTimeout(() => {
            // delete timeout because the next day gets a new one
            this.activeTimeouts = this.activeTimeouts.filter(t => t !== timeoutObject)

            this.state.day += 1
            if (this.state.day % 3 === 0) {
              this.state.games = getNewMatchups(this.rng, [...this.teams.values()])
            } else {
              this.state.games = this.state.games.map(game => startingGameState(game.homeTeam, game.awayTeam))
            }
            this.start(callback)
          }, 10 * 1000)
        } else {
          // lazy way to delete this timeout
          this.activeTimeouts = this.activeTimeouts.filter(t => t !== timeoutObject)
        }
      }

      tick(timeoutObject, this.rng, this.players, this.state.day, game, onStateUpdate, onGameEnd)
      this.activeTimeouts.push(timeoutObject)
    })
  }

  stop() {
    for (const timeout of this.activeTimeouts) {
      if (timeout.timeout !== null) {
        clearTimeout(timeout.timeout)
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