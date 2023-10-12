import { sql } from "@vercel/postgres"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const data = await req.text()
  const { rows } = await sql`INSERT INTO universes (data) VALUES (${data}) RETURNING id;`
  return NextResponse.json({
    status: "success",
    id: rows[0].id,
  })
}