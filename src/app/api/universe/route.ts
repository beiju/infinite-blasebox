import { sql } from "@vercel/postgres"
import { NextResponse } from "next/server"
import { CHECKPOINT_TIME_CACHE } from "@/app/api/updateTimeCache"

export async function POST(req: Request) {
  const data = await req.text()
  const now = new Date()
  const { rows } = await sql`INSERT INTO universes (data) VALUES (${data}) RETURNING id;`
  CHECKPOINT_TIME_CACHE[rows[0].id] = now
  return NextResponse.json({
    status: "success",
    id: rows[0].id,
  })
}