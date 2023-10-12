export function checkedGet<T>(map: Map<string, T>, id: string): T {
  const entry = map.get(id)
  if (typeof entry === "undefined") {
    throw new Error("Unknown entry in map")
  }
  return entry
}