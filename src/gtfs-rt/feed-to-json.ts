import GtfsRealtime from "gtfs-realtime-bindings";

export function feedToJson(feed: GtfsRealtime.transit_realtime.FeedMessage) {
	return GtfsRealtime.transit_realtime.FeedMessage.toObject(feed, {
		enums: String,
		longs: Number,
	});
}
