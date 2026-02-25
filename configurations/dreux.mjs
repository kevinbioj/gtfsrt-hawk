/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref: "https://fr.ftp.opendatasoft.com/centrevaldeloire/OKINAGTFS/GTFS_AO/DREUX.zip",
	hawkId: "linead",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.id === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) => gtfsStopTime.stop.code === hawkSchedule?.StopGraphKey,
};

export default configuration;
