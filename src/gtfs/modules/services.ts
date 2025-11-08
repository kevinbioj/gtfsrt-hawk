import { join } from "node:path";
import { Temporal } from "temporal-polyfill";

import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import { doesFileExist } from "../../utils/file-exists.js";

export type Service = {
	id: string;
	days: [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
	startsOn: Temporal.PlainDate;
	endsOn: Temporal.PlainDate;
	excludedDates: Temporal.PlainDate[];
	includedDates: Temporal.PlainDate[];
};

type CalendarRecord = CsvRecord<
	| "service_id"
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday"
	| "sunday"
	| "start_date"
	| "end_date"
>;

type CalendarDatesRecord = CsvRecord<"service_id" | "date" | "exception_type">;

export async function importServices(gtfsDirectory: string) {
	const services = new Map<string, Service>();

	const calendarPath = join(gtfsDirectory, "calendar.txt");
	if (await doesFileExist(calendarPath)) {
		await readCsv<CalendarRecord>(calendarPath, (calendarRecord) => {
			services.set(calendarRecord.service_id, {
				id: calendarRecord.service_id,
				days: [
					Boolean(+calendarRecord.monday),
					Boolean(+calendarRecord.tuesday),
					Boolean(+calendarRecord.wednesday),
					Boolean(+calendarRecord.thursday),
					Boolean(+calendarRecord.friday),
					Boolean(+calendarRecord.saturday),
					Boolean(+calendarRecord.sunday),
				],
				startsOn: Temporal.PlainDate.from(calendarRecord.start_date),
				endsOn: Temporal.PlainDate.from(calendarRecord.end_date),
				excludedDates: [],
				includedDates: [],
			});
		});
	}

	const calendarDatesPath = join(gtfsDirectory, "calendar_dates.txt");
	if (await doesFileExist(calendarDatesPath)) {
		await readCsv<CalendarDatesRecord>(calendarDatesPath, (calendarDatesRecord) => {
			let service = services.get(calendarDatesRecord.service_id);
			if (service === undefined) {
				service = {
					id: calendarDatesRecord.service_id,
					days: [false, false, false, false, false, false, false],
					startsOn: Temporal.PlainDate.from("20000101"),
					endsOn: Temporal.PlainDate.from("20991231"),
					excludedDates: [],
					includedDates: [],
				};

				services.set(calendarDatesRecord.service_id, service);
			}

			const date = Temporal.PlainDate.from(calendarDatesRecord.date);
			if (calendarDatesRecord.exception_type === "1") {
				service.includedDates.push(date);
			} else {
				service.excludedDates.push(date);
			}
		});
	}

	return services;
}
