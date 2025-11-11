/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://www.data.gouv.fr/api/1/datasets/r/4653683f-48a6-4f84-b313-058687fc5d04",
	hawkId: "vichy",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.name === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) =>
		gtfsStopTime.stop.code === hawkSchedule?.StopGraphKey,
};

export default configuration;
