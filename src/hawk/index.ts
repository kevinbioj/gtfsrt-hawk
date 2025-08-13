import type { HawkTripDetails, HawkVehicleData } from "./types.js";

export async function downloadHawkVehicles(slug: string) {
	const abortController = new AbortController();
	const abortTimeout = setTimeout(abortController.abort, 5000);
	const response = await fetch(
		`https://hawk.hanoverdisplays.com/${slug}/public/HawkWebService.asmx/GetGoogleListOfVehicles`,
		{
			headers: { "Content-Type": "application/json" },
			method: "POST",
		},
	).then((response) => response.json() as Promise<{ d: HawkVehicleData[] }>);
	clearTimeout(abortTimeout);
	return response.d;
}

export async function downloadHawkTripDetails(
	slug: string,
	parcNumber: string,
) {
	const abortController = new AbortController();
	const abortTimeout = setTimeout(abortController.abort, 5000);
	const response = await fetch(
		`https://hawk.hanoverdisplays.com/${slug}/public/HawkWebService.asmx/GetGoogleRouteInfo`,
		{
			body: JSON.stringify({ ParcNumber: parcNumber }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		},
	).then((response) => response.json() as Promise<{ d: HawkTripDetails }>);
	clearTimeout(abortTimeout);
	return response.d;
}
