import { useMemo } from "react"
import { baseToString, GameState, mod } from "@/sim/game"
import { Player } from "@/chron"
import { SimState } from "@/sim/sim"
import { checkedGet } from "@/util"

function formatEmoji(emoji: string) {
  const int = parseInt(emoji)
  if (isFinite(int)) {
    return String.fromCodePoint(int)
  } else {
    return emoji
  }
}

function useGameHelper(gameState: GameState, playerMap: Map<string, Player>, day: number) {
  const homeTeam = gameState.homeTeam
  const awayTeam = gameState.awayTeam

  const homePitcher = useMemo(() => {
    return checkedGet(playerMap, homeTeam.rotation[mod(day, homeTeam.rotation.length)])
  }, [homeTeam, playerMap, day])

  const awayPitcher = useMemo(() => {
    return checkedGet(playerMap, awayTeam.rotation[mod(day, awayTeam.rotation.length)])
  }, [awayTeam, playerMap, day])

  const homeBatter = useMemo(() => {
    return checkedGet(playerMap, homeTeam.lineup[mod(gameState.homeBatterIndex, homeTeam.lineup.length)])
  }, [homeTeam, playerMap, gameState.homeBatterIndex])

  const awayBatter = useMemo(() => {
    return checkedGet(playerMap, awayTeam.lineup[mod(gameState.awayBatterIndex, awayTeam.lineup.length)])
  }, [awayTeam, playerMap, gameState.awayBatterIndex])

  return { homeTeam, awayTeam, homePitcher, awayPitcher, homeBatter, awayBatter }
}

