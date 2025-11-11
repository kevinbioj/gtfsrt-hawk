import GtfsRealtime from "gtfs-realtime-bindings";
import { Temporal } from "temporal-polyfill";

export function createGtfsRtFeed(
	entities: MapIterator<
		GtfsRealtime.transit_realtime.ITripUpdate | GtfsRealtime.transit_realtime.IVehiclePosition
	>,
) {
	return GtfsRealtime.transit_realtime.FeedMessage.create({
		header: {
			gtfsRealtimeVersion: "2.0",
			incrementality: GtfsRealtime.transit_realtime.FeedHeader.Incrementality.FULL_DATASET,
			timestamp: Math.floor(Temporal.Now.instant().epochMilliseconds / 1000),
		},
		entity: entities
			.map((entity) => {
				const id = "vehicle" in entity ? `VM:${entity.vehicle?.id}` : `SM:${entity.trip?.tripId}`;
				if ("stopTimeUpdate" in entity) {
					return { id, tripUpdate: entity as GtfsRealtime.transit_realtime.ITripUpdate };
				}
				return { id, vehicle: entity as GtfsRealtime.transit_realtime.IVehiclePosition };
			})
			.toArray(),
	});
}
