/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=STAR&dataFormat=GTFS&dataProfil=OPENDATA",
	hawkId: "roanne",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => hawkVehicle.RouteNumber === gtfsRoute.name,
	matchStopTime: (gtfsStopTime, hawkSchedule) => gtfsStopTime.stop.code === hawkSchedule?.StopGraphKey,
};

export default configuration;
