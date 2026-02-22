import decompress from "decompress";

export async function downloadResource(resourceUrl: string, outputDirectory: string) {
	const response = await fetch(resourceUrl, {
		signal: AbortSignal.timeout(30_000),
	});

	if (!response.ok) {
		throw new Error(`Failed to download GTFS at '${resourceUrl}' (HTTP ${response.status})`);
	}

	const parts = Buffer.from(await response.arrayBuffer());
	await decompress(parts, outputDirectory);

	return { lastModified: response.headers.get("last-modified")! };
}