export function GameS6({ day, gameState, playerMap, records }: {
  day: number,
  gameState: GameState,
  playerMap: Map<string, Player>,
  records: SimState["records"]
}) {
  const {
    homeTeam,
    awayTeam,
    homePitcher,
    awayPitcher,
    homeBatter,
    awayBatter
  } = useGameHelper(gameState, playerMap, day)

  return (
    <div className="GameWidget">
      <div className="GameWidget-Full-Live">
        <div className="GameWidget-Header-Wrapper">
          <div className="GameWidget-Header">
            <div className="GameWidget-StatusBar">
              <div className="GameWidget-Status GameWidget-Status--Live">Live - {gameState.inning + 1}
                {gameState.top ? "▲" : "▼"}
              </div>
            </div>
            <div className="GameWidget-ScoreLabel GameWidget-ScoreLabel--Series">
              {`${(day % 3) + 1} of 3`}
            </div>
          </div>
          <div className="GameWidget-ScoreBacking">
            <a className="GameWidget-ScoreLine" href="#">
              <div className="GameWidget-ScoreTeamColorBar"
                   style={{ "background": awayTeam.mainColor }}>{formatEmoji(awayTeam.emoji)}
              </div>
              <div className="GameWidget-ScoreTeam">
                <div className="GameWidget-ScoreName"
                     style={{ "color": awayTeam.mainColor }}>{awayTeam.nickname}
                </div>
                <div className="GameWidget-ScoreTeamInfo">
                  <div
                    className="GameWidget-ScoreRecord">{checkedGet(records, awayTeam.id).wins}-{checkedGet(records, awayTeam.id).losses}</div>
                  <span className="GameWidget-AllBetInfo"><div
                    className="GameWidget-WinChance"
                    style={{ "color": awayTeam.mainColor }}>??%</div></span></div>
              </div>
              <div className="GameWidget-ScoreNumber">{gameState.awayScore}</div>
            </a><a className="GameWidget-ScoreLine"
                   href="#">
            <div className="GameWidget-ScoreTeamColorBar"
                 style={{ "background": homeTeam.mainColor }}>{formatEmoji(homeTeam.emoji)}
            </div>
            <div className="GameWidget-ScoreTeam">
              <div className="GameWidget-ScoreName"
                   style={{ "color": homeTeam.mainColor }}>{homeTeam.nickname}
              </div>
              <div className="GameWidget-ScoreTeamInfo">
                <div
                  className="GameWidget-ScoreRecord">{checkedGet(records, homeTeam.id).wins}-{checkedGet(records, homeTeam.id).losses}</div>
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
                  {gameState.top ? homePitcher.name : awayPitcher.name}
                </a></div>
              </div>
              <div className="GameWidget-PlayerLine">
                <div
                  className="GameWidget-PlayerStatusIcon GameWidget-PlayerStatusIcon--Batting"></div>
                <div className="GameWidget-PlayerStatusLabel">Batting</div>
                <div className="GameWidget-PlayerLineNameWrapper"
                     style={{ "background": gameState.top ? awayTeam.mainColor : homeTeam.mainColor }}>
                  <a
                    className="GameWidget-PlayerLineName"
                    href="#">
                    {gameState.top ? awayBatter.name : homeBatter.name}
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

export function GameS13({ day, gameState, playerMap, records }: {
  day: number,
  gameState: GameState,
  playerMap: Map<string, Player>,
  records: SimState["records"]
}) {
  const {
    homeTeam,
    awayTeam,
    homePitcher,
    awayPitcher,
    homeBatter,
    awayBatter
  } = useGameHelper(gameState, playerMap, day)
  const activeBatter = gameState.top ? awayBatter : homeBatter

  const awayWins = checkedGet(records, awayTeam.id).wins
  const awayLosses = checkedGet(records, awayTeam.id).losses
  const homeWins = checkedGet(records, homeTeam.id).wins
  const homeLosses = checkedGet(records, homeTeam.id).losses

  const runnersOnFirst = gameState.runners.filter(runner => runner.base === 1)
  const runnersOnSecond = gameState.runners.filter(runner => runner.base === 2)
  const runnersOnThird = gameState.runners.filter(runner => runner.base === 3)
  return (
    <li className="GameWidget  GameWidget-Full-Live" aria-label="Moist Talkers versus Magic">
      <div className="Widget-Header-Wrapper">
        <div role="group" aria-label="Game Status Bar" className="Widget-Header">
          <div className="Widget-StatusBar-WithStadium">
            <div className="Widget-StatusBar">
              <div className="Widget-Status Widget-Status--Live"
                   aria-label={`Live, ${gameState.top ? "Top" : "Bottom"} of Inning ${gameState.inning + 1}`}
                   role="text">
                Live - {gameState.inning + 1} {gameState.top ? "▲" : "▼"}
              </div>
            </div>
            <div className="Widget-StadiumLabel">
              <div className="Widget-Stadium-Icon"></div>
            </div>
          </div>
          <div className="Widget-ScoreLabel Widget-ScoreLabel--Series"
               aria-label={`${(day % 3) + 1} of 3 Games`}
               role="text">
            {`${(day % 3) + 1} of 3`}
          </div>
        </div>
        <div role="group" aria-label="The Teams" className="Widget-ScoreBacking">
          <a className="GameWidget-ScoreLine" href="#">
            <div className="GameWidget-ScoreTeamColorBar" aria-hidden="true"
                 style={{ "background": awayTeam.mainColor }}>{formatEmoji(awayTeam.emoji)}
            </div>
            <div className="GameWidget-ScoreTeam">
              <div className="GameWidget-ScoreName"
                   style={{
                     "color": awayTeam.mainColor,
                     "background": "none",
                     "padding": "initial",
                     "lineHeight": "initial"
                   }}>
                {awayTeam.nickname}
              </div>
              <div className="GameWidget-ScoreTeamInfo">
                <div className="GameWidget-ScoreRecord"
                     aria-label={`${awayWins} Nonlosses ${awayLosses}`}>
                  <span>{awayWins}-{awayLosses}</span>
                </div>
                <div className="GameWidget-WinChance"
                     aria-label="??% Chance of Winning"
                     style={{
                       "color": "rgb(245, 254, 255)",
                       "background": "none",
                       "padding": "initial",
                       "lineHeight": "initial"
                     }}>
                  ??%
                </div>
              </div>
            </div>
            <div className="GameWidget-ScoreNumber"
                 aria-label={`${gameState.awayScore} Runs`}>
              {gameState.awayScore}
            </div>
          </a>
          <a className="GameWidget-ScoreLine" href="#">
            <div className="GameWidget-ScoreTeamColorBar" aria-hidden="true"
                 style={{ "background": homeTeam.mainColor }}>{formatEmoji(homeTeam.emoji)}
            </div>
            <div className="GameWidget-ScoreTeam">
              <div className="GameWidget-ScoreName"
                   style={{
                     "color": homeTeam.mainColor,
                     "background": "none",
                     "padding": "initial",
                     "lineHeight": "initial"
                   }}>
                {homeTeam.nickname}
              </div>
              <div className="GameWidget-ScoreTeamInfo">
                <div className="GameWidget-ScoreRecord"
                     aria-label={`${homeWins} Nonlosses ${homeLosses}`}>
                  <span>{homeWins}-{homeLosses}</span>
                </div>
                <div className="GameWidget-WinChance"
                     aria-label="??% Chance of Winning"
                     style={{
                       "color": "rgb(245, 254, 255)",
                       "background": "none",
                       "padding": "initial",
                       "lineHeight": "initial"
                     }}>
                  ??%
                </div>
              </div>
            </div>
            <div className="GameWidget-ScoreNumber"
                 aria-label={`${gameState.homeScore} Runs`}>
              {gameState.homeScore}
            </div>
          </a>
        </div>
      </div>
      <div className="Widget-Display-Visual">
        <div className="Widget-Display-Body">
          <div className="Widget-Bases">
            <div id="tooltip" style={{ "display": "none", "position": "absolute" }}></div>
            <svg role="text"
                 aria-label={gameState.runners.length > 0 ? "Bases" : "No Runners on Base"}
                 viewBox="0 0 255 197"
                 version="1.1">
              <g
                aria-label={runnersOnFirst.length > 0 ? `First Base, ${runnersOnFirst.map(r => r.name).join(", ")} on` : ""}
                role="text" id="base1" className="st0"
                transform="matrix(0.7071,-0.7071,0.7071,0.7071,-40.4706,152.625)"
                style={{
                  "fill": runnersOnFirst.length > 0 ? "rgb(255, 255, 255)" : "none",
                  "stroke": "rgb(255, 255, 255)"
                }}>
                <rect x="141.95" y="105.74" width="70.31" height="70.31"></rect>
              </g>
              <g
                aria-label={runnersOnSecond.length > 0 ? `Second Base, ${runnersOnSecond.map(r => r.name).join(", ")} on` : ""}
                role="text" id="base2" className="st0"
                transform="matrix(0.7071,-0.7071,0.7071,0.7071,-16.7558,95.4764)"
                style={{
                  "fill": runnersOnSecond.length > 0 ? "rgb(255, 255, 255)" : "none",
                  "stroke": "rgb(255, 255, 255)"
                }}>
                <rect x="84.83" y="48.54" width="70.31" height="70.31"></rect>
              </g>
              <g
                aria-label={runnersOnThird.length > 0 ? `Third Base, ${runnersOnThird.map(r => r.name).join(", ")} on` : ""}
                id="base3" className="st0"
                transform="matrix(0.7071,-0.7071,0.7071,0.7071,-74.0296,71.6061)"
                style={{
                  "fill": runnersOnThird.length > 0 ? "rgb(255, 255, 255)" : "none",
                  "stroke": "rgb(255, 255, 255)"
                }}>
                <rect x="27.38" y="105.74" width="70.31" height="70.31"></rect>
              </g>
            </svg>
          </div>
          <ul className="Widget-Outs" aria-label="The Count">
            <li className="Widget-Outs-Row" aria-label={`${gameState.balls} Balls`} role="text">
              <div className="Widget-Outs-Label">Balls</div>
              <div className="Widget-Outs-DotList">
                <div className="Widget-Outs-Dots" aria-hidden="true">{gameState.balls >= 1 ? "●" : "○"}</div>
                <div className="Widget-Outs-Dots" aria-hidden="true">{gameState.balls >= 2 ? "●" : "○"}</div>
                <div className="Widget-Outs-Dots" aria-hidden="true">{gameState.balls >= 3 ? "●" : "○"}</div>
              </div>
            </li>
            <li className="Widget-Outs-Row" aria-label={`${gameState.strikes} Strikes`} role="text">
              <div className="Widget-Outs-Label">Strikes</div>
              <div className="Widget-Outs-DotList">
                <div className="Widget-Outs-Dots" aria-hidden="true">{gameState.strikes >= 1 ? "●" : "○"}</div>
                <div className="Widget-Outs-Dots" aria-hidden="true">{gameState.strikes >= 2 ? "●" : "○"}</div>
              </div>
            </li>
            <li className="Widget-Outs-Row" aria-label={`${gameState.outs} Outs`} role="text">
              <div className="Widget-Outs-Label">Outs</div>
              <div className="Widget-Outs-DotList">
                <div className="Widget-Outs-Dots" aria-hidden="true">{gameState.outs >= 1 ? "●" : "○"}</div>
                <div className="Widget-Outs-Dots" aria-hidden="true">{gameState.outs >= 2 ? "●" : "○"}</div>
              </div>
            </li>
          </ul>
          <ul className="Widget-AtBat" aria-label="Current Pitcher and Batter">
            <li className="Widget-PlayerLine" role="text">
              <div className="Widget-PlayerStatusIcon Widget-PlayerStatusIcon--Pitching"
                   aria-label="Pitching"></div>
              <div className="Widget-PlayerStatusLabel">Pitching</div>
              <div className="Widget-PlayerAttributes">
                <div className="Widget-PlayerLineNameWrapper" aria-haspopup="true"
                     style={{ "background": gameState.top ? homeTeam.mainColor : awayTeam.mainColor }}>
                  <a className="Widget-PlayerLineName" href="#">
                    {gameState.top ? homePitcher.name : awayPitcher.name}
                  </a>
                </div>
              </div>
            </li>
            <li className="Widget-PlayerLine" role="text">
              <div className="Widget-PlayerStatusIcon Widget-PlayerStatusIcon--Batting"
                   aria-label="Batting"></div>
              <div className="Widget-PlayerStatusLabel">Batting</div>
              <div className="Widget-PlayerAttributes">
                <div className="Widget-PlayerLineNameWrapper" aria-haspopup="true"
                     style={{ "background": gameState.top ? awayTeam.mainColor : homeTeam.mainColor }}>
                  {activeBatter ? (
                    <a className="Widget-PlayerLineName" href="">{activeBatter.name}</a>
                  ) : (
                    <div className="Widget-PlayerLineName" role="text" aria-label="No One at Bat">-</div>
                  )}
                </div>
              </div>
            </li>
          </ul>
          <div className="Widget-Log">
            {gameState.lastUpdate}
            {/*<span className="Widget-Log-Ledger">&nbsp;</span>*/}
            {/*<span className="Widget-Log-Score">&nbsp;1 Run scored!</span>*/}
          </div>
        </div>
      </div>
      <div className="Widget-Log" aria-label="Log">
        <div className="Widget-Log-Content">
          <div className="Widget-Log-Line">{gameState.lastUpdate}</div>
          {/*<div className="Widget-Log-Line Widget-Log-Score">1 Run scored!</div>*/}
        </div>
        {/*<div className="Widget-Log-PlayCount" role="text" aria-label="Play #6">6</div>*/}
      </div>
    </li>
  )
}
