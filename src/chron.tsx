type Chron<ItemType> = {
  nextPage: string | null,
  items: ItemType[]
}

type uuid = string;

export type Item<DataType> = {
  entityId: uuid,
  hash: string,
  validFrom: string,
  validTo: string | null,
  data: DataType
}

export type Sim = {
  id: uuid;
  day: number;
  attr: string[];
  phase: number;
  rules: uuid;
  league: uuid;
  season: number;
  eraColor: string;
  eraTitle: string;
  playoffs: uuid;
  seasonId: uuid;
  agitations: number;
  tournament: number;
  godsDayDate: Date;
  salutations: number;
  subEraColor: string;
  subEraTitle: string;
  terminology: uuid;
  electionDate: Date;
  playOffRound: number;
  endseasonDate: Date;
  midseasonDate: Date;
  nextPhaseTime: Date;
  preseasonDate: Date;
  earlseasonDate: Date;
  earlsiestaDate: Date;
  lateseasonDate: Date;
  latesiestaDate: Date;
  tournamentRound: number;
  earlpostseasonDate: Date;
  latepostseasonDate: Date;
}

export type League = {
  id: uuid;
  name: string;
  subleagues: uuid[];
  tiebreakers: string;
}

export type Subleague = {
  id: uuid;
  name: string;
  divisions: uuid[];
}

export type Division = {
  id: uuid;
  name: string;
  teams: uuid[];
}

export type Team = {
  id: uuid,
  bench: uuid[],
  emoji: string,
  lineup: uuid[],
  slogan: string,
  bullpen: uuid[],
  fullName: string,
  gameAttr: string[],
  location: string,
  nickname: string,
  permAttr: string[],
  rotation: uuid[],
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
  id: uuid,
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

export async function chroniclerFetch<DataType>(type: string, at: string, ids?: uuid | uuid[]) {
  let idString = ""
  if (typeof ids === "string") {
    idString += `&id=${ids}`
  } else if (typeof ids !== "undefined") {
    idString += `&id=${ids.join(",")}`
  }
  // Could do pagination in here... or just be lazy and use a huge count
  const url = `https://api.sibr.dev/chronicler/v2/entities?type=${type}&at=${at}&count=1000${idString}`
  console.log("Fetching", url)
  const res = await fetch(url)
  const obj: Chron<Item<DataType>> = await res.json()
  return obj.items
}

export async function chroniclerFetchActiveTeams(at: string): Promise<Item<Team>[]> {
  const sims = await chroniclerFetch<Sim>("sim", at)
  console.assert(sims.length === 1)
  const leagueId = sims[0].data.league
  const leagues = await chroniclerFetch<League>("league", at, leagueId)
  console.assert(leagues.length === 1)
  const subleagueIds = leagues[0].data.subleagues
  const subleagues = await chroniclerFetch<Subleague>("subleague", at, subleagueIds)
  const divisionIds = subleagues.flatMap(subleague => subleague.data.divisions)
  const divisions = await chroniclerFetch<Division>("division", at, divisionIds)
  const teamIds = divisions.flatMap(division => division.data.teams)
  return await chroniclerFetch<Team>("team", at, teamIds)
}