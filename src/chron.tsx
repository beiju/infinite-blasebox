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
  bench?: uuid[],
  emoji: string,
  lineup: uuid[],
  slogan: string,
  bullpen?: uuid[],
  shadows?: uuid[],
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
  const url = `https://api.sibr.dev/chronicler/v2/entities?type=${type}&at=${at}&count=2000${idString}`
  console.log("Fetching", url)
  const res = await fetch(url)
  const obj: Chron<Item<DataType>> = await res.json()
  return obj.items
}

export async function chroniclerFetchActiveTeams(at: string, reportProgress: (progress: number) => void): Promise<Item<Team>[]> {
  const sims = await chroniclerFetch<Sim>("sim", at)
  reportProgress(1)
  console.assert(sims.length === 1)
  const leagueId = sims[0].data.league
  const leagues = await chroniclerFetch<League>("league", at, leagueId)
  reportProgress(2)
  console.assert(leagues.length === 1)
  const subleagueIds = leagues[0].data.subleagues
  const subleagues = await chroniclerFetch<Subleague>("subleague", at, subleagueIds)
  reportProgress(3)
  const divisionIds = subleagues.flatMap(subleague => subleague.data.divisions)
  const divisions = await chroniclerFetch<Division>("division", at, divisionIds)
  reportProgress(4)
  const teamIds = divisions.flatMap(division => division.data.teams)
  return await chroniclerFetch<Team>("team", at, teamIds)
}

export type Playoff = {
  id: uuid,
  name: string,
  rounds: uuid[]
  season: number,
  winner: uuid | null,
  playoffDay: number,
  tournament: number,
  tomorrowRound: number,
  numberOfRounds: number,
}

export type PlayoffRound = {
  id: uuid,
  name: string,
  games: (uuid | "none")[][],
  special: boolean,
  winners: uuid[],
  matchups: uuid[],
  gameIndex: number,
  roundNumber: number,
  winnerSeeds: number[],
}

export type PlayoffMatchup = {
  id: uuid,
  name:	null,
  awaySeed:	number,
  awayTeam: uuid,
  awayWins: number,
  homeSeed: number,
  homeTeam: uuid,
  homeWins: 3,
  gamesNeeded: string,
  gamesPlayed: number,
}

export async function chroniclerFetchCoffeeCupTeams(at: string, reportProgress: (progress: number) => void): Promise<Item<Team>[]> {
  const playoffs = await chroniclerFetch<Playoff>("playoffs", at, "7649f0da-100e-49b5-9110-91be3d786d4a")
  reportProgress(2) // we skipped step 1
  console.assert(playoffs.length === 1)
  // Only need to grab the first round. Subsequent rounds are a subset of those teams.
  const rounds = await chroniclerFetch<PlayoffRound>("playoffround", at, playoffs[0].data.rounds[0])
  reportProgress(3)
  console.assert(rounds.length === 1)
  const matchups = await chroniclerFetch<PlayoffMatchup>("playoffmatchup", at, rounds[0].data.matchups)
  reportProgress(4)
  const teamIds = matchups.flatMap(matchup => [matchup.data.homeTeam, matchup.data.awayTeam])
  return await chroniclerFetch<Team>("team", at, teamIds)
}