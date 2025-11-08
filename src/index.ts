import { setTimeout } from "node:timers/promises";
import { serve } from "@hono/node-server";
import DraftLog from "draftlog";
import GtfsRealtime from "gtfs-realtime-bindings";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { Temporal } from "temporal-polyfill";

import { loadConfiguration } from "./configuration/load-configuration.js";
import { loadGtfs } from "./gtfs/load-gtfs.js";
import { doesServiceRunOn } from "./gtfs/utils.js";
import { createGtfsRtFeed } from "./gtfs-rt/create-feed.js";
import { downloadHawkTripDetails } from "./hawk/download-trip-details.js";
import { downloadHawkVehicles } from "./hawk/download-vehicles.js";
import { configurationPath } from "./options.js";

DraftLog(console, !process.stdout.isTTY)?.addLineListener(process.stdin);

console.log(`  ___      _    _ _      _  _             _     ___                                
 | _ \\_  _| |__| (_)__  | || |__ ___ __ _| |__ | _ \\_ _ ___  __ ___ ______ ___ _ _ 
 |  _/ || | '_ \\ | / _| | __ / _\` \\ V  V / / / |  _/ '_/ _ \\/ _/ -_|_-<_-</ _ \\ '_|
 |_|  \\_,_|_.__/_|_\\__| |_||_\\__,_|\\_/\\_/|_\\_\\ |_| |_| \\___/\\__\\___/__/__/\\___/_|  `);
console.log();

const envAwareConfigurationPath = configurationPath ?? process.env.CONFIGURATION_PATH;
if (envAwareConfigurationPath === undefined) {
	console.error("Usage: hawk-public-processor [configuration path]");
	console.error(
		"Configuration path can also be set using the 'CONFIGURATION_ENV' environment variable.",
	);
	process.exit(1);
}

const { gtfsResourceHref, hawkId, refreshInterval, matchRoute, matchStopTime } =
	await loadConfiguration(envAwareConfigurationPath);

//- Stores initialization

const tripUpdates = new Map<string, GtfsRealtime.transit_realtime.ITripUpdate>();
const vehiclePositions = new Map<string, GtfsRealtime.transit_realtime.IVehiclePosition>();

setInterval(() => {
	const now = Temporal.Now.instant();

	tripUpdates.entries().forEach(([key, tripUpdate]) => {
		if (
			now
				.since(Temporal.Instant.fromEpochMilliseconds(+tripUpdate.timestamp! * 1000))
				.total("minutes") >= 10
		) {
			tripUpdates.delete(key);
		}
	});

	vehiclePositions.entries().forEach(([key, vehiclePosition]) => {
		if (
			now
				.since(Temporal.Instant.fromEpochMilliseconds(+vehiclePosition.timestamp! * 1000))
				.total("minutes") >= 10
		) {
			vehiclePositions.delete(key);
		}
	});
}, 120_000);

//- Web server initialization

const hono = new Hono();
hono.get("/trip-updates", (c) => {
	const feed = createGtfsRtFeed(tripUpdates.values());
	return stream(c, async (s) => {
		const encodedFeed = GtfsRealtime.transit_realtime.FeedMessage.encode(feed).finish();
		await s.write(encodedFeed);
	});
});
hono.get("/trip-updates.json", (c) => {
	const feed = createGtfsRtFeed(tripUpdates.values());
	return c.json(feed, 200);
});

hono.get("/vehicle-positions", (c) => {
	const feed = createGtfsRtFeed(vehiclePositions.values());
	return stream(c, async (s) => {
		const encodedFeed = GtfsRealtime.transit_realtime.FeedMessage.encode(feed).finish();
		await s.write(encodedFeed);
	});
});
hono.get("/vehicle-positions.json", (c) => {
	const feed = createGtfsRtFeed(vehiclePositions.values());
	return c.json(feed, 200);
});

const port = +(process.env.PORT ?? 3000);
serve({ fetch: hono.fetch, port });
console.log(`🌍 Listening on port ${port}.`);

//- Main program

console.log(`🔄 Loading GTFS resource at '${gtfsResourceHref}'.`);
const gtfs = await loadGtfs(hawkId, gtfsResourceHref);

