/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://www.data.gouv.fr/api/1/datasets/r/282974b2-bf13-41f2-a0bf-feb0682e594e",
	hawkId: "vitre",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) =>
		[`CB${hawkVehicle.RouteNumber}`, `UV${hawkVehicle.RouteNumber}`].includes(gtfsRoute.name),
	matchStopTime: (gtfsStopTime, hawkSchedule) => {
		const graphKeyNoSuffix = hawkSchedule?.StopGraphKey.slice(0, -1);
		return [`${graphKeyNoSuffix}1`, `${graphKeyNoSuffix}2`].includes(gtfsStopTime.stop.id);
	},
};

export default configuration;
