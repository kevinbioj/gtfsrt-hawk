import { setTimeout } from "node:timers/promises";
import { serve } from "@hono/node-server";
import GtfsRealtime from "gtfs-realtime-bindings";
import { Hono } from "hono";
import { Temporal } from "temporal-polyfill";

import { PORT } from "./config.js";
import { loadConfiguration } from "./configuration/load-configuration.js";
import { TIMEZONE } from "./constants.js";
import { useGtfsResource } from "./gtfs/load-resource.js";
import { handleRequest } from "./gtfs-rt/handle-request.js";
import { useRealtimeStore } from "./gtfs-rt/use-realtime-store.js";
import { downloadHawkTripDetails } from "./hawk/download-trip-details.js";
import { downloadHawkVehicles } from "./hawk/download-vehicles.js";
import { configurationPath } from "./options.js";

console.log(`  ___      _    _ _      _  _             _     ___                                
 | _ \\_  _| |__| (_)__  | || |__ ___ __ _| |__ | _ \\_ _ ___  __ ___ ______ ___ _ _ 
 |  _/ || | '_ \\ | / _| | __ / _\` \\ V  V / / / |  _/ '_/ _ \\/ _/ -_|_-<_-</ _ \\ '_|
 |_|  \\_,_|_.__/_|_\\__| |_||_\\__,_|\\_/\\_/|_\\_\\ |_| |_| \\___/\\__\\___/__/__/\\___/_|  `);
console.log();

const envAwareConfigurationPath = configurationPath ?? process.env.CONFIGURATION_PATH;
if (envAwareConfigurationPath === undefined) {
	console.error("Usage: hawk-public-processor [configuration path]");
	console.error("Configuration path can also be set using the 'CONFIGURATION_ENV' environment variable.");
	process.exit(1);
}

const { gtfsResourceHref, hawkId, refreshInterval, matchRoute, matchStopTime } =
	await loadConfiguration(envAwareConfigurationPath);

const store = useRealtimeStore();

const hono = new Hono();
hono.get("/trip-updates", (c) => handleRequest(c, "protobuf", store.tripUpdates, null));
hono.get("/trip-updates.json", (c) => handleRequest(c, "json", store.tripUpdates, null));
hono.get("/vehicle-positions", (c) => handleRequest(c, "protobuf", null, store.vehiclePositions));
hono.get("/vehicle-positions.json", (c) => handleRequest(c, "json", null, store.vehiclePositions));
hono.get("/", (c) =>
	handleRequest(c, c.req.query("format") === "json" ? "json" : "protobuf", store.tripUpdates, store.vehiclePositions),
);
serve({ fetch: hono.fetch, port: PORT });
console.log(`➔ Listening on :${PORT}`);

// ---

const gtfsResource = await useGtfsResource(gtfsResourceHref);

while (true) {
	const startedAt = Date.now();
	let error: unknown | undefined;

	try {
		console.log("➔ Fetching vehicles from Hawk public map.");
		const vehicles = await downloadHawkVehicles(hawkId);

		for (const vehicle of vehicles) {
			const { Schedule: schedule } = await downloadHawkTripDetails(hawkId, vehicle.ParcNumber);
			if (schedule === null) {
				console.warn(`    ${vehicle.ParcNumber}\tNo schedule information for vehicle.`);
				continue;
			}

			const nextStops = schedule.slice(schedule.findIndex((s) => s.State === "Estimated"));
			const referenceTime = nextStops.at(0) ? Temporal.PlainTime.from(`${nextStops.at(0)!.Schedule}:00`) : null;

			if (referenceTime === null) {
				console.warn(`    ${vehicle.ParcNumber}\tFailed to compute reference time.`);
				continue;
			}

			const trip = gtfsResource.operatingTrips
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
						Math.abs(referenceTime.since(aStopTime).total("seconds")) -
						Math.abs(referenceTime.since(bStopTime).total("seconds"))
					);
				})
				.at(0);

			const tripDescriptor = trip
				? {
						tripId: trip.id,
						routeId: trip.route.id,
						directionId: trip.directionId,
						scheduleRelationship: GtfsRealtime.transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
					}
				: undefined;

			const vehicleDescriptor = {
				id: vehicle.ParcNumber,
				label: vehicle.DestinationName,
			};

			if (trip !== undefined) {
				store.tripUpdates.set(trip.id, {
					stopTimeUpdate: schedule.flatMap((nextStop) => {
						const gtfsStopTime = trip.stopTimes.find((stopTime) => matchStopTime(stopTime, nextStop));

						if (gtfsStopTime === undefined) {
							return [];
						}

						const stopTimeDescriptor = {
							stopId: gtfsStopTime.stop.id,
							stopSequence: gtfsStopTime.sequence,
						} as const;

						const scheduledAt = Math.floor(
							Temporal.Now.zonedDateTimeISO(TIMEZONE).withPlainTime(Temporal.PlainTime.from(`${nextStop.Schedule}:00`))
								.epochMilliseconds / 1000,
						);

						return {
							...(gtfsStopTime.sequence > 1
								? {
										arrival: {
											time: scheduledAt,
										},
									}
								: {}),
							...(gtfsStopTime.sequence < trip.stopTimes.length
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
					timestamp: Math.floor(startedAt / 1000),
					trip: tripDescriptor!,
					vehicle: vehicleDescriptor,
				});
			}

			const currentStop = trip?.stopTimes.find((stopTime) =>
				matchStopTime(
					stopTime,
					schedule.find((s) => s.State === "Estimated"),
				),
			);

			store.vehiclePositions.set(vehicle.ParcNumber, {
				currentStatus: currentStop
					? GtfsRealtime.transit_realtime.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO
					: undefined,
				currentStopSequence: currentStop?.sequence,
				position: {
					latitude: +vehicle.Latitude,
					longitude: +vehicle.Longitude,
					bearing: (270 + vehicle.Angle) % 360,
				},
				stopId: currentStop?.stop.id,
				timestamp: Math.floor(startedAt / 1000),
				trip: tripDescriptor,
				vehicle: vehicleDescriptor,
			});

			if (trip === undefined) {
				console.warn(`    ${vehicle.ParcNumber}\tFailed to find trip, publishing as non-commercial.`);
			} else {
				console.log(
					`    ${vehicle.ParcNumber}\t${trip.route.name} ${trip.directionId} > ${vehicle.DestinationName} (${trip.id})`,
				);
			}
		}
	} catch (cause) {
		error = cause;
	} finally {
		const waitingTime = Math.max(refreshInterval - (Date.now() - startedAt), 0);

		if (error !== undefined) {
			console.error(`✘ Failed to compute vehicle batch, retrying in ${waitingTime}ms`, error);
		} else {
			console.log(`✓ Done processing vehicle batch, waiting for ${waitingTime}ms`);
		}

		await setTimeout(waitingTime);
	}
}
