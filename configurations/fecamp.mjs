/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://api.atm.cityway.fr/dataflow/offre-tc/download?provider=FICIBUS&dataFormat=GTFS",
	hawkId: "fecamp",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.name === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) =>
		gtfsStopTime.stop.code === hawkSchedule?.StopGraphKey,
};

export default configuration;
