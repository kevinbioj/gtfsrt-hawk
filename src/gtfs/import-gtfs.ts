import { importRoutes } from "./modules/routes.js";
import { importServices } from "./modules/services.js";
import { importStops } from "./modules/stops.js";
import { importTrips } from "./modules/trips.js";

export async function importGtfs(gtfsDirectory: string) {
	const [routes, services, stops] = await Promise.all([
		importRoutes(gtfsDirectory),
		importServices(gtfsDirectory),
		importStops(gtfsDirectory),
	]);

	const trips = await importTrips(gtfsDirectory, routes, services, stops);
	return { routes, services, stops, trips };
}
