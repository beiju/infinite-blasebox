import schedule_json from "./schedule.json"

export default schedule_json.map(obj => ({
  season: obj.season,
  day: obj.day,
  start_time: new Date(obj.start_time),
  end_time: new Date(obj.end_time)
}))