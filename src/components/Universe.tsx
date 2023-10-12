"use client"

import { RawUniverse, Sim, SimState, Universe } from "@/sim/sim"
import { ChangeEvent, MouseEvent, useEffect, useMemo, useState } from "react"
import { Blaseball, FrontendVersion } from "@/components/Blaseball"
import assert from "assert"
import Link from "next/link"
import { CHECKPOINT_INTERVAL } from "@/app/api/updateTimeCache"

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

export function VersionSelect({ universe, universeId }: { universe: Universe | RawUniverse, universeId?: string }) {

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
    version && <Universe universe={universe} universeId={universeId} version={version} onChangeVersion={onChangeVersion} />
  )
}

function Universe({ universe: inUniverse, universeId, version, onChangeVersion }: {
  universe: Universe | RawUniverse,
  universeId?: string,
  version: FrontendVersion,
  onChangeVersion: (event: ChangeEvent<HTMLInputElement>) => void,
}) {
  const universe = useMemo(() => {
    if (inUniverse.sim instanceof Sim) {
      return inUniverse as Universe
    }
    let u: Universe = {
      origin: inUniverse.origin,
      sim: Sim.fromJSON(inUniverse.sim)
    }
    return u
  }, [inUniverse])
  const [renderState, setRenderState] = useState<SimState>(() => universe.sim.state)
  const [nextCheckpointTime, setNextCheckpointTime] = useState(() =>
    new Date(universe.sim.state.time.getTime() + CHECKPOINT_INTERVAL))

  useEffect(() => {
    if (!universe) return
    let timeout: NodeJS.Timeout
    let nextTime = new Date()
    let ticker = () => {
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

  // it might be important for checkpoints to be after ticks? not sure
  // i think (and hope) this will always snap to present, rather than marching there in intervals of CHECKPOINT_INTERVAL
  useEffect(() => {
    const delta = Math.max(0, nextCheckpointTime.getTime() - (new Date()).getTime())
    const timeout = window.setTimeout(() => {
      const data = JSON.stringify(universe)
      fetch(`/api/universe/${universeId}`, {
        method: "PUT",
        body: data
      })
        .finally(() => setNextCheckpointTime(new Date(universe.sim.state.time.getTime() + CHECKPOINT_INTERVAL)))
    }, delta)
    return () => window.clearTimeout(timeout)
    // universe doesn't change identity so this shouldn't re-run unnecessarily
  }, [nextCheckpointTime, universe, universeId])

  const [isStabilizing, setIsStabilizing] = useState(false)
  const { season, day, offset } = universe.origin
  const onClickStabilize = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (isStabilizing) return
    setIsStabilizing(true)
    const data = JSON.stringify(universe)
    fetch("/api/universe", {
      method: "POST",
      body: data
    })
      .then(result => result.json())
      .then(result => {
        if (result.status === "success") {
          window.location.href = `/${result.id}`
        }
      })
      // TODO There should be better error handling than this
      .finally(() => setIsStabilizing(false))
  }

  const [showCopiedMessage, setShowCopiedMessage] = useState(false)
  const onClickCopy = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    navigator.clipboard.writeText(document.location.href)
      .then(() => {
        setShowCopiedMessage(true)
        window.setTimeout(() => setShowCopiedMessage(false), 5000)
      })
      .catch(e => console.error(e))
  }
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
        Current location: {!universeId ? "Ephemeral" : "Stable"} universe originating
        s{season < 0 ? "CC" : (season + 1)}d{day + 1}+{msToDisplayTime(offset)}
      </div>
      <div className="ib-universe-control">
        {!universeId && <Link href={"#"} onClick={onClickStabilize} className={isStabilizing ? "stabilizing" : ""}>
          {isStabilizing ? "Stabilizing..." : "Stabilize"}
        </Link>}
        {universeId && <Link href={`/${universeId}`} onClick={onClickCopy}>
          {showCopiedMessage ? "Copied!" : "Copy link to universe" }
        </Link>}
      </div>
    </nav>

    <Blaseball simState={renderState} playerMap={universe.sim.players} version={version} />
  </main>)
}