import type {InferGetStaticPropsType, GetStaticProps} from 'next'
import {Dispatch, SetStateAction, useEffect, useMemo, useState} from "react";

type ChronResponse<ItemType> = {
    nextPage: string | null,
    items: ItemType[]
}

type Item<DataType> = {
    entityId: string,
    hash: string,
    validFrom: string,
    validTo: string | null,
    data: DataType
}

type Team = {
    id: string,
    bench: string[],
    emoji: string,
    lineup: string[],
    slogan: string,
    bullpen: string[],
    fullName: string,
    gameAttr: string[],
    location: string,
    nickname: string,
    permAttr: string[],
    rotation: string[],
    seasAttr: string[],
    weekAttr: string[],
    mainColor: string,
    shameRuns: number,
    shorthand: string,
    totalShames: number,
    seasonShames: number,
    championships: number,
    totalShamings: number,
    seasonShamings: number,
    secondaryColor: string,
}

type Player = {
    id: string,
    bat: string,
    fate: number,
    name: string,
    soul: number,
    armor: string,
    blood: number,
    moxie: number,
    coffee: number,
    ritual: string,
    buoyancy: number,
    cinnamon: number,
    coldness: number,
    deceased: boolean,
    divinity: number,
    gameAttr: string[],
    permAttr: string[],
    seasAttr: string[],
    weekAttr: string[],
    chasiness: number,
    martyrdom: number,
    baseThirst: number,
    indulgence: number,
    musclitude: number,
    tragicness: number,
    omniscience: number,
    patheticism: number,
    suppression: number,
    continuation: number,
    ruthlessness: number,
    totalFingers: number,
    watchfulness: number,
    laserlikeness: number,
    overpowerment: number,
    peanutAllergy: boolean,
    tenaciousness: number,
    thwackability: number,
    anticapitalism: number,
    groundFriction: number,
    pressurization: number,
    unthwackability: number,
    shakespearianism: number,
}

async function chroniclerFetch<DataType>(type: string, at: string) {
    // Could do pagination in here... or just be lazy and use a huge count
    const res = await fetch(`https://api.sibr.dev/chronicler/v2/entities?type=${type}&at=${at}&count=1000`)
    const obj: ChronResponse<Item<DataType>> = await res.json()
    return obj.items
}

export const getStaticProps: GetStaticProps<{
    teams: Team[], players: Player
}> = async () => {
    const teamsPromise = chroniclerFetch<Team>("team", "2020-09-07T16:09:04.026Z")
    const playersPromise = chroniclerFetch<Player>("player", "2020-09-07T16:09:04.026Z")
    const [teams, players] = await Promise.all([teamsPromise, playersPromise])
    // I did not think about the cultural sensitivity fixes when I picked this season
    for (const team of teams) {
        if (team.data.nickname === "Dalé") team.data.nickname = "Dale"
        if (team.data.location === "Hawai'i") team.data.nickname = "Hawaii"
    }
    return {props: {teams, players}}
}

class Rng {
    state0: bigint;
    state1: bigint;

    constructor(seed0: bigint, seed1: bigint) {
        // TODO is this the best way to seed it?
        this.state0 = seed0
        this.state1 = seed1
    }

    next() {
        [this.state0, this.state1] = xs128p(this.state0, this.state1)
        return state_to_double(this.state0)
    }
}

const STATE_MASK = 0xFFFFFFFFFFFFFFFFn;

function xs128p(state0: bigint, state1: bigint) {
    let s1 = state0 & STATE_MASK;
    let s0 = state1 & STATE_MASK;
    s1 ^= (s1 << 23n) & STATE_MASK;
    s1 ^= (s1 >> 17n) & STATE_MASK;
    s1 ^= s0 & STATE_MASK;
    s1 ^= (s0 >> 26n) & STATE_MASK;
    state0 = state1 & STATE_MASK;
    state1 = s1 & STATE_MASK;
    return [state0, state1];
}

function state_to_double(s0: bigint) {
    const dataView = new DataView((new Float64Array(1)).buffer);
    const mantissa = s0 >> 12n;
    dataView.setBigInt64(0, mantissa | 0x3FF0000000000000n);
    return dataView.getFloat64(0) - 1;
}

enum GamePhase {
    NotStarted,
    StartGame,
    StartHalfInning,
    BatterUp,
    Pitch,
    GameOver,
}

function findPlayer(players: Item<Player>[], id: string) {
    const player = players.find(player => player.entityId == id)
    if (typeof player === "undefined") throw new Error("Unknown batter")
    return player
}

type Runner = {
    name: string,
    base: number,
}

