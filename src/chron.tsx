type Chron<ItemType> = {
  nextPage: string | null,
  items: ItemType[]
}
export type Item<DataType> = {
  entityId: string,
  hash: string,
  validFrom: string,
  validTo: string | null,
  data: DataType
}
export type Team = {
  id: string,
  bench: string[],
  emoji: string,
  lineup: string[],
  slogan: string,
  bullpen: string[],
  fullName: string,
  gameAttr: string[],
  location: string,
  nickname: string,
  permAttr: string[],
  rotation: string[],
  seasAttr: string[],
  weekAttr: string[],
  mainColor: string,
  shameRuns: number,
  shorthand: string,
  totalShames: number,
  seasonShames: number,
  championships: number,
  totalShamings: number,
  seasonShamings: number,
  secondaryColor: string,
}
export type Player = {
  id: string,
  bat: string,
  fate: number,
  name: string,
  soul: number,
  armor: string,
  blood: number,
  moxie: number,
  coffee: number,
  ritual: string,
  buoyancy: number,
  cinnamon: number,
  coldness: number,
  deceased: boolean,
  divinity: number,
  gameAttr: string[],
  permAttr: string[],
  seasAttr: string[],
  weekAttr: string[],
  chasiness: number,
  martyrdom: number,
  baseThirst: number,
  indulgence: number,
  musclitude: number,
  tragicness: number,
  omniscience: number,
  patheticism: number,
  suppression: number,
  continuation: number,
  ruthlessness: number,
  totalFingers: number,
  watchfulness: number,
  laserlikeness: number,
  overpowerment: number,
  peanutAllergy: boolean,
  tenaciousness: number,
  thwackability: number,
  anticapitalism: number,
  groundFriction: number,
  pressurization: number,
  unthwackability: number,
  shakespearianism: number,
}

export async function chroniclerFetch<DataType>(type: string, at: string) {
  // Could do pagination in here... or just be lazy and use a huge count
  const res = await fetch(`https://api.sibr.dev/chronicler/v2/entities?type=${type}&at=${at}&count=1000`)
  const obj: Chron<Item<DataType>> = await res.json()
  return obj.items
}