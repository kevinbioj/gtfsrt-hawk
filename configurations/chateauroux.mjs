/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://data.chateauroux-metropole.fr/api/v2/catalog/datasets/reseau-de-bus-urbain_horizon/alternative_exports/gtfs_20251001_zip",
	hawkId: "chateauroux",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.name === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) =>
		gtfsStopTime.stop.id === hawkSchedule?.StopGraphKey,
};

export default configuration;