while (true) {
	const then = Temporal.Now.instant().epochMilliseconds;

	const today = Temporal.Now.plainDateISO();
	const todayTrips = gtfs.trips
		.values()
		.filter((trip) => doesServiceRunOn(trip.service, today))
		.toArray();

	console.log("🚍 Fetching live vehicles from Hawk.");
	const vehicles = await downloadHawkVehicles(hawkId);

	for (const vehicle of vehicles) {
		console.log(`\tProcessing vehicle '${vehicle.ParcNumber}'.`);
		const { Schedule: schedule } = await downloadHawkTripDetails(hawkId, vehicle.ParcNumber);
		if (schedule === null) {
			console.warn(`\t\tNo schedule information available, ignoring.`);
			continue;
		}

		const nextStops = schedule.slice(schedule.findIndex((s) => s.StopName === vehicle.NextStop));
		const referenceTime = nextStops.at(0)
			? Temporal.PlainTime.from(`${nextStops.at(0)!.Schedule}:00`)
			: null;

		if (referenceTime === null) {
			console.warn(`\t\tCould not compute reference time, ignoring.`);
			continue;
		}

		const plausibleTrip = todayTrips
			.filter((trip) => {
				if (!matchRoute(trip.route, vehicle, schedule)) {
					return false;
				}

				if (!matchStopTime(trip.stopTimes.at(0)!, schedule.at(0)!)) {
					return false;
				}

				if (!matchStopTime(trip.stopTimes.at(-1)!, schedule.at(-1)!)) {
					return false;
				}

				return trip.stopTimes.some((stopTime) => matchStopTime(stopTime, nextStops.at(0)!));
			})
			.sort((a, b) => {
				const aStopTime = Temporal.PlainTime.from(
					a.stopTimes.find((stopTime) => matchStopTime(stopTime, nextStops[0]!))!.time,
				);

				const bStopTime = Temporal.PlainTime.from(
					b.stopTimes.find((stopTime) => matchStopTime(stopTime, nextStops[0]!))!.time,
				);

				return (
					referenceTime.since(aStopTime).total("seconds") -
					referenceTime.since(bStopTime).total("seconds")
				);
			})
			.at(0);

		if (plausibleTrip === undefined) {
			console.warn(`\t\tDid not find any plausible trip, ignoring.`);
			continue;
		}

		const tripDescriptor: GtfsRealtime.transit_realtime.ITripDescriptor = {
			tripId: plausibleTrip.id,
			routeId: plausibleTrip.route.id,
			directionId: plausibleTrip.directionId,
			scheduleRelationship:
				GtfsRealtime.transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
		};

		const vehicleDescriptor: GtfsRealtime.transit_realtime.IVehicleDescriptor = {
			id: vehicle.ParcNumber,
			label: vehicle.ParcNumber,
		};

		tripUpdates.set(plausibleTrip.id, {
			stopTimeUpdate: nextStops.map((nextStop) => {
				const gtfsStopTime = plausibleTrip.stopTimes.find((stopTime) =>
					matchStopTime(stopTime, nextStop),
				)!;
				const stopTimeDescriptor = {
					stopId: gtfsStopTime.stop.id,
					stopSequence: gtfsStopTime.sequence,
				} as const;

				const scheduledAt = Math.floor(
					Temporal.Now.zonedDateTimeISO().withPlainTime(
						Temporal.PlainTime.from(`${nextStop.Schedule}:00`),
					).epochMilliseconds / 1000,
				);

				return {
					...(gtfsStopTime.sequence > 1
						? {
								arrival: {
									time: scheduledAt,
								},
							}
						: {}),
					...(gtfsStopTime.sequence < plausibleTrip.stopTimes.length
						? {
								departure: {
									time: scheduledAt,
								},
							}
						: {}),
					...stopTimeDescriptor,
					scheduleRelationship:
						GtfsRealtime.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED,
				};
			}),
			timestamp: Math.floor(then / 1000),
			trip: tripDescriptor,
		});

		vehiclePositions.set(vehicle.ParcNumber, {
			position: {
				latitude: +vehicle.Latitude,
				longitude: +vehicle.Longitude,
			},
			timestamp: Math.floor(then / 1000),
			trip: tripDescriptor,
			vehicle: vehicleDescriptor,
		});
	}

	const now = Temporal.Now.instant().epochMilliseconds;
	const waitingTime = Math.max(0, refreshInterval - (now - then));
	console.log(`✅ Done! Next round in ${waitingTime}ms`);
	await setTimeout(waitingTime);
}
