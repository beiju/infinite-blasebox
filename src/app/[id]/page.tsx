import { sql } from "@vercel/postgres"
import { RawUniverse } from "@/sim/sim"
import { VersionSelect } from "@/components/Universe"

export default async function Page({ params }: { params: { id: string } }) {
  const { rows } = await sql`SELECT data, id FROM universes where id = ${params.id};`
  console.log("Got", rows.length, "results")
  const rawUniverse: RawUniverse = JSON.parse(rows[0].data)
  console.log("Read universe from db at tick", rawUniverse.sim.state.tick, "with id", params.id)
  return (
    <VersionSelect universe={rawUniverse} universeId={rows[0].id} />
  )
}