import { sql } from "@vercel/postgres"
import { NextResponse } from "next/server"
import { CHECKPOINT_INTERVAL, CHECKPOINT_TIME_CACHE } from "@/app/api/updateTimeCache"

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
  await sql`UPDATE universes SET (data) = (${data}) WHERE id = ${universeId};`
  CHECKPOINT_TIME_CACHE[universeId] = now
  return NextResponse.json({
    status: "success",
  })
}