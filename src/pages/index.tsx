import type { GetStaticProps, InferGetStaticPropsType } from 'next'
import { ChangeEvent, useEffect, useMemo, useState } from "react"
import { chroniclerFetch, chroniclerFetchActiveTeams, Item, Player, Team } from "@/chron"
import { Sim } from "@/sim/sim"
import Head from "next/head"
import { Blaseball, FrontendVersion } from "@/components/Blaseball"

export const getStaticProps: GetStaticProps<{
  teams: Item<Team>[], players: Item<Player>[]
}> = async () => {
  const at = "2021-03-08T16:09:04.026Z"
  const playersPromise = chroniclerFetch<Player>("player", at)
  const teamsPromise = chroniclerFetchActiveTeams(at)
  const [teams, players] = await Promise.all([teamsPromise, playersPromise])
  // I did not think about the cultural sensitivity fixes when I picked this season
  for (const team of teams) {
    if (team.data.nickname === "Dalé") team.data.nickname = "Dale"
    if (team.data.location === "Hawai'i") team.data.nickname = "Hawaii"
  }
  return { props: { teams, players } }
}

export default function Index({
                                teams, players,
                              }: InferGetStaticPropsType<typeof getStaticProps>) {
  const sim = useMemo(() => new Sim(1398547n, 382746019348n, players, teams), [players, teams])
  const [simState, setSimState] = useState(sim.state)

  useEffect(() => {
    sim.start(newState => setSimState(newState))
    return () => sim.stop()
  }, [sim]) // sim should never change! so this should only run once per mount

  const [version, setVersion] = useState(FrontendVersion.Season6)

  const onChangeVersion = (event: ChangeEvent<HTMLInputElement>) => {
    setVersion(FrontendVersion[event.currentTarget.name as keyof typeof FrontendVersion])
  }
  return (
    // theme-dark is for the season 13 UI
    <div id="root" className="theme-dark">
      <Head>
        <title>The Infinite Blasebox</title>
      </Head>

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

      <Blaseball simState={simState} playerMap={sim.players} version={version} />
    </div>
  )
}