import { access, constants } from "node:fs/promises";
import { join } from "node:path";

import { parseCsv } from "../utils/parse-csv.js";
import { getPlainTime } from "../utils/temporal-cache.js";

export async function importResource(directory: string) {
	const routes = await importRoutes(directory);
	const services = await importServices(directory);
	const stops = await importStops(directory);
	const stopAliases = await importStopAliases(directory);
	const trips = await importTrips(directory, routes, services, stops, stopAliases);
	return { services, trips };
}

export type GtfsResource = Awaited<ReturnType<typeof importResource>>;

// --- importRoutes

type RouteRecord = {
	route_id: string;
	route_short_name: string;
};

export type Route = {
	id: string;
	name: string;
};

async function importRoutes(directory: string) {
	const routes = new Map<string, Route>();

	const routesPath = join(directory, "routes.txt");
	await parseCsv<RouteRecord>(routesPath, (routeRecord) => {
		routes.set(routeRecord.route_id, {
			id: routeRecord.route_id,
			name: routeRecord.route_short_name,
		});
	});

	return routes;
}

// --- importServices

type CalendarRecord = {
	service_id: string;
	monday: "0" | "1";
	tuesday: "0" | "1";
	wednesday: "0" | "1";
	thursday: "0" | "1";
	friday: "0" | "1";
	saturday: "0" | "1";
	sunday: "0" | "1";
	start_date: string;
	end_date: string;
};

type CalendarDatesRecord = {
	service_id: string;
	date: string;
	exception_type: "1" | "2";
};

export type Service = {
	id: string;
	days: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
	startDate: Temporal.PlainDate;
	endDate: Temporal.PlainDate;
	includedDays: Temporal.PlainDate[];
	excludedDays: Temporal.PlainDate[];
};

async function importServices(directory: string) {
	const services = new Map<string, Service>();

	const calendarPath = join(directory, "calendar.txt");
	const isCalendarReadable = await access(calendarPath, constants.R_OK)
		.then(() => true)
		.catch(() => false);

	if (isCalendarReadable) {
		await parseCsv<CalendarRecord>(calendarPath, (calendarRecord) => {
			services.set(calendarRecord.service_id, {
				id: calendarRecord.service_id,
				days: [
					Boolean(+calendarRecord.monday),
					Boolean(+calendarRecord.tuesday),
					Boolean(+calendarRecord.wednesday),
					Boolean(+calendarRecord.thursday),
					Boolean(+calendarRecord.friday),
					Boolean(+calendarRecord.saturday),
					Boolean(+calendarRecord.sunday),
				],
				startDate: Temporal.PlainDate.from(calendarRecord.start_date),
				endDate: Temporal.PlainDate.from(calendarRecord.end_date),
				excludedDays: [],
				includedDays: [],
			});
		});
	}

	const calendarDatesPath = join(directory, "calendar_dates.txt");
	const isCalendarDatesReadable = await access(calendarDatesPath, constants.R_OK)
		.then(() => true)
		.catch(() => false);

	if (isCalendarDatesReadable) {
		await parseCsv<CalendarDatesRecord>(calendarDatesPath, (calendarDatesRecord) => {
			let service = services.get(calendarDatesRecord.service_id);

			if (service === undefined) {
				service = {
					id: calendarDatesRecord.service_id,
					days: [false, false, false, false, false, false, false],
					startDate: Temporal.PlainDate.from("20000101"),
					endDate: Temporal.PlainDate.from("20991231"),
					excludedDays: [],
					includedDays: [],
				};

				services.set(service.id, service);
			}

			const date = Temporal.PlainDate.from(calendarDatesRecord.date);

			if (calendarDatesRecord.exception_type === "1") {
				service.includedDays.push(date);
			} else {
				service.excludedDays.push(date);
			}
		});
	}

	return services;
}

// --- importStops

type StopRecord = { stop_id: string; stop_code: string; stop_name: string; location_type: "0" | string };

type Stop = { id: string; code?: string; name: string };

async function importStops(directory: string) {
	const stops = new Map<string, Stop>();

	const stopsPath = join(directory, "stops.txt");
	await parseCsv<StopRecord>(stopsPath, (stopRecord) => {
		stops.set(stopRecord.stop_id, {
			id: stopRecord.stop_id,
			code: stopRecord.stop_code ?? undefined,
			name: stopRecord.stop_name,
		});
	});

	return stops;
}

// --- importStopAliases

type MergedStopRecord = { stop_id: string; merged_into_stop_id: string };

type SplitStopRecord = { source_stop_id: string; route_id: string; route_direction: string; dest_stop_id: string };

/**
 * Stop ids of the source GTFS that a processed GTFS replaced (gtfs-astuce, gtfs-vitre), as the realtime source still
 * uses them:
 * - `merged_stops.txt`: a merged stop is replaced by the kept one;
 * - `split_stops.txt`: a source stop is replaced, for a given route and direction, by `dest_stop_id`.
 */
type StopAliases = {
	/** Kept stop id → merged stop ids. */
	merged: Map<string, Set<string>>;
	/** `stopId|routeId|directionId` → source stop ids. */
	split: Map<string, Set<string>>;
	/** `stopId|routeId|directionId` of the source stops listed in `split_stops.txt`. */
	splitSources: Set<string>;
};

