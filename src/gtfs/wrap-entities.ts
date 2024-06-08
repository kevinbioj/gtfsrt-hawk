import dayjs from "dayjs";

import type {
  GtfsRtTripUpdate,
  GtfsRtVehiclePosition,
  TripUpdateEntity,
  VehiclePositionEntity,
} from "./types";

export function wrapEntities(entities: (TripUpdateEntity | VehiclePositionEntity)[]) {
  return {
    header: {
      gtfsRealtimeVersion: "2.0",
      timestamp: dayjs().unix(),
    },
    entity: entities,
  } as GtfsRtTripUpdate | GtfsRtVehiclePosition;
}
