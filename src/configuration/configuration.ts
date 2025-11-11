import type { Route } from "../gtfs/modules/routes.js";
import type { StopTime, Trip } from "../gtfs/modules/trips.js";
import type { HawkTripDetails } from "../hawk/download-trip-details.js";
import type { HawkVehicle } from "../hawk/download-vehicles.js";

export type Configuration = {
	gtfsResourceHref: string;
	hawkId: string;
	refreshInterval: number;
	// ---
	matchRoute: (
		gtfsRoute: Route,
		hawkVehicle: HawkVehicle,
		hawkSchedule: HawkTripDetails["Schedule"],
	) => boolean;
	matchStopTime: (
		gtfsStopTime: StopTime,
		hawkSchedule?: HawkTripDetails["Schedule"][number],
	) => boolean;
	matchTrip: (
		gtfsTrip: Trip,
		hawkVehicle: HawkVehicle,
		hawkSchedule: HawkTripDetails["Schedule"],
	) => boolean;
	// ---
};
