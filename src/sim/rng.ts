export type RawRng = { s0: string, s1: string }

export class Rng {
  state0: bigint
  state1: bigint

  constructor(seed0: bigint, seed1: bigint) {
    // TODO is this the best way to seed it?
    this.state0 = seed0
    this.state1 = seed1
  }

  next() {
    [this.state0, this.state1] = xs128p(this.state0, this.state1)
    return state_to_double(this.state0)
  }

  toJSON() {
    return { s0: this.state0.toString(10), s1: this.state1.toString(10) }
  }

  static fromJSON(rawRng: RawRng) {
    const s0 = BigInt(rawRng.s0)
    const s1 = BigInt(rawRng.s1)

    return new this(s0, s1)
  }
}

const STATE_MASK = 0xFFFFFFFFFFFFFFFFn

function xs128p(state0: bigint, state1: bigint) {
  let s1 = state0 & STATE_MASK
  let s0 = state1 & STATE_MASK
  s1 ^= (s1 << 23n) & STATE_MASK
  s1 ^= (s1 >> 17n) & STATE_MASK
  s1 ^= s0 & STATE_MASK
  s1 ^= (s0 >> 26n) & STATE_MASK
  state0 = state1 & STATE_MASK
  state1 = s1 & STATE_MASK
  return [state0, state1]
}

function state_to_double(s0: bigint) {
  const dataView = new DataView((new Float64Array(1)).buffer)
  const mantissa = s0 >> 12n
  dataView.setBigInt64(0, mantissa | 0x3FF0000000000000n)
  return dataView.getFloat64(0) - 1
}