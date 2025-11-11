const hawkRouteToGtfsRoute = new Map([
	["E001", "1"],
	["E002", "2"],
	["E003", "3"],
	["E004", "4"],
	["E005", "5"],
	["E006", "6"],
	["E007", "7"],
	["E008", "8"],
	["E009", "9"],
	["CD", "C"],
	["E011", "11"],
	["E012", "12"],
	["E013", "13"],
	["E014", "14"],
	["E015", "15"],
	["E016", "16"],
	["E017", "17"],
	["E021", "21"],
	["E022", "22"],
	["E023", "23"],
	["E024", "24"],
	["E031", "31"],
	["E033", "33"],
	["E041", "41"],
	["E042", "42"],
	["E043", "43"],
]);

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	gtfsResourceHref:
		"https://www.data.gouv.fr/api/1/datasets/r/39240e80-d3f4-4702-ba93-520fae414649",
	hawkId: "montargis",
	refreshInterval: 30_000,
	matchRoute: (gtfsRoute, hawkVehicle) =>
		gtfsRoute.id === hawkRouteToGtfsRoute.get(hawkVehicle.RouteNumber),
	matchStopTime: (gtfsStopTime, hawkSchedule) =>
		gtfsStopTime.stop.id === hawkSchedule?.StopGraphKey,
};

export default configuration;
