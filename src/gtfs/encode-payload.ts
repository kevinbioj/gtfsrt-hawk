import { join } from "node:path";
import protobufjs from "protobufjs";

import type { GtfsRtTripUpdate, GtfsRtVehiclePosition } from "./types.js";

const proto = protobufjs.loadSync(
	join(import.meta.dirname, "..", "..", "assets", "gtfs-realtime.proto"),
).root.lookupType("transit_realtime.FeedMessage");

export function encodePayload(
	payload: GtfsRtTripUpdate | GtfsRtVehiclePosition,
) {
	return proto.encode(payload).finish();
}
