"use client"

import { ChangeEvent, useEffect, useState } from "react"
import { chroniclerFetch, chroniclerFetchActiveTeams, Player } from "@/chron"
import { Sim, SimState, Universe } from "@/sim/sim"
import { Blaseball, FrontendVersion } from "@/components/Blaseball"
import assert from "assert"
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation"
import randomBigint from 'crypto-random-bigint'
import schedule from "@/app/schedule"
import Link from "next/link"

function randomSeedComponent() {
  return randomBigint(128)
}

function seedComponentFromQuery(query: ReadonlyURLSearchParams, name: string) {
  if (!query.has(name)) {
    return randomSeedComponent()
  }
  const mask = BigInt(2) ** BigInt(128) - BigInt(1)
  return BigInt(query.get(name)!) & mask
}

export default function Index() {
  const query = useSearchParams()!
  const [universe, setUniverse] = useState<Universe | null>(null)
  const [universeLoadError, setUniverseLoadError] = useState<Error | null>(null)
  useEffect(() => {
    let cancelled = false
    const s0 = seedComponentFromQuery(query, "s0")
    const s1 = seedComponentFromQuery(query, "s1")
    let filtered_schedule = schedule
    const querySeason = query.has("season") ? parseInt(query.get("season")!, 10) - 1 : NaN
    if (isFinite(querySeason)) {
      filtered_schedule = filtered_schedule.filter(item => item.season === querySeason)
    }
    const queryDay = query.has("day") ? parseInt(query.get("day")!, 10) - 1 : NaN
    if (isFinite(queryDay)) {
      filtered_schedule = filtered_schedule.filter(item => item.day === queryDay)
    }
    if (filtered_schedule.length === 0) {
      console.warn("Couldn't get gameday for season", querySeason, "day", queryDay)
      filtered_schedule = schedule
    }
    
    const gameday = filtered_schedule[Math.floor(filtered_schedule.length * Math.random())]
    const offset = query.has("offset") ?
      parseInt(query.get("offset")!, 10) :
      Math.random() * (gameday.end_time.getTime() - gameday.start_time.getTime())
    const time = new Date(gameday.start_time.getTime() + offset)
    const at = time.toISOString()
    const playersPromise = chroniclerFetch<Player>("player", at)
    const teamsPromise = chroniclerFetchActiveTeams(at)
    Promise.all([playersPromise, teamsPromise])
      .then(([players, teams]) => {
        if (cancelled) return
        const sim = new Sim(s0, s1, players, teams)
        setUniverse({
          origin: {
            season: gameday.season,
            day: gameday.day,
            offset
          },
          sim
        })
      })
      .catch(error => {
        if (cancelled) return
        setUniverseLoadError(error)
      })

    return () => {
      cancelled = true
    }
  }, [query])

  const [version, setVersion] = useState<FrontendVersion | null>(null)

  // dunno if this is the best way to do it
  useEffect(() => {
    if (version !== null) {
      localStorage.setItem("blasebox-frontend-version", FrontendVersion[version])
    }
  }, [version])

  useEffect(() => {
    const storedVersion = localStorage.getItem("blasebox-frontend-version")
    if (storedVersion === null) {
      setVersion(FrontendVersion.Season13)
    } else {
      setVersion(FrontendVersion[storedVersion as keyof typeof FrontendVersion])
    }
  }, [])

  const onChangeVersion = (event: ChangeEvent<HTMLInputElement>) => {
    setVersion(FrontendVersion[event.currentTarget.name as keyof typeof FrontendVersion])
  }

  return (
    <div id="root">

      {!universe && !universeLoadError && <main className="ib-loading">
        <h1>Loading the Infinite Blasebox...</h1>
      </main>}
      {universeLoadError && <main className="ib-loading-error">
        <h1><strong>Error</strong> loading the Infinite Blasebox</h1>
        <p>{universeLoadError.toString()}</p>
        <p>Try <a href="">Reloading</a> or going <Link href="/">Home</Link></p>
      </main>}
      {universe && !universeLoadError && version !== null &&
        <Universe universe={universe} version={version} onChangeVersion={onChangeVersion} />}
    </div>
  )
}

function msToDisplayTime(ms: number) {
  let sec = ms / 1000
  const hours = Math.floor(sec / 3600)
  sec -= hours * 3600
  const min = Math.floor(sec / 60)
  sec -= min * 60
  const hourStr = hours ? `${hours}:` : ""
  const minStr = hours ? String(min).padStart(2, "0") : String(min)
  const secStr = String(Math.round(sec)).padStart(2, "0")
  return `${hourStr}${minStr}:${secStr}`
}

function Universe({ universe, version, onChangeVersion }: {
  universe: Universe,
  version: FrontendVersion,
  onChangeVersion: (event: ChangeEvent<HTMLInputElement>) => void,
}) {
  const [renderState, setRenderState] = useState<SimState>(() => universe.sim.state)

  useEffect(() => {
    if (!universe) return
    let timeout: NodeJS.Timeout
    let nextTime = new Date()
    let ticker = () => {
      console.log("Running tick for", nextTime.getTime(), "at", new Date().getTime())
      universe.sim.runToTime(nextTime)
      // Create a new object for React's change detection
      setRenderState({ ...universe.sim.state })
      nextTime = universe.sim.nextTickTime()
      const dt = nextTime.getTime() - new Date().getTime()
      assert(dt >= 0)
      timeout = setTimeout(ticker, dt)
    }
    ticker()
    return () => clearTimeout(timeout)
  }, [universe]) // universe should never change! so this should only run once per mount

  const { season, day, offset } = universe.origin
  return (<main>
    <nav className="ib-control">
      <div className="ib-version-select">
        UI Style:{' '}
        <li style={{ display: "inline" }}><label><input type={"radio"} name="Season6"
                                                        checked={version === FrontendVersion.Season6}
                                                        onChange={onChangeVersion} /> Season 6</label></li>
        {' '}
        <li style={{ display: "inline" }}><label><input type={"radio"} name="Season13"
                                                        checked={version === FrontendVersion.Season13}
                                                        onChange={onChangeVersion} /> Season 13</label></li>
      </div>
      <div className="ib-location">
        Current location: Ephemeral universe originating s{season < 0 ? "CC" : (season + 1)}d{day + 1}+{msToDisplayTime(offset)}
      </div>
      <div className="ib-universe-control">
        {/* Make a disabled link maybe? */}
        {/* TODO Implement stabilization (saving universes) */}
        <Link href={"/"} title="Coming soon!" onClick={e => e.preventDefault()}>Stabilize...</Link>
      </div>
    </nav>

    <Blaseball simState={renderState} playerMap={universe.sim.players} version={version} />
  </main>)
}