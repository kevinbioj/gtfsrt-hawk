import { Temporal } from "temporal-polyfill";

import type { GtfsResource } from "../gtfs/import-resource.js";

import { isServiceOperatingOn } from "./is-service-operating-on.js";

export function getOperatingTrips(gtfs: GtfsResource) {
	const now = Temporal.Now.zonedDateTimeISO("Europe/Paris");
	const today = now.toPlainDate().subtract({ days: now.hour < 3 ? 1 : 0 });

	const operatingServices = gtfs.services
		.values()
		.filter((service) => isServiceOperatingOn(service, today))
		.toArray();
	return gtfs.trips
		.values()
		.filter((trip) => operatingServices.includes(trip.service))
		.toArray();
}