const routeDirectionKey = (stopId: string, routeId: string, directionId: number | string) =>
	`${stopId}|${routeId}|${directionId}`;

async function readableFile(directory: string, name: string) {
	const path = join(directory, name);
	return access(path, constants.R_OK)
		.then(() => path)
		.catch(() => undefined);
}

async function importStopAliases(directory: string) {
	const aliases: StopAliases = { merged: new Map(), split: new Map(), splitSources: new Set() };

	const mergedStopsPath = await readableFile(directory, "merged_stops.txt");
	if (mergedStopsPath !== undefined) {
		await parseCsv<MergedStopRecord>(mergedStopsPath, (mergedStopRecord) => {
			const merged = aliases.merged.get(mergedStopRecord.merged_into_stop_id) ?? new Set();
			merged.add(mergedStopRecord.stop_id);
			aliases.merged.set(mergedStopRecord.merged_into_stop_id, merged);
		});
	}

	const splitStopsPath = await readableFile(directory, "split_stops.txt");
	if (splitStopsPath !== undefined) {
		await parseCsv<SplitStopRecord>(splitStopsPath, (splitStopRecord) => {
			const { source_stop_id, route_id, route_direction, dest_stop_id } = splitStopRecord;
			aliases.splitSources.add(routeDirectionKey(source_stop_id, route_id, route_direction));

			const key = routeDirectionKey(dest_stop_id, route_id, route_direction);
			const split = aliases.split.get(key) ?? new Set();
			split.add(source_stop_id);
			aliases.split.set(key, split);
		});
	}

	return aliases;
}

/** Source stop ids designating a stop on a route and direction: the stop itself and the stops it replaced. */
function getSourceStopIds(aliases: StopAliases, stopId: string, routeId: string, directionId: number) {
	const sourceStopIds = new Set([stopId]);
	// A merged stop listed in split_stops.txt for this route and direction is replaced by its split stop instead
	for (const merged of aliases.merged.get(stopId) ?? []) {
		if (!aliases.splitSources.has(routeDirectionKey(merged, routeId, directionId))) sourceStopIds.add(merged);
	}
	for (const split of aliases.split.get(routeDirectionKey(stopId, routeId, directionId)) ?? []) {
		sourceStopIds.add(split);
	}
	return sourceStopIds;
}

// --- importTrips

type TripRecord = { trip_id: string; service_id: string; route_id: string; direction_id: "0" | "1" };

type StopTimeRecord = { trip_id: string; stop_sequence: string; stop_id: string; departure_time: string };

export type StopTime = {
	sequence: number;
	stop: Stop;
	/** Stop ids of the source GTFS designating this stop on the trip's route and direction (see `StopAliases`). */
	sourceStopIds: ReadonlySet<string>;
	time: Temporal.PlainTime;
	dayShift?: number;
};

export type Trip = { id: string; service: Service; route: Route; directionId: number; stopTimes: StopTime[] };

async function importTrips(
	directory: string,
	routes: Map<string, Route>,
	services: Map<string, Service>,
	stops: Map<string, Stop>,
	stopAliases: StopAliases,
) {
	const trips = new Map<string, Trip>();
	// Shared between the stop times of a stop on a route and direction
	const sourceStopIdsCache = new Map<string, ReadonlySet<string>>();

	const tripsPath = join(directory, "trips.txt");
	await parseCsv<TripRecord>(tripsPath, (tripRecord) => {
		const route = routes.get(tripRecord.route_id);
		if (route === undefined) {
			return;
		}

		const service = services.get(tripRecord.service_id);
		if (service === undefined) {
			return;
		}

		trips.set(tripRecord.trip_id, {
			id: tripRecord.trip_id,
			service,
			route,
			directionId: +tripRecord.direction_id,
			stopTimes: [],
		});
	});

	const stopTimesPath = join(directory, "stop_times.txt");
	await parseCsv<StopTimeRecord>(stopTimesPath, (stopTimeRecord) => {
		const trip = trips.get(stopTimeRecord.trip_id);
		if (trip === undefined) {
			return;
		}

		const stop = stops.get(stopTimeRecord.stop_id);
		if (stop === undefined) {
			return;
		}

		const sourceStopIdsKey = routeDirectionKey(stop.id, trip.route.id, trip.directionId);
		let sourceStopIds = sourceStopIdsCache.get(sourceStopIdsKey);
		if (sourceStopIds === undefined) {
			sourceStopIds = getSourceStopIds(stopAliases, stop.id, trip.route.id, trip.directionId);
			sourceStopIdsCache.set(sourceStopIdsKey, sourceStopIds);
		}

		const [hour, minute, second] = stopTimeRecord.departure_time.split(":").map(Number);
		const dayShift = hour % 24;

		trip.stopTimes.push({
			sequence: +stopTimeRecord.stop_sequence,
			stop,
			sourceStopIds,
			time: getPlainTime(
				`${String(hour % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
			),
			dayShift: dayShift || undefined,
		});
	});

	trips.forEach((trip) => {
		trip.stopTimes.sort((a, b) => a.sequence - b.sequence);
	});

	return trips;
}
