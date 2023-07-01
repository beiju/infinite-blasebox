import { Rng } from "@/sim/rng"
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react"
import { baseToString, findPlayer, GamePhase, GameState, mod, tickInner } from "@/sim/game"
import { Item, Player, Team } from "@/chron"

type TimeoutObject = { timeout: ReturnType<typeof setTimeout> | null };

function tickOuter(rng: Rng, setGameState: Dispatch<SetStateAction<GameState>>, players: Item<Player>[], homeTeam: Team, awayTeam: Team, day: number, gameIndex: number, onGameEnd: (day: number, gameIndex: number, winnerId: string, loserId: string) => void): TimeoutObject {
  const timeoutInfo: TimeoutObject = { timeout: null }
  setGameState((prevState) => {
    // Copy state object because the one that's passed in has to be immutable
    const state: GameState = { ...prevState }

    const delay = tickInner(rng, state, players, homeTeam, awayTeam, day)
    if (delay !== null) {
      timeoutInfo.timeout = setTimeout(() => tickOuter(rng, setGameState, players, homeTeam, awayTeam, day, gameIndex, onGameEnd), delay)
    } else {
      // breath mints i do NOT want to hear it
      if (state.homeScore > state.awayScore) {
        onGameEnd(day, gameIndex, homeTeam.id, awayTeam.id)
      } else {
        onGameEnd(day, gameIndex, awayTeam.id, homeTeam.id)
      }
    }
    console.log(`${awayTeam.nickname} @ ${homeTeam.nickname}: ${state.lastUpdate}`)
    return state
  })
  return timeoutInfo
}

export function Game({ teams, players, day, rng, gameIndex, records, onGameEnd }: {
  teams: [Team, Team],
  players: Item<Player>[],
  day: number,
  rng: Rng,
  gameIndex: number,
  records: { [key: string]: { wins: number, losses: number } },
  onGameEnd: (day: number, gameIndex: number, winnerId: string, loserId: string) => void
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
      setGameState(state => ({ ...state, start: true, }))
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
    return findPlayer(players, homeTeam.rotation[mod(day, homeTeam.rotation.length)])
  }, [homeTeam, players, day])

  const awayPitcher = useMemo(() => {
    return findPlayer(players, awayTeam.rotation[mod(day, awayTeam.rotation.length)])
  }, [awayTeam, players, day])

  const homeBatter = useMemo(() => {
    return findPlayer(players, homeTeam.lineup[mod(gameState.homeBatterIndex, homeTeam.lineup.length)])
  }, [homeTeam, players, gameState.homeBatterIndex])

  const awayBatter = useMemo(() => {
    return findPlayer(players, awayTeam.lineup[mod(gameState.awayBatterIndex, awayTeam.lineup.length)])
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
                 style={{ "background": awayTeam.mainColor }}>{String.fromCodePoint(parseInt(awayTeam.emoji))}
            </div>
            <div className="GameWidget-ScoreTeam">
              <div className="GameWidget-ScoreName"
                   style={{ "color": awayTeam.mainColor }}>{awayTeam.nickname}
              </div>
              <div className="GameWidget-ScoreTeamInfo">
                <div className="GameWidget-ScoreRecord">{records[awayTeam.id].wins}-{records[awayTeam.id].losses}</div>
                <span className="GameWidget-AllBetInfo"><div
                  className="GameWidget-WinChance"
                  style={{ "color": awayTeam.mainColor }}>??%</div></span></div>
            </div>
            <div className="GameWidget-ScoreNumber">{gameState.awayScore}</div>
          </a><a className="GameWidget-ScoreLine"
                 href="#">
            <div className="GameWidget-ScoreTeamColorBar"
                 style={{ "background": homeTeam.mainColor }}>{String.fromCodePoint(parseInt(homeTeam.emoji))}
            </div>
            <div className="GameWidget-ScoreTeam">
              <div className="GameWidget-ScoreName"
                   style={{ "color": homeTeam.mainColor }}>{homeTeam.nickname}
              </div>
              <div className="GameWidget-ScoreTeamInfo">
                <div className="GameWidget-ScoreRecord">{records[homeTeam.id].wins}-{records[homeTeam.id].losses}</div>
                <span className="GameWidget-AllBetInfo"><div
                  className="GameWidget-WinChance"
                  style={{ "color": homeTeam.mainColor }}>??%</div></span></div>
            </div>
            <div className="GameWidget-ScoreNumber">{gameState.homeScore}</div>
          </a></div>
        </div>
        <div className="GameWidget-Display-Visual">
          <div className="GameWidget-Display-Body">
            <div
              className={"GameWidget-Bases " + gameState.runners.map(runner => baseToString(runner.base)).join(" ")}>
              <div id="tooltip" style={{ "display": "none", "position": "absolute" }}></div>
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
                     style={{ "background": gameState.top ? homeTeam.mainColor : awayTeam.mainColor }}><a
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
                     style={{ "background": gameState.top ? awayTeam.mainColor : homeTeam.mainColor }}><a
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