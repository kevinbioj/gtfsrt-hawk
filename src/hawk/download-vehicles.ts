import { API_URL } from "./constants.js";

export type HawkVehicle = {
	ParcNumber: string;
	RouteNumber: string;
	Longitude: string;
	Latitude: string;
	Angle: number;
	NextStop: string;
	DestinationName: string;
};

export async function downloadHawkVehicles(hawkId: string) {
	const response = await fetch(
		`${API_URL}/${hawkId}/public/HawkWebService.asmx/GetGoogleListOfVehicles`,
		{
			headers: { "Content-Type": "application/json" },
			method: "POST",
			signal: AbortSignal.timeout(30_000),
		},
	);

	if (!response.ok) {
		throw new Error(`Failed to download vehicles from Hawk (${response.status}).`);
	}

	const { d: vehicles } = (await response.json()) as { d: HawkVehicle[] };
	return vehicles;
}
