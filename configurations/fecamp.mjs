/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref: "https://gtfs.bus-tracker.fr/ficibus.zip",
	hawkId: "fecamp",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) =>
		(hawkVehicle.RouteNumber === "L10" ? "L1" : hawkVehicle.RouteNumber) === gtfsRoute.name,
	matchStopTime: (gtfsStopTime, hawkSchedule) => gtfsStopTime.stop.code === hawkSchedule?.StopGraphKey,
};

export default configuration;
