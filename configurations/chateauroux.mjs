/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://www.data.gouv.fr/api/1/datasets/r/bd5489c2-5f32-4b06-8d55-e5a6f4fd6a51",
	hawkId: "chateauroux",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.name === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) =>
		gtfsStopTime.stop.id === hawkSchedule?.StopGraphKey,
};

export default configuration;
