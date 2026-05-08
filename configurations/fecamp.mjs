/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref: "https://api.atm.cityway.fr/dataflow/offre-tc/download?provider=FICIBUS&dataFormat=GTFS",
	hawkId: "fecamp",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) =>
		(hawkVehicle.RouteNumber === "L10" ? "L1" : hawkVehicle.RouteNumber) === gtfsRoute.name,
	matchStopTime: (gtfsStopTime, hawkSchedule) => gtfsStopTime.stop.code === hawkSchedule?.StopGraphKey,
};

export default configuration;
