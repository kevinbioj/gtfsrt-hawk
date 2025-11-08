import { API_URL } from "./constants.js";

export type HawkTripDetails = {
	Schedule: Array<{
		Rank: number;
		StopName: string;
		StopGraphKey: string;
		Schedule: string;
	}>;
};

export async function downloadHawkTripDetails(hawkId: string, parcNumber: string) {
	const response = await fetch(
		`${API_URL}/${hawkId}/public/HawkWebService.asmx/GetGoogleRouteInfo`,
		{
			body: JSON.stringify({ ParcNumber: parcNumber }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
			signal: AbortSignal.timeout(30_000),
		},
	);

	if (!response.ok) {
		throw new Error(`Failed to download vehicles from Hawk (${response.status}).`);
	}

	const { d: vehicles } = (await response.json()) as { d: HawkTripDetails };
	return vehicles;
}
