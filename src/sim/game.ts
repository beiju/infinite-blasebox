import { Rng } from "@/sim/rng"
import { Item, Player, Team } from "@/chron"

export enum GamePhase {
  NotStarted,
  StartGame,
  StartHalfInning,
  BatterUp,
  Pitch,
  GameOver,
}

export function findPlayer(players: Item<Player>[], id: string) {
  const player = players.find(player => player.entityId == id)
  if (typeof player === "undefined") throw new Error("Unknown batter")
  return player
}

type Runner = {
  name: string,
  base: number,
}
export type GameState = {
  // This exists for react-y reasons
  start: boolean,
  // This is actually mostly used like a "next phase"
  phase: GamePhase,
  homeScore: number,
  top: boolean,
  awayScore: number,
  inning: number,
  lastUpdate: string,
  awayBatterIndex: number,
  homeBatterIndex: number,
  balls: number,
  strikes: number,
  outs: number,
  runners: Runner[],
}
const STANDARD_TICK = 5000
const SCORE_TICK = STANDARD_TICK * 2

// Makes a modulo function that behaves the way I want it to on negative numbers
export function mod(a: number, n: number) {
  return ((a % n) + n) % n
}

function describeHomeRun(numRunners: number) {
  if (numRunners == 1) return "solo"
  return `${numRunners}-run`
}

function chooseFielder(rng: Rng, players: Item<Player>[], team: Team) {
  const index = Math.floor(rng.next() * team.lineup.length)
  const id = team.lineup[index]
  return findPlayer(players, id)
}

function maybeAdvance(rng: Rng, runners: Runner[], threshold: number) {
  // Iterating backwards makes it much easier to deal with occupied bases
  let lastOccupiedBase = null
  for (let i = runners.length - 1; i >= 0; i--) {
    if ((lastOccupiedBase === null || lastOccupiedBase > runners[i].base + 1) && rng.next() < threshold) {
      runners[i].base += 1
    }
    lastOccupiedBase = runners[i].base
  }
}

function hit(state: GameState, batter: Item<Player>, bases: number, hitType: string) {
  state.runners.forEach(runner => runner.base += bases)
  state.lastUpdate = `${batter.data.name} hits a ${hitType}!`
  // This is like a push but it works with react's change detection
  state.runners = [...state.runners, { name: batter.data.name, base: bases }]
}

function pushRunners(runners: Runner[]) {
  let lastOccupiedBase = null
  for (const runner of runners) {
    if (lastOccupiedBase !== null && runner.base <= lastOccupiedBase) {
      runner.base = lastOccupiedBase + 1
    }
    lastOccupiedBase = runner.base
  }
}

function processOutsAndScores(state: GameState) {
  let numScores = 0
  if (state.outs >= 3) {
    state.outs = 0
    state.balls = 0
    state.strikes = 0
    state.runners = []

    // This is deceptively complicated and I'm not sure i got it right
    const endEarly = state.inning >= 8 && state.homeScore > state.awayScore
    const endNormal = state.inning >= 8 && !state.top && state.homeScore != state.awayScore
    if (endEarly || endNormal) {
      state.phase = GamePhase.GameOver
    } else {
      state.phase = GamePhase.StartHalfInning
    }
  } else {
    // Can't score on 3 outs
    state.runners = state.runners.filter(runner => {
      if (runner.base >= 4) {
        numScores += 1
        return false
      }
      return true
    })
    if (state.top) {
      state.awayScore += numScores
    } else {
      state.homeScore += numScores
    }
    if (numScores == 1) {
      state.lastUpdate += " 1 scores."
    } else if (numScores > 1) {
      state.lastUpdate += ` ${numScores}s score.`
    }
  }
  return numScores
}

export function baseToString(base: number) {
  switch (base) {
    case 1:
      return "first"
    case 2:
      return "second"
    case 3:
      return "third"
    case 4:
      return "fourth"
  }
  return ""
}

