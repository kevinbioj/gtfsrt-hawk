import { access } from "node:fs/promises";

export async function doesFileExist(path: string) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}
