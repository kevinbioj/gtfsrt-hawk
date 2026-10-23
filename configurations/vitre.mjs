/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/e6e71df3-0163-42ed-9c1f-927c4026ab1b",
	hawkId: "vitre",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) => gtfsRoute.name === hawkVehicle.RouteNumber,
	matchStopTime: (gtfsStopTime, hawkSchedule) => gtfsStopTime.stop.id === hawkSchedule.StopGraphKey,
};

export default configuration;
