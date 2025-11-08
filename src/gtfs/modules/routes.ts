import { join } from "node:path";

import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import { doesFileExist } from "../../utils/file-exists.js";

export type Route = {
	id: string;
	name: string;
};

type RouteRecord = CsvRecord<"route_id" | "route_short_name">;

export async function importRoutes(gtfsDirectory: string) {
	const routes = new Map<string, Route>();

	const routesPath = join(gtfsDirectory, "routes.txt");
	if (await doesFileExist(routesPath)) {
		await readCsv<RouteRecord>(routesPath, (routesRecord) => {
			routes.set(routesRecord.route_id, {
				id: routesRecord.route_id,
				name: routesRecord.route_short_name,
			});
		});
	}

	return routes;
}
