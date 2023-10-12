"use client"

import type { GetStaticProps, InferGetStaticPropsType, Metadata } from 'next'
import { ChangeEvent, useEffect, useMemo, useState } from "react"
import { chroniclerFetch, chroniclerFetchActiveTeams, Item, Player, Team } from "@/chron"
import { Sim, SimState } from "@/sim/sim"
import Head from "next/head"
import { Blaseball, FrontendVersion } from "@/components/Blaseball"
import assert from "assert"
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation"
import randomBigint from 'crypto-random-bigint'
import schedule from "@/app/schedule"

function randomSeedComponent() {
  return randomBigint(128)
}

function seedComponentFromQuery(query: ReadonlyURLSearchParams, name: string) {
  if (!query.has(name)) {
    return randomSeedComponent()
  }
  const mask = BigInt(2) ** BigInt(128) - BigInt(1)
  return BigInt(query.get("s0")!) & mask
}

export default function Index() {
  const query = useSearchParams()!
  const [sim, setSim] = useState<Sim | null>(null)
  const [simLoadError, setSimLoadError] = useState<Error | null>(null)
  const [simState, setSimState] = useState<SimState | null>(null)
  useEffect(() => {
    let cancelled = false
    const s0 = seedComponentFromQuery(query, "s0")
    const s1 = seedComponentFromQuery(query, "s1")
    const gameday = schedule[Math.floor(schedule.length * Math.random())]
    const time = new Date(gameday.start_time.getTime() + Math.random() * (gameday.end_time.getTime() - gameday.start_time.getTime()))
    const at = time.toISOString()
    const playersPromise = chroniclerFetch<Player>("player", at)
    const teamsPromise = chroniclerFetchActiveTeams(at)
    Promise.all([playersPromise, teamsPromise])
      .then(([players, teams]) => {
        if (cancelled) return
        const sim = new Sim(s0, s1, players, teams)
        setSim(sim)
        setSimState(sim.state)
      }, error => {
        if (cancelled) return
        setSimLoadError(error)
      })

    return () => {
      cancelled = true
    }
  }, [query])

  useEffect(() => {
    if (!sim) return
    let timeout: NodeJS.Timeout
    let nextTime = new Date()
    let ticker = () => {
      console.log("Running tick for", nextTime.getTime(), "at", new Date().getTime())
      sim.runToTime(nextTime)
      setSimState(sim.state)
      nextTime = sim.nextTickTime()
      const dt = nextTime.getTime() - new Date().getTime()
      assert(dt >= 0)
      timeout = setTimeout(ticker, dt)
    }
    ticker()
    return () => clearTimeout(timeout)
  }, [sim]) // sim should never change! so this should only run once per mount

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
      <nav>
        UI Style:{' '}
        <li style={{ display: "inline" }}><label><input type={"radio"} name="Season6"
                                                        checked={version === FrontendVersion.Season6}
                                                        onChange={onChangeVersion} /> Season 6</label></li>
        {' '}
        <li style={{ display: "inline" }}><label><input type={"radio"} name="Season13"
                                                        checked={version === FrontendVersion.Season13}
                                                        onChange={onChangeVersion} /> Season 13</label></li>
      </nav>

      {simLoadError && <main>
        <h1>Error</h1>
        <p>{simLoadError.toString()}</p>
      </main>}
      {!simLoadError && !simState && <main>
        <h1>Loading...</h1>
      </main>}
      {sim && simState && version !== null && <Blaseball simState={simState} playerMap={sim.players} version={version} />}
    </div>
  )
}