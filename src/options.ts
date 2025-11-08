import { parseArgs } from "node:util";

const { positionals } = parseArgs({
	allowPositionals: true,
	strict: true,
});

const [configurationPath] = positionals;

export { configurationPath };
