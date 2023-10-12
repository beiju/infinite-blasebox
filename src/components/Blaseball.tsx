import { SimState } from "@/sim/sim"
import { Player } from "@/chron"
import { BlaseballS6 } from "@/components/BlaseballS6"
import { BlaseballS13 } from "@/components/BlaseballS13"

export enum FrontendVersion {
  Season6,
  Season13,
}

export function Blaseball({ simState, playerMap, version }: {
  simState: SimState,
  playerMap: Map<string, Player>,
  version: FrontendVersion
}) {
  switch (version) {
    case FrontendVersion.Season6:
      return BlaseballS6({ simState, playerMap })
    case FrontendVersion.Season13:
      return BlaseballS13({ simState, playerMap })
  }
}


