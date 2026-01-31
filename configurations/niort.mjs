/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/ca_du_niortais-aggregated-gtfs.zip",
	hawkId: "niort",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => {
		if (hawkVehicle.RouteNumber === "NAV") {
			return gtfsRoute.name === "NCV";
		}

		if (hawkVehicle.RouteNumber === "NAVC") {
			return gtfsRoute.name === "NCSA";
		}

		return gtfsRoute.name === hawkVehicle.RouteNumber;
	},
	matchStopTime: (gtfsStopTime, hawkSchedule) =>
		gtfsStopTime.stop.code === hawkSchedule?.StopGraphKey,
};

export default configuration;
