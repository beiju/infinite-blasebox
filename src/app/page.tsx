"use client"

import { useEffect, useState } from "react"
import { chroniclerFetch, chroniclerFetchActiveTeams, chroniclerFetchCoffeeCupTeams, Item, Player, Team } from "@/chron"
import { Sim, Universe } from "@/sim/sim"
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation"
import randomBigint from 'crypto-random-bigint'
import schedule from "@/app/schedule"
import Link from "next/link"
import { VersionSelect } from "@/components/Universe"

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
  const [loadingProgress, setLoadingProgress] = useState(0)
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
    const at = time.toISOString(); // rare mandatory semicolon
    (gameday.season === -1 ? chroniclerFetchCoffeeCupTeams : chroniclerFetchActiveTeams)(at, setLoadingProgress)
      .then(async (teams: Item<Team>[]) => {
        if (cancelled) return
        const players = await Promise.all(teams.map(team =>
          chroniclerFetch<Player>("player", at, team.data.rotation.concat(team.data.lineup))))
        if (cancelled) return
        setLoadingProgress(5)
        const sim = Sim.fromChron(s0, s1, players.flat(), teams)
        const universe = {
          origin: {
            season: gameday.season,
            day: gameday.day,
            offset
          },
          sim
        }
        setUniverse(universe)

      })
      .catch(error => {
        if (cancelled) return
        setUniverseLoadError(error)
      })

    return () => {
      cancelled = true
    }
  }, [query])

  return (
    <div id="root">

      {!universe && !universeLoadError && <main className="ib-loading">
        <h1>Loading the Infinite Blasebox...</h1>
        <progress max={5} value={loadingProgress} />
      </main>}
      {universeLoadError && <main className="ib-loading-error">
        <h1><strong>Error</strong> loading the Infinite Blasebox</h1>
        <p>{universeLoadError.toString()}</p>
        <p>Try <a href="">Reloading</a> or going <Link href="/">Home</Link></p>
      </main>}
      {universe && !universeLoadError && <VersionSelect universe={universe} />}
    </div>
  )
}

