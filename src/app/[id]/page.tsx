import { sql } from "@vercel/postgres"
import { RawUniverse } from "@/sim/sim"
import { VersionSelect } from "@/components/Universe"

export default async function Page({ params }: { params: { id: string } }) {
  const { rows } = await sql`SELECT data, id FROM universes where id = ${params.id};`
  const rawUniverse: RawUniverse = JSON.parse(rows[0].data)
  return (
    <VersionSelect universe={rawUniverse} universeId={rows[0].id} />
  )
}