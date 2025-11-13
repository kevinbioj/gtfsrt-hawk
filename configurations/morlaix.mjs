/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/LINEOTIM_Complet.gtfs.zip",
	hawkId: "morlaix",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.name === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) =>
		gtfsStopTime.stop.id === `LINEOTIM:${hawkSchedule?.StopGraphKey}`,
};

export default configuration;
