import { join } from "node:path";

import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";

export type Stop = {
	id: string;
	code?: string;
	name: string;
};

type StopRecord = CsvRecord<"stop_id" | "stop_code" | "stop_name">;

export async function importStops(gtfsDirectory: string) {
	const stops = new Map<string, Stop>();

	const stopsPath = join(gtfsDirectory, "stops.txt");
	await readCsv<StopRecord>(stopsPath, (stopsRecord) => {
		stops.set(stopsRecord.stop_id, {
			id: stopsRecord.stop_id,
			code: stopsRecord.stop_code || undefined,
			name: stopsRecord.stop_name,
		});
	});

	return stops;
}