type GameState = {
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

const STANDARD_TICK = 5000 // Made shorter for testing
const SCORE_TICK = STANDARD_TICK * 2

// Makes a modulo function that behaves the way I want it to on negative numbers
function mod(a: number, n: number) {
    return ((a % n) + n) % n;
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
    state.runners = [...state.runners, {name: batter.data.name, base: bases}]
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

function tickInner(rng: Rng, state: GameState, players: Item<Player>[], homeTeam: Team, awayTeam: Team, day: number) {
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
                const steal = rng.next() < 0.02
                if (steal) {
                    state.runners[0].base += 1
                    if (state.runners[0].base >= 4) {
                        if (state.top) {
                            state.awayScore += 1
                        } else {
                            state.homeScore += 1
                        }
                        state.runners.splice(0, 1)
                        // This is for react's change detection
                        state.runners = [...state.runners]
                        // This is the only early return in this whole case (as of when I'm typing this)
                        return SCORE_TICK
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
                state.runners = [...state.runners, {name: batter.data.name, base: 1}]
                pushRunners(state.runners)
                state.lastUpdate = `${batter.data.name} draws a walk.`
            }

            if (state.strikes >= 3) {
                state.outs += 1
                state.balls = 0
                state.strikes = 0
            }

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

            return numScores > 0 ? SCORE_TICK : STANDARD_TICK
        case GamePhase.GameOver:
            state.lastUpdate = "Game over."
            return null // end ticking
    }

    throw new Error(`Unhandled state phase ${state.phase}`)
}

type TimeoutObject = { timeout: ReturnType<typeof setTimeout> | null };

function tickOuter(rng: Rng, setGameState: Dispatch<SetStateAction<GameState>>, players: Item<Player>[], homeTeam: Team, awayTeam: Team, day: number, gameIndex: number, onGameEnd: (day: number, gameIndex: number) => void): TimeoutObject {
    const timeoutInfo: TimeoutObject = {timeout: null}
    setGameState((prevState) => {
        // Copy state object because the one that's passed in has to be immutable
        const state: GameState = {...prevState}

        const delay = tickInner(rng, state, players, homeTeam, awayTeam, day)
        if (delay !== null) {
            timeoutInfo.timeout = setTimeout(() => tickOuter(rng, setGameState, players, homeTeam, awayTeam, day, gameIndex, onGameEnd), delay)
        } else {
            onGameEnd(day, gameIndex)
        }
        console.log(`${awayTeam.nickname} @ ${homeTeam.nickname}: ${state.lastUpdate}`)
        return state
    })
    return timeoutInfo
}

function baseToString(base: number) {
    switch (base) {
        case 1:
            return "first"
        case 2:
            return "second"
        case 3:
            return "third"
    }
    return ""
}

function Game({teams, players, day, rng, gameIndex, onGameEnd}: {
    teams: [Team, Team],
    players: Item<Player>[],
    day: number,
    rng: Rng,
    gameIndex: number,
    onGameEnd: (day: number, gameIndex: number) => void
}) {
    const [awayTeam, homeTeam] = teams
    const [gameState, setGameState] = useState<GameState>({
        // this needs to be separate from the start phase because it needs to trigger an effect only when a game
        // is starting, not whenever the phase changes
        start: false,
        // Start as if a previous game just ended so the game start code can kick things off
        phase: GamePhase.GameOver,
        inning: 0,
        top: true,
        homeScore: 0,
        awayScore: 0,
        homeBatterIndex: 0,
        awayBatterIndex: 0,
        lastUpdate: "",
        balls: 0,
        strikes: 0,
        outs: 0,
        runners: [],
    })

    // uh oh i'm starting to feel like i'm lost in the sauce with effects. anyway this is how changing the passed-in day
    // kicks the next round of games off
    useEffect(() => {
        if (day >= 0) {
            // oh god it's getting worse
            setGameState(state => ({...state, start: true,}))
        }
    }, [day])

    useEffect(() => {
        // Tick uses state, but it uses it through the functional form of the setter. Otherwise the dependencies
        // would be all topsy-turvy
        const timeoutObject = tickOuter(rng, setGameState, players, homeTeam, awayTeam, day, gameIndex, onGameEnd)
        return () => {
            if (timeoutObject.timeout !== null) clearTimeout(timeoutObject.timeout)
        }
    }, [rng, players, homeTeam, awayTeam, day, gameState.start])

    const homePitcher = useMemo(() => {
        return findPlayer(players, homeTeam.rotation[mod(day, homeTeam.rotation.length)]);
    }, [homeTeam, players, day])

    const awayPitcher = useMemo(() => {
        return findPlayer(players, awayTeam.rotation[mod(day, awayTeam.rotation.length)]);
    }, [awayTeam, players, day])

    const homeBatter = useMemo(() => {
        return findPlayer(players, homeTeam.lineup[mod(gameState.homeBatterIndex, homeTeam.lineup.length)]);
    }, [homeTeam, players, gameState.homeBatterIndex])

    const awayBatter = useMemo(() => {
        return findPlayer(players, awayTeam.lineup[mod(gameState.awayBatterIndex, awayTeam.lineup.length)]);
    }, [awayTeam, players, gameState.awayBatterIndex])

    return (
        <div className="GameWidget">
            <div className="GameWidget-Full-Live">
                <div className="GameWidget-Header-Wrapper">
                    <div className="GameWidget-Header">
                        <div className="GameWidget-StatusBar">
                            <div className="GameWidget-Status GameWidget-Status--Live">Live - {gameState.inning + 1}
                                {gameState.top ? "▲" : "▼"}
                            </div>
                            {/* TODO Weather */}
                            {/*                        <div className="WeatherIcon"*/}
                            {/*                             style={{"color": "rgb(255, 31, 60)", "background": "rgb(82, 5, 15)"}}>*/}
                            {/*                            <svg stroke="currentColor" fill="currentColor" strokeWidth="0"*/}
                            {/*                                 version="1.1" id="Layer_1" x="0px" y="0px"*/}
                            {/*                                 viewBox="0 0 30 30" height="1em" width="1em"*/}
                            {/*                                 xmlns="http://www.w3.org/2000/svg">*/}
                            {/*                                <path d="M4.64,16.91c0-1.15,0.36-2.17,1.08-3.07c0.72-0.9,1.63-1.47,2.73-1.73c0.31-1.36,1.02-2.48,2.11-3.36s2.34-1.31,3.75-1.31*/}
                            {/*c1.38,0,2.6,0.43,3.68,1.28c1.08,0.85,1.78,1.95,2.1,3.29h0.32c0.89,0,1.72,0.22,2.48,0.65s1.37,1.03,1.81,1.78*/}
                            {/*c0.44,0.75,0.67,1.58,0.67,2.47c0,0.88-0.21,1.69-0.63,2.44c-0.42,0.75-1,1.35-1.73,1.8c-0.73,0.45-1.53,0.69-2.4,0.71*/}
                            {/*c-0.13,0-0.2-0.06-0.2-0.17v-1.33c0-0.12,0.07-0.18,0.2-0.18c0.85-0.04,1.58-0.38,2.18-1.02s0.9-1.39,0.9-2.26s-0.33-1.62-0.98-2.26*/}
                            {/*s-1.42-0.96-2.31-0.96h-1.61c-0.12,0-0.18-0.06-0.18-0.17l-0.08-0.58c-0.11-1.08-0.58-1.99-1.39-2.71*/}
                            {/*c-0.82-0.73-1.76-1.09-2.85-1.09c-1.09,0-2.05,0.36-2.85,1.09c-0.81,0.73-1.26,1.63-1.36,2.71l-0.07,0.53c0,0.12-0.07,0.19-0.2,0.19*/}
                            {/*l-0.53,0.03c-0.83,0.1-1.53,0.46-2.1,1.07s-0.85,1.33-0.85,2.16c0,0.87,0.3,1.62,0.9,2.26s1.33,0.98,2.18,1.02*/}
                            {/*c0.11,0,0.17,0.06,0.17,0.18v1.33c0,0.11-0.06,0.17-0.17,0.17c-1.34-0.06-2.47-0.57-3.4-1.53S4.64,18.24,4.64,16.91z M9.99,23.6*/}
                            {/*c0-0.04,0.01-0.11,0.04-0.2l1.63-5.77c0.06-0.19,0.17-0.34,0.32-0.44c0.15-0.1,0.31-0.15,0.46-0.15c0.07,0,0.15,0.01,0.24,0.03*/}
                            {/*c0.24,0.04,0.42,0.17,0.54,0.37c0.12,0.2,0.15,0.42,0.08,0.67l-1.63,5.73c-0.12,0.43-0.4,0.64-0.82,0.64*/}
                            {/*c-0.04,0-0.07-0.01-0.11-0.02c-0.06-0.02-0.09-0.03-0.1-0.03c-0.22-0.06-0.38-0.17-0.49-0.33C10.04,23.93,9.99,23.77,9.99,23.6z*/}
                            {/* M12.61,26.41l2.44-8.77c0.04-0.19,0.14-0.34,0.3-0.44c0.16-0.1,0.32-0.15,0.49-0.15c0.09,0,0.18,0.01,0.27,0.03*/}
                            {/*c0.22,0.06,0.38,0.19,0.49,0.39c0.11,0.2,0.13,0.41,0.07,0.64l-2.43,8.78c-0.04,0.17-0.13,0.31-0.29,0.43*/}
                            {/*c-0.16,0.12-0.32,0.18-0.51,0.18c-0.09,0-0.18-0.02-0.25-0.05c-0.2-0.05-0.37-0.18-0.52-0.39C12.56,26.88,12.54,26.67,12.61,26.41z*/}
                            {/* M16.74,23.62c0-0.04,0.01-0.11,0.04-0.23l1.63-5.77c0.06-0.19,0.16-0.34,0.3-0.44c0.15-0.1,0.3-0.15,0.46-0.15*/}
                            {/*c0.08,0,0.17,0.01,0.26,0.03c0.21,0.06,0.36,0.16,0.46,0.31c0.1,0.15,0.15,0.31,0.15,0.47c0,0.03-0.01,0.08-0.02,0.14*/}
                            {/*s-0.02,0.1-0.02,0.12l-1.63,5.73c-0.04,0.19-0.13,0.35-0.28,0.46s-0.32,0.17-0.51,0.17l-0.24-0.05c-0.2-0.06-0.35-0.16-0.46-0.32*/}
                            {/*C16.79,23.94,16.74,23.78,16.74,23.62z"></path>*/}
                            {/*                            </svg>*/}
                            {/*                        </div>*/}
                        </div>
                        <div
                            className="GameWidget-ScoreLabel GameWidget-ScoreLabel--Series">Game
                            -1 of NaN
                        </div>
                    </div>
                    <div className="GameWidget-ScoreBacking"><a className="GameWidget-ScoreLine"
                                                                href="#">
                        <div className="GameWidget-ScoreTeamColorBar"
                             style={{"background": awayTeam.mainColor}}>{String.fromCodePoint(parseInt(awayTeam.emoji))}
                        </div>
                        <div className="GameWidget-ScoreTeam">
                            <div className="GameWidget-ScoreName"
                                 style={{"color": awayTeam.mainColor}}>{awayTeam.nickname}
                            </div>
                            <div className="GameWidget-ScoreTeamInfo">
                                <div className="GameWidget-ScoreRecord">0-0</div>
                                <span className="GameWidget-AllBetInfo"><div
                                    className="GameWidget-WinChance"
                                    style={{"color": awayTeam.mainColor}}>??%</div></span></div>
                        </div>
                        <div className="GameWidget-ScoreNumber">{gameState.awayScore}</div>
                    </a><a className="GameWidget-ScoreLine"
                           href="#">
                        <div className="GameWidget-ScoreTeamColorBar"
                             style={{"background": homeTeam.mainColor}}>{String.fromCodePoint(parseInt(homeTeam.emoji))}
                        </div>
                        <div className="GameWidget-ScoreTeam">
                            <div className="GameWidget-ScoreName"
                                 style={{"color": homeTeam.mainColor}}>{homeTeam.nickname}
                            </div>
                            <div className="GameWidget-ScoreTeamInfo">
                                <div className="GameWidget-ScoreRecord">0-0</div>
                                <span className="GameWidget-AllBetInfo"><div
                                    className="GameWidget-WinChance"
                                    style={{"color": homeTeam.mainColor}}>??%</div></span></div>
                        </div>
                        <div className="GameWidget-ScoreNumber">{gameState.homeScore}</div>
                    </a></div>
                </div>
                <div className="GameWidget-Display-Visual">
                    <div className="GameWidget-Display-Body">
                        <div
                            className={"GameWidget-Bases " + gameState.runners.map(runner => baseToString(runner.base)).join(" ")}>
                            <div id="tooltip" style={{"display": "none", "position": "absolute"}}></div>
                            <svg viewBox="0 0 255 197" version="1.1">
                                <g id="base1" className="st0"
                                   transform="matrix(0.7071,-0.7071,0.7071,0.7071,-40.4706,152.625)">
                                    <rect x="141.95" y="105.74" width="70.31"
                                          height="70.31"></rect>
                                </g>
                                <g id="base2" className="st0"
                                   transform="matrix(0.7071,-0.7071,0.7071,0.7071,-16.7558,95.4764)">
                                    <rect x="84.83" y="48.54" width="70.31"
                                          height="70.31"></rect>
                                </g>
                                <g id="base3" className="st0"
                                   transform="matrix(0.7071,-0.7071,0.7071,0.7071,-74.0296,71.6061)">
                                    <rect x="27.38" y="105.74" width="70.31"
                                          height="70.31"></rect>
                                </g>
                            </svg>
                        </div>
                        <div className="GameWidget-Outs">
                            <div className="GameWidget-Outs-Row">
                                <div className="GameWidget-Outs-Label">Balls</div>
                                <div className="GameWidget-Outs-DotList">
                                    <div className="GameWidget-Outs-Dots">{gameState.balls >= 1 ? "●" : "○"}</div>
                                    <div className="GameWidget-Outs-Dots">{gameState.balls >= 2 ? "●" : "○"}</div>
                                    <div className="GameWidget-Outs-Dots">{gameState.balls >= 3 ? "●" : "○"}</div>
                                </div>
                            </div>
                            <div className="GameWidget-Outs-Row">
                                <div className="GameWidget-Outs-Label">Strikes</div>
                                <div className="GameWidget-Outs-DotList">
                                    <div className="GameWidget-Outs-Dots">{gameState.strikes >= 1 ? "●" : "○"}</div>
                                    <div className="GameWidget-Outs-Dots">{gameState.strikes >= 2 ? "●" : "○"}</div>
                                </div>
                            </div>
                            <div className="GameWidget-Outs-Row">
                                <div className="GameWidget-Outs-Label">Outs</div>
                                <div className="GameWidget-Outs-DotList">
                                    <div className="GameWidget-Outs-Dots">{gameState.outs >= 1 ? "●" : "○"}</div>
                                    <div className="GameWidget-Outs-Dots">{gameState.outs >= 2 ? "●" : "○"}</div>
                                </div>
                            </div>
                        </div>
                        <div className="GameWidget-AtBat">
                            <div className="GameWidget-PlayerLine">
                                <div
                                    className="GameWidget-PlayerStatusIcon GameWidget-PlayerStatusIcon--Pitching"></div>
                                <div className="GameWidget-PlayerStatusLabel">Pitching</div>
                                <div className="GameWidget-PlayerLineNameWrapper"
                                     style={{"background": gameState.top ? homeTeam.mainColor : awayTeam.mainColor}}><a
                                    className="GameWidget-PlayerLineName"
                                    href="#">
                                    {gameState.top ? homePitcher.data.name : awayPitcher.data.name}
                                </a></div>
                            </div>
                            <div className="GameWidget-PlayerLine">
                                <div
                                    className="GameWidget-PlayerStatusIcon GameWidget-PlayerStatusIcon--Batting"></div>
                                <div className="GameWidget-PlayerStatusLabel">Batting</div>
                                <div className="GameWidget-PlayerLineNameWrapper"
                                     style={{"background": gameState.top ? awayTeam.mainColor : homeTeam.mainColor}}><a
                                    className="GameWidget-PlayerLineName"
                                    href="#">
                                    {gameState.top ? awayBatter.data.name : homeBatter.data.name}
                                </a></div>
                            </div>
                        </div>
                        <div className="GameWidget-Log">{gameState.lastUpdate}
                        </div>
                    </div>
                </div>
                <div className="GameWidget-Log">
                    <div className="GameWidget-Log-Header">Game Log</div>
                    <div className="GameWidget-Log-Content">{gameState.lastUpdate}
                    </div>
                </div>
            </div>
        </div>
    )
}

// https://stackoverflow.com/a/2450976/522118
function shuffle<T>(array: T[], rng: Rng) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(rng.next() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

function pairwise<T>(array: T[]) {
    const outer = []

    for (let i = 0; i < array.length; i += 2) {
        const inner = []
        for (let j = 0; j < 2; j += 1) {
            // this will error if the array is of odd length
            inner.push(array[i + j])
        }
        outer.push(inner)
    }

    return outer
}

export default function Games({
                                  teams, players,
                              }: InferGetStaticPropsType<typeof getStaticProps>) {
    const rng = new Rng(1398547n, 382746019348n) // chosen by random keysmash
    const games = pairwise(shuffle(teams.map(t => t.data), rng))
    const [state, setState] = useState({
        day: 0,
        gameRunning: games.map(_ => true),
    })

    function onGameEnd(day: number, gameIndex: number) {
        setState(prevState => {
            // Protect against callback order issues
            if (day !== prevState.day) return prevState

            const state = {...prevState}
            state.gameRunning[gameIndex] = false
            if (!state.gameRunning.some(v => v)) {
                // This is what kicks off the next day of games
                // There could be a timeout here, I haven't made up my mind yet
                state.day += 1
                state.gameRunning = state.gameRunning.map(_ => true)
            }
            return state
        })
    }

    return (
        <div id="root">
            <div className="Main">
                <header className="Header">
                    <div className="Header-Links">
                        <h1 className="Header-Logo">Blaseball
                            <div className="Header-Logo-Tag">OMEGA</div>
                            <div className="Header-Logo-Era" style={{"color": "rgb(255, 0, 0)"}}>Taste The Infinite
                            </div>
                            <div className="Header-Logo-SubEra" style={{"color": "rgb(255, 224, 130)"}}>RIV</div>
                        </h1>
                        <div className="Header-Social">
                            <div className="Header-Social-Patreon">
                                <div className="Header-Social-Patreon-Inner"><a className="Header-Social-Patreon-Icon"
                                                                                href="#"
                                                                                target="_blank">PATREON</a></div>
                            </div>
                            <div className="Header-Social-Follow">
                                <div className="Header-Social-Follow-Inner"><a className="Header-Social-Follow-Icon"
                                                                               href="#"
                                                                               target="_blank">
                                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0"
                                         viewBox="0 0 448 512" height="1em" width="1em"
                                         xmlns="http://www.w3.org/2000/svg">
                                        <path
                                            d="M297.216 243.2c0 15.616-11.52 28.416-26.112 28.416-14.336 0-26.112-12.8-26.112-28.416s11.52-28.416 26.112-28.416c14.592 0 26.112 12.8 26.112 28.416zm-119.552-28.416c-14.592 0-26.112 12.8-26.112 28.416s11.776 28.416 26.112 28.416c14.592 0 26.112-12.8 26.112-28.416.256-15.616-11.52-28.416-26.112-28.416zM448 52.736V512c-64.494-56.994-43.868-38.128-118.784-107.776l13.568 47.36H52.48C23.552 451.584 0 428.032 0 398.848V52.736C0 23.552 23.552 0 52.48 0h343.04C424.448 0 448 23.552 448 52.736zm-72.96 242.688c0-82.432-36.864-149.248-36.864-149.248-36.864-27.648-71.936-26.88-71.936-26.88l-3.584 4.096c43.52 13.312 63.744 32.512 63.744 32.512-60.811-33.329-132.244-33.335-191.232-7.424-9.472 4.352-15.104 7.424-15.104 7.424s21.248-20.224 67.328-33.536l-2.56-3.072s-35.072-.768-71.936 26.88c0 0-36.864 66.816-36.864 149.248 0 0 21.504 37.12 78.08 38.912 0 0 9.472-11.52 17.152-21.248-32.512-9.728-44.8-30.208-44.8-30.208 3.766 2.636 9.976 6.053 10.496 6.4 43.21 24.198 104.588 32.126 159.744 8.96 8.96-3.328 18.944-8.192 29.44-15.104 0 0-12.8 20.992-46.336 30.464 7.68 9.728 16.896 20.736 16.896 20.736 56.576-1.792 78.336-38.912 78.336-38.912z"></path>
                                    </svg>
                                </a><a className="Header-Social-Follow-Icon" href="#"
                                       target="_blank">
                                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0"
                                         viewBox="0 0 512 512" height="1em" width="1em"
                                         xmlns="http://www.w3.org/2000/svg">
                                        <path
                                            d="M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z"></path>
                                    </svg>
                                </a></div>
                                <div className="Header-Social-Follow-Triangle"></div>
                            </div>
                        </div>
                    </div>
                    <div className="EventTicker-Display">
                        <div className="EventTicker-News">News:</div>
                        <div className="EventTicker-Scroll">
                            <div className="EventTicker-Group EventTicker-Group-Animating-180">
                                <div className="EventTicker-Item">The Discipline Era continues</div>
                                <div className="EventTicker-Item">WE ARE ALL LOVE BLASEBALL</div>
                                <div className="EventTicker-Item">NO THOUGHTS ONLY BLASEBALL</div>
                                <div className="EventTicker-Item">YOU ARE NOW PARTICIPATING IN THE CULTURAL EVENT OF
                                    BLASEBALL
                                </div>
                                <div className="EventTicker-Item">We have eaten -Infinity collective peanuts.</div>
                                <div className="EventTicker-Item">THE FEEDBACK IS LOUD</div>
                                <div className="EventTicker-Item">THE COMMISSIONER IS STILL DOING A GREAT JOB</div>
                                <div className="EventTicker-Item">WHO LIFTED THE MICROPHONE</div>
                                <div className="EventTicker-Item">EVERYTHING WAS PEANUTS</div>
                                <div className="EventTicker-Item">In memoriam: so so many</div>
                                <div className="EventTicker-Item">The coins of the 1% have been distributed.
                                    Each 99%-er received 265 coins.
                                </div>
                                <div className="EventTicker-Item">On Base Percentage Leaders: ... Wyatt Glover,
                                    Yellowstone Magic - 0.800 ..... Nagomi Mcdaniel, Baltimore Crabs - 0.571 .....
                                    Conrad Vaughan, New York Millennials - 0.562 ..... Elijah Valenzuela, Hawaii Fridays
                                    - 0.463 ..... Patel Beyonce, Unlimited Tacos - 0.462 .....
                                </div>
                                <div className="EventTicker-Item">Pitcher Win Leaders: ... Theodore Cervantes, New York
                                    Millennials - 5 ..... Caleb Alvarado, Chicago Firefighters - 5 ..... Felix Garbage,
                                    New York Millennials - 4 ..... Patty Fox, New York Millennials - 4 ..... Atlas
                                    Guerra, Kansas City Breath Mints - 4 .....
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
                <nav className="Navigation">
                    <div className="Navigation-Main"><a className="Navigation-Button Navigation-Button-Current"
                                                        href="#">League </a><a className="Navigation-Button"
                                                                               href="#">Bulletin </a><a
                        className="Navigation-Button" href="#">Shop </a><a className="Navigation-Button"
                                                                           href="#">Election </a><a
                        className="Navigation-Button" href="#">Book </a></div>
                    <div className="Navigation-User">
                        <div className="Navigation-User-Top"><a href="#" className="Navigation-CurrencyButton">
                            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512"
                                 height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M264.4 95.01c-35.6-.06-80.2 11.19-124.2 34.09C96.27 152 61.45 182 41.01 211.3c-20.45 29.2-25.98 56.4-15.92 75.8 10.07 19.3 35.53 30.4 71.22 30.4 35.69.1 80.29-11.2 124.19-34 44-22.9 78.8-53 99.2-82.2 20.5-29.2 25.9-56.4 15.9-75.8-10.1-19.3-35.5-30.49-71.2-30.49zm91.9 70.29c-3.5 15.3-11.1 31-21.8 46.3-22.6 32.3-59.5 63.8-105.7 87.8-46.2 24.1-93.1 36.2-132.5 36.2-18.6 0-35.84-2.8-50.37-8.7l10.59 20.4c10.08 19.4 35.47 30.5 71.18 30.5 35.7 0 80.3-11.2 124.2-34.1 44-22.8 78.8-52.9 99.2-82.2 20.4-29.2 26-56.4 15.9-75.7zm28.8 16.8c11.2 26.7 2.2 59.2-19.2 89.7-18.9 27.1-47.8 53.4-83.6 75.4 11.1 1.2 22.7 1.8 34.5 1.8 49.5 0 94.3-10.6 125.9-27.1 31.7-16.5 49.1-38.1 49.1-59.9 0-21.8-17.4-43.4-49.1-59.9-16.1-8.4-35.7-15.3-57.6-20zm106.7 124.8c-10.2 11.9-24.2 22.4-40.7 31-35 18.2-82.2 29.1-134.3 29.1-21.2 0-41.6-1.8-60.7-5.2-23.2 11.7-46.5 20.4-68.9 26.1 1.2.7 2.4 1.3 3.7 2 31.6 16.5 76.4 27.1 125.9 27.1s94.3-10.6 125.9-27.1c31.7-16.5 49.1-38.1 49.1-59.9z"></path>
                            </svg>
                            &nbsp;Infinity</a><a href="#" className="Navigation-CurrencyButton">
                            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512"
                                 height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M323.9 19.81l-55.2 55.15L285 91.24 272.2 104 256 87.73 19.81 323.9l45.57 45.6c28.5-14.6 56.22-11.7 72.52 4.6 16.3 16.3 19.2 44 4.6 72.5l45.6 45.6 236.1-236.1-16.2-16.3 12.8-12.8 16.3 16.2 55.1-55.1-45.6-45.6c-28.5 14.6-56.2 11.7-72.5-4.6-16.3-16.3-19.2-44.02-4.6-72.52zm-16.2 93.99l33.9 34-12.8 12.8-33.9-34zM256 130.2L381.8 256 222.1 415.8 96.16 289.9 249.6 136.5zm0 25.4L121.6 289.9l100.5 100.5L356.4 256zm108.2 14.8l34 33.9-12.8 12.8-34-33.9z"></path>
                            </svg>
                            &nbsp;1</a>
                            <div className="Peanut-Container">
                                <button className="Navigation-CurrencyButton"><span className="Peanut-Line"><span
                                    className="Peanut-Icon"><svg stroke="currentColor" fill="currentColor"
                                                                 strokeWidth="0" viewBox="0 0 512 512" height="1em"
                                                                 width="1em" xmlns="http://www.w3.org/2000/svg"><path
                                    d="M397.055 27.89c-4.202-.02-8.48.12-12.818.413-7.642.515-15.42 1.533-23.195 2.927 11.636 5.802 22.382 12.255 32.28 19.31a756.42 756.42 0 0 1 32.343-19.6c-8.933-2.028-18.55-3-28.61-3.05zm-64.793 10.243c-17.342 5.205-33.775 11.99-47.636 19.408-6.854 3.668-12.778 8.478-18.053 14.18 5.96 21.723 12.947 42.6 21.549 62.299 27.024-26.766 56.88-50.991 89.22-72.952-13.327-8.725-28.306-16.388-45.08-22.935zm115.698.955a758.598 758.598 0 0 0-39.588 23.19c17.336 14.792 31.593 31.742 43.057 50.536 9.529-11.524 18.978-23.226 28.49-35.056-2.843-8.465-6.826-16.08-12.057-22.467-5.507-6.724-12.23-12.075-19.902-16.203zm-55.098 33.207c-35.44 23.564-67.759 49.777-96.596 78.996 12.984 25.654 29.184 49.021 49.998 69.326 34.927-28.111 64.704-59.874 93.21-93.512-11.754-20.872-27.082-39.216-46.612-54.81zM253.126 90.08c-5.255 8.763-9.94 18.496-14.551 28.768-6.98 15.547-13.697 32.121-22.533 47.457l.328.07c-3.855 18.211-.202 31.879 6.603 45.13 15.684-22.647 32.972-43.871 51.747-63.765-8.528-18.444-15.59-37.769-21.594-57.66zm231.568 10.426c-7.926 9.816-15.881 19.57-23.937 29.228 6.284 12.657 11.462 26.027 15.607 40.032a196.273 196.273 0 0 0 4.037-14.38c4.468-18.665 6.079-37.652 4.293-54.88zm-36.47 44.06c-26.879 31.317-55.377 61.275-88.493 88.217 11.584 9.672 24.448 18.504 38.742 26.416 10.825-4.002 21.179-8.816 30.672-15.435 12.93-9.016 25.661-25.644 35.71-45.744-3.844-19.113-9.303-36.96-16.632-53.454zM283.246 164.95c-19.559 21.24-37.38 43.983-53.313 68.377l-1.588 2.43-2.707 1.045c-21.884 8.446-41.463 19.15-59.363 31.549 12.701 11.166 26.033 23.81 38.916 36.752a898.106 898.106 0 0 1 28.069 29.484c13.514-22.649 23.609-42.929 27.914-56.43l1.142-3.584 3.356-1.705c24.289-12.342 46.17-26.179 66.322-41.199-19.906-19.889-35.811-42.394-48.748-66.719zm-85.451 26.608a105.962 105.962 0 0 1-4.72 4.771c-19.007 17.984-42.793 30.61-65.497 41.82 5.124 3.26 10.613 7.21 16.457 11.73a385.202 385.202 0 0 1 8.1 6.466c17.336-12.372 36.255-23.295 57.248-32.264-5.304-9.736-9.769-20.443-11.588-32.523zm147.537 52.515c-18.626 14.072-38.719 27.2-60.756 39.121 7.108 4.023 16.176 6.553 26.107 10.354 16.559-12.208 35.764-18.305 54.584-23.873 3.49-1.032 6.963-2.054 10.424-3.082-10.947-6.956-21.053-14.474-30.36-22.52zm-237.461 3.764c-10.859 5.398-21.027 10.733-29.701 16.502-16.73 11.126-29.445 27.514-38.073 46.496 2.303 6.03 8.387 18.297 17.168 31.74.973 1.489 2.012 3.028 3.043 4.563 23.041-28.694 47.785-56.194 77.045-79.608a339.292 339.292 0 0 0-4.33-3.414c-8.767-6.781-16.585-12.026-22.289-14.947a42.945 42.945 0 0 0-2.863-1.332zm43.55 31.47c-30.433 23.855-56.028 52.661-80.331 83.235 8.343 11.462 17.786 23.533 27.693 35.264 15.915 18.843 33.068 36.833 48.613 50.037.111.094.221.181.332.275 16.169-16.717 32.877-36.758 48.182-57.486a710.167 710.167 0 0 0 27.502-40.078c-9.473-10.578-20.037-21.768-30.975-32.754-13.656-13.717-27.842-27.065-41.015-38.492zm121.602 18.157c-6.282 14.907-15.7 32.574-27.18 51.355 4.785 5.57 9.239 10.936 13.159 15.93 2.968 3.781 5.634 7.335 8.006 10.69 6.034-23.643 12.319-48.771 28.668-68.006-7.347-2.412-15.333-5.148-22.653-9.97zM31.548 335.352a162.107 162.107 0 0 0-4.412 26.566 164.12 164.12 0 0 0 .113 28.02c7.065-9.345 14.154-18.69 21.377-27.987a460.846 460.846 0 0 1-6.428-9.535c-4.04-6.185-7.612-11.82-10.65-17.064zm204.226 29.41a761.283 761.283 0 0 1-25.385 36.56c-15.268 20.678-31.568 40.725-47.933 57.897 9.379 6.213 17.318 9.77 21.781 10.084l-.094 1.34c17.761-6.81 34.406-15.544 47.893-24.89 14.435-10 22.256-26.564 28.344-46.171a27.87 27.87 0 0 0-1.664-3.686c-2.517-4.694-7.417-11.812-13.871-20.035-2.74-3.49-5.815-7.232-9.07-11.1zM59.575 377.248c-9.43 12.213-18.767 24.626-28.187 37.037 5.026 19.664 13.901 37.128 26.189 49.559 12.098 12.239 28.747 18.57 47.72 20.267 8.992-5.412 19.042-13.442 29.577-23.302-16.442-14.088-33.747-32.337-49.84-51.391a649.378 649.378 0 0 1-25.459-32.17zm89.734 95.104c-3.995 3.783-7.979 7.366-11.937 10.699.88-.123 1.76-.248 2.642-.385 6.262-.969 12.583-2.293 18.883-3.916-3.162-1.882-6.354-4.038-9.588-6.398z"></path></svg></span>&nbsp;0</span>
                                </button>
                                <div className="Peanut">
                                    <svg stroke="currentColor" fill="currentColor" strokeWidth="0"
                                         viewBox="0 0 512 512" height="1em" width="1em"
                                         xmlns="http://www.w3.org/2000/svg">
                                        <path
                                            d="M397.055 27.89c-4.202-.02-8.48.12-12.818.413-7.642.515-15.42 1.533-23.195 2.927 11.636 5.802 22.382 12.255 32.28 19.31a756.42 756.42 0 0 1 32.343-19.6c-8.933-2.028-18.55-3-28.61-3.05zm-64.793 10.243c-17.342 5.205-33.775 11.99-47.636 19.408-6.854 3.668-12.778 8.478-18.053 14.18 5.96 21.723 12.947 42.6 21.549 62.299 27.024-26.766 56.88-50.991 89.22-72.952-13.327-8.725-28.306-16.388-45.08-22.935zm115.698.955a758.598 758.598 0 0 0-39.588 23.19c17.336 14.792 31.593 31.742 43.057 50.536 9.529-11.524 18.978-23.226 28.49-35.056-2.843-8.465-6.826-16.08-12.057-22.467-5.507-6.724-12.23-12.075-19.902-16.203zm-55.098 33.207c-35.44 23.564-67.759 49.777-96.596 78.996 12.984 25.654 29.184 49.021 49.998 69.326 34.927-28.111 64.704-59.874 93.21-93.512-11.754-20.872-27.082-39.216-46.612-54.81zM253.126 90.08c-5.255 8.763-9.94 18.496-14.551 28.768-6.98 15.547-13.697 32.121-22.533 47.457l.328.07c-3.855 18.211-.202 31.879 6.603 45.13 15.684-22.647 32.972-43.871 51.747-63.765-8.528-18.444-15.59-37.769-21.594-57.66zm231.568 10.426c-7.926 9.816-15.881 19.57-23.937 29.228 6.284 12.657 11.462 26.027 15.607 40.032a196.273 196.273 0 0 0 4.037-14.38c4.468-18.665 6.079-37.652 4.293-54.88zm-36.47 44.06c-26.879 31.317-55.377 61.275-88.493 88.217 11.584 9.672 24.448 18.504 38.742 26.416 10.825-4.002 21.179-8.816 30.672-15.435 12.93-9.016 25.661-25.644 35.71-45.744-3.844-19.113-9.303-36.96-16.632-53.454zM283.246 164.95c-19.559 21.24-37.38 43.983-53.313 68.377l-1.588 2.43-2.707 1.045c-21.884 8.446-41.463 19.15-59.363 31.549 12.701 11.166 26.033 23.81 38.916 36.752a898.106 898.106 0 0 1 28.069 29.484c13.514-22.649 23.609-42.929 27.914-56.43l1.142-3.584 3.356-1.705c24.289-12.342 46.17-26.179 66.322-41.199-19.906-19.889-35.811-42.394-48.748-66.719zm-85.451 26.608a105.962 105.962 0 0 1-4.72 4.771c-19.007 17.984-42.793 30.61-65.497 41.82 5.124 3.26 10.613 7.21 16.457 11.73a385.202 385.202 0 0 1 8.1 6.466c17.336-12.372 36.255-23.295 57.248-32.264-5.304-9.736-9.769-20.443-11.588-32.523zm147.537 52.515c-18.626 14.072-38.719 27.2-60.756 39.121 7.108 4.023 16.176 6.553 26.107 10.354 16.559-12.208 35.764-18.305 54.584-23.873 3.49-1.032 6.963-2.054 10.424-3.082-10.947-6.956-21.053-14.474-30.36-22.52zm-237.461 3.764c-10.859 5.398-21.027 10.733-29.701 16.502-16.73 11.126-29.445 27.514-38.073 46.496 2.303 6.03 8.387 18.297 17.168 31.74.973 1.489 2.012 3.028 3.043 4.563 23.041-28.694 47.785-56.194 77.045-79.608a339.292 339.292 0 0 0-4.33-3.414c-8.767-6.781-16.585-12.026-22.289-14.947a42.945 42.945 0 0 0-2.863-1.332zm43.55 31.47c-30.433 23.855-56.028 52.661-80.331 83.235 8.343 11.462 17.786 23.533 27.693 35.264 15.915 18.843 33.068 36.833 48.613 50.037.111.094.221.181.332.275 16.169-16.717 32.877-36.758 48.182-57.486a710.167 710.167 0 0 0 27.502-40.078c-9.473-10.578-20.037-21.768-30.975-32.754-13.656-13.717-27.842-27.065-41.015-38.492zm121.602 18.157c-6.282 14.907-15.7 32.574-27.18 51.355 4.785 5.57 9.239 10.936 13.159 15.93 2.968 3.781 5.634 7.335 8.006 10.69 6.034-23.643 12.319-48.771 28.668-68.006-7.347-2.412-15.333-5.148-22.653-9.97zM31.548 335.352a162.107 162.107 0 0 0-4.412 26.566 164.12 164.12 0 0 0 .113 28.02c7.065-9.345 14.154-18.69 21.377-27.987a460.846 460.846 0 0 1-6.428-9.535c-4.04-6.185-7.612-11.82-10.65-17.064zm204.226 29.41a761.283 761.283 0 0 1-25.385 36.56c-15.268 20.678-31.568 40.725-47.933 57.897 9.379 6.213 17.318 9.77 21.781 10.084l-.094 1.34c17.761-6.81 34.406-15.544 47.893-24.89 14.435-10 22.256-26.564 28.344-46.171a27.87 27.87 0 0 0-1.664-3.686c-2.517-4.694-7.417-11.812-13.871-20.035-2.74-3.49-5.815-7.232-9.07-11.1zM59.575 377.248c-9.43 12.213-18.767 24.626-28.187 37.037 5.026 19.664 13.901 37.128 26.189 49.559 12.098 12.239 28.747 18.57 47.72 20.267 8.992-5.412 19.042-13.442 29.577-23.302-16.442-14.088-33.747-32.337-49.84-51.391a649.378 649.378 0 0 1-25.459-32.17zm89.734 95.104c-3.995 3.783-7.979 7.366-11.937 10.699.88-.123 1.76-.248 2.642-.385 6.262-.969 12.583-2.293 18.883-3.916-3.162-1.882-6.354-4.038-9.588-6.398z"></path>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="Navigation-User-Bottom"><a target="_blank"
                                                                   href="#"
                                                                   style={{"background": "rgb(62, 230, 82)"}}
                                                                   className="Navigation-FavoriteTeamEmoji">🏝</a><a
                            href="#" className="Navigation-Button">Log Out</a></div>
                    </div>
                </nav>
                <div className="Main-Body">
                    <div>
                        <div className="DailySchedule-Header">Season<span
                            className="DailySchedule-Number">∞</span>Day<span
                            className="DailySchedule-Number">{state.day + 1}</span>
                        </div>
                        <div className="Advertisement-SiteHeader">Not affiliated with the game band. This is a fan
                            tribute.
                        </div>
                        <div className="LeagueNavigation-Nav"><a className="Navigation-Button Navigation-Button-Current"
                                                                 href="#">Watch Live</a><a className="Navigation-Button"
                                                                                           href="#">Place
                            Bets</a><a className="Navigation-Button" href="#">Standings</a><a
                            className="Navigation-Button" href="#">Idols</a></div>
                        <div>
                            <div className="DailySchedule-Countdown"></div>
                            {games.map((gameTeams, idx) => <Game teams={gameTeams} players={players} day={state.day}
                                                                 rng={rng} gameIndex={idx}
                                                                 onGameEnd={onGameEnd}
                                                                 key={gameTeams.map(t => t.shorthand).join("-")}/>)}
                        </div>
                    </div>
                </div>
                <footer className="Main-Footer">
                    <div className="Main-Footer-Links"><a className="Main-Footer-Link" href="#">Terms of
                        Service</a><a className="Main-Footer-Link" href="#">Privacy Policy</a><a
                        className="Main-Footer-Link" href="mailto:press@thegameband.com">Press</a></div>
                    <div className="Main-Footer-Advertise">
                        <div className="Main-Footer-Advertise-Inner"><a className="Main-Footer-Advertise-Icon"
                                                                        href="mailto:sponsors@thegameband.com?subject=I%E2%80%99d%20like%20to%20sponsor%20a%20season%20of%20Blaseball">Sponsor
                            a Season</a></div>
                    </div>
                    <a href="https://twitter.com/thegameband" target="_blank" className="Main-Footer-Logo">
                        <svg width="959" height="1065" viewBox="0 0 959 1065">
                            <image id="Ball" x="87" y="75" width="784" height="911"
                                   xlinkHref="data:img/png;base64,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"></image>
                        </svg>
                    </a></footer>
            </div>
        </div>
    )
}