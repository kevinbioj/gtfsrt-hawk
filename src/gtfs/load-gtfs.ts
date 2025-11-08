import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { downloadGtfs } from "./download-gtfs.js";
import { importGtfs } from "./import-gtfs.js";

export async function loadGtfs(hawkId: string, gtfsResourceHref: string) {
	const gtfsDirectory = join(tmpdir(), `hawk-public_${hawkId}_${Date.now()}`);
	let hasCreatedDirectory = false;

	try {
		await mkdir(gtfsDirectory);
		hasCreatedDirectory = true;

		await downloadGtfs(gtfsResourceHref, gtfsDirectory);
		// return await so finally disposes temporary directory AFTER import has finished
		return await importGtfs(gtfsDirectory);
	} finally {
		if (hasCreatedDirectory) {
			await rm(gtfsDirectory, { recursive: true });
		}
	}
}
