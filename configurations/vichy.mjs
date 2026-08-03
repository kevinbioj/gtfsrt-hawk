/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref: "https://h36.hanoverdisplays.com/keolis_vichy/gtfs/prod/GTFS_Prod_keolis_vichy.zip",
	hawkId: "vichy",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.name === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) => gtfsStopTime.stop.code === hawkSchedule?.StopGraphKey,
};

export default configuration;
