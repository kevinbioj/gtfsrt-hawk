/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/ca_du_niortais-aggregated-gtfs.zip",
	hawkId: "niort",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.name === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) =>
		gtfsStopTime.stop.code === hawkSchedule.StopGraphKey,
};

export default configuration;
