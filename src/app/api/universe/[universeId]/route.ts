import { sql } from "@vercel/postgres"
import { NextResponse } from "next/server"
import { CHECKPOINT_INTERVAL, CHECKPOINT_TIME_CACHE } from "@/app/api/updateTimeCache"
import { RawUniverse } from "@/sim/sim"

export async function PUT(req: Request, { params }: { params: { universeId: string } }) {
  const data = await req.text()

  const { universeId } = params
  const now = new Date()
  const lastUpdate = CHECKPOINT_TIME_CACHE[universeId]
  if (lastUpdate && now.getTime() - lastUpdate.getTime() < CHECKPOINT_INTERVAL) {
    console.log("Last update was only ", (now.getTime() - lastUpdate.getTime()) / 1000, "seconds ago; skipping update")
    return NextResponse.json({
      status: "skipped",
    })
  }
  console.log("Writing universe to db at tick", JSON.parse(data).sim.state.tick, "with id", universeId)
  const { rows } = await sql`UPDATE universes SET data = ${data} WHERE id = ${universeId} RETURNING data;`
  console.log("db call returned tick", JSON.parse(rows[0].data).sim.state.tick)

  const { rows: r } = await sql`SELECT data, id FROM universes where id = ${universeId};`
  console.log("Got", r.length, "results")
  const rawUniverse: RawUniverse = JSON.parse(r[0].data)
  console.log("Read universe from db at tick", rawUniverse.sim.state.tick, "with id", universeId)

  CHECKPOINT_TIME_CACHE[universeId] = now
  return NextResponse.json({
    status: "success",
  })
}