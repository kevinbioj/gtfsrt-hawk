import { Temporal } from "temporal-polyfill";

import type { Service } from "./modules/services.js";

export function doesServiceRunOn(service: Service, date: Temporal.PlainDate) {
	if (service.includedDates.some((d) => d.equals(date))) {
		return true;
	}

	if (service.excludedDates.some((d) => d.equals(date))) {
		return false;
	}

	if (
		Temporal.PlainDate.compare(date, service.startsOn) < 0 ||
		Temporal.PlainDate.compare(date, service.endsOn) > 0
	) {
		return false;
	}

	return service.days[date.dayOfWeek - 1] ?? false;
}