export function tickInner(rng: Rng, state: GameState, players: Item<Player>[], homeTeam: Team, awayTeam: Team, day: number) {
  if (state.start) {
    state.phase = GamePhase.NotStarted
    state.start = false
  }

  // Duplicated logic from the render because I'm afraid of synchronization issues if I pass those in
  const homePitcher = findPlayer(players, homeTeam.rotation[mod(day, homeTeam.rotation.length)])
  const awayPitcher = findPlayer(players, awayTeam.rotation[mod(day, awayTeam.rotation.length)])
  const homeBatter = findPlayer(players, homeTeam.lineup[mod(state.homeBatterIndex, homeTeam.lineup.length)])
  const awayBatter = findPlayer(players, awayTeam.lineup[mod(state.awayBatterIndex, awayTeam.lineup.length)])

  switch (state.phase) {
    case GamePhase.NotStarted:
      state.lastUpdate = "Let's go"
      state.phase = GamePhase.StartGame
      state.awayScore = 0
      state.homeScore = 0
      return 1000 // this is what it looks like from the outside
    case GamePhase.StartGame:
      // Set to the bottom of the 0th so that it advances correctly in StartHalfInning
      // This is what blaseball does too
      state.inning = -1
      state.top = false
      state.homeBatterIndex = -1
      state.awayBatterIndex = -1
      state.lastUpdate = "Play Ball!"
      state.phase = GamePhase.StartHalfInning
      return STANDARD_TICK
    case GamePhase.StartHalfInning:
      if (state.top) {
        state.top = false
        state.lastUpdate = `Bottom of ${state.inning + 1}, ${homeTeam.fullName} batting.`
      } else {
        state.top = true
        state.inning += 1
        state.lastUpdate = `Top of ${state.inning + 1}, ${awayTeam.fullName} batting.`
      }
      state.phase = GamePhase.BatterUp
      return STANDARD_TICK
    case GamePhase.BatterUp:
      if (state.top) {
        state.awayBatterIndex += 1
        const batter = findPlayer(players, awayTeam.lineup[mod(state.awayBatterIndex, awayTeam.lineup.length)])
        state.lastUpdate = `${batter.data.name} batting for the ${awayTeam.nickname}.`
      } else {
        state.homeBatterIndex += 1
        const batter = findPlayer(players, homeTeam.lineup[mod(state.homeBatterIndex, homeTeam.lineup.length)])
        state.lastUpdate = `${batter.data.name} batting for the ${homeTeam.nickname}.`
      }
      state.phase = GamePhase.Pitch
      return STANDARD_TICK
    case GamePhase.Pitch:
      const batter = state.top ? awayBatter : homeBatter
      // TODO: ALL THE FORMULAS
      // for no particular reason i'm implementing the s6 sim, which only allows the leading batter to steal
      if (state.runners.length > 0) {
        const steal = rng.next() < 0.05
        if (steal) {
          // This is for react's change detection
          state.runners = [...state.runners]
          const caught = rng.next() < 0.5
          if (caught) {
            state.lastUpdate = `${state.runners[0].name} gets caught stealing ${baseToString(state.runners[0].base + 1)} base.`
            state.outs += 1
            state.runners.splice(0, 1)
            processOutsAndScores(state)
            return STANDARD_TICK
          } else {
            state.runners[0].base += 1
            if (state.runners[0].base >= 4) {
              if (state.top) {
                state.awayScore += 1
              } else {
                state.homeScore += 1
              }
              state.lastUpdate = `${state.runners[0].name} steals home!`
              state.runners.splice(0, 1)
              return SCORE_TICK
            } else {
              state.lastUpdate = `${state.runners[0].name} steals ${baseToString(state.runners[0].base)} base!`
              return STANDARD_TICK
            }
          }
        }
      }
      const inStrikeZone = rng.next() < 0.5
      const batterSwings = rng.next() < (inStrikeZone ? 0.6 : 0.4)
      if (!batterSwings) {
        if (inStrikeZone) {
          // Strike! Umps are perfect actually
          state.strikes += 1
          state.lastUpdate = `Strike, looking. ${state.balls}-${state.strikes}`
        } else {
          // Ball
          state.balls += 1
          state.lastUpdate = `Ball. ${state.balls}-${state.strikes}`
        }
      } else {
        const contact = rng.next() < (inStrikeZone ? 0.5 : 0.2)
        if (!contact) {
          state.strikes += 1
          state.lastUpdate = `Strike, swinging. ${state.balls}-${state.strikes}`
        } else {
          const fair = rng.next() < 0.8
          if (!fair) {
            if (state.strikes < 2) state.strikes += 1
            state.lastUpdate = `Foul Ball. ${state.balls}-${state.strikes}`
          } else {
            // Everything beneath this in the decision tree gets the batter off the plate
            state.phase = GamePhase.BatterUp
            state.balls = 0
            state.strikes = 0
            const caught = rng.next() < 0.6
            if (caught) {
              const fly = rng.next() < 0.1
              if (fly) {
                // TODO Scoring/advancement on flyouts
                state.outs += 1
                const fielder = chooseFielder(rng, players, state.top ? homeTeam : awayTeam)
                state.lastUpdate = `${batter.data.name} hit a flyout to ${fielder.data.name}.`
              } else {
                // TODO FC/DP
                state.outs += 1
                const fielder = chooseFielder(rng, players, state.top ? homeTeam : awayTeam)
                state.lastUpdate = `${batter.data.name} hit a ground out to ${fielder.data.name}.`
                maybeAdvance(rng, state.runners, 0.1)
              }
            } else {
              const dinger = rng.next() < 0.1
              if (dinger) {
                if (state.top) {
                  state.awayScore += state.runners.length + 1
                } else {
                  state.homeScore += state.runners.length + 1
                }
                state.runners = []
                state.lastUpdate = `${batter.data.name} hits a ${describeHomeRun(state.runners.length)} home run!`
              } else {
                const triple = rng.next() < 0.15
                const double = !triple && rng.next() < 0.4
                if (triple) {
                  hit(state, batter, 3, "Triple")
                } else if (double) {
                  hit(state, batter, 2, "Double")
                } else {
                  hit(state, batter, 1, "Single")
                }
              }
            }
          }
        }
      }
      if (state.balls >= 4) {
        state.balls = 0
        state.strikes = 0
        state.runners = [...state.runners, { name: batter.data.name, base: 1 }]
        pushRunners(state.runners)
        state.lastUpdate = `${batter.data.name} draws a walk.`
        state.phase = GamePhase.BatterUp
      }

      if (state.strikes >= 3) {
        state.outs += 1
        state.balls = 0
        state.strikes = 0
      }
      let numScores = processOutsAndScores(state)

      return numScores > 0 ? SCORE_TICK : STANDARD_TICK
    case GamePhase.GameOver:
      state.lastUpdate = "Game over."
      return null // end ticking
  }

  throw new Error(`Unhandled state phase ${state.phase}`)
}