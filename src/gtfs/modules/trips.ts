import { join } from "node:path";
import { Temporal } from "temporal-polyfill";

import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";

import type { Route } from "./routes.js";
import type { Service } from "./services.js";
import type { Stop } from "./stops.js";

export type Trip = {
	id: string;
	directionId: number;
	route: Route;
	service: Service;
	stopTimes: StopTime[];
};

export type StopTime = {
	sequence: number;
	stop: Stop;
	time: Temporal.PlainTime;
};

type TripsRecord = CsvRecord<"trip_id" | "direction_id" | "route_id" | "service_id">;

type StopTimesRecord = CsvRecord<"stop_id" | "stop_sequence" | "trip_id" | "departure_time">;

export async function importTrips(
	gtfsDirectory: string,
	routes: Map<string, Route>,
	services: Map<string, Service>,
	stops: Map<string, Stop>,
) {
	const trips = new Map<string, Trip>();

	const tripsPath = join(gtfsDirectory, "trips.txt");
	await readCsv<TripsRecord>(tripsPath, (tripsRecord) => {
		const route = routes.get(tripsRecord.route_id);
		if (route === undefined) {
			console.warn(
				`Unknown route '${tripsRecord.route_id}' for trip '${tripsRecord.trip_id}', ignoring.`,
			);
			return;
		}

		const service = services.get(tripsRecord.service_id);
		if (service === undefined) {
			console.warn(
				`Unknown service '${tripsRecord.service_id}' for trip '${tripsRecord.trip_id}', ignoring.`,
			);
			return;
		}

		trips.set(tripsRecord.trip_id, {
			id: tripsRecord.trip_id,
			directionId: +tripsRecord.direction_id,
			route,
			service,
			stopTimes: [],
		});
	});

	const stopTimesPath = join(gtfsDirectory, "stop_times.txt");
	await readCsv<StopTimesRecord>(stopTimesPath, (stopTimesRecord) => {
		const trip = trips.get(stopTimesRecord.trip_id);
		if (trip === undefined) {
			return;
		}

		const stop = stops.get(stopTimesRecord.stop_id);
		if (stop === undefined) {
			console.warn(
				`Unknown call #${stopTimesRecord.stop_sequence} @ '${stopTimesRecord.stop_id}' for trip '${stopTimesRecord.trip_id}', ignoring.`,
			);
			return;
		}

		trip.stopTimes.push({
			sequence: +stopTimesRecord.stop_sequence,
			stop,
			time: Temporal.PlainTime.from(stopTimesRecord.departure_time),
		});
	});

	return trips;
}
