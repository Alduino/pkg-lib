import {existsSync} from "fs";
import logger from "consola";
import resolveUserFile from "./resolveUserFile";

const possibleEntrypoints = [
    "src/index.js",
    "src/index.ts",
    "src/index.cjs",
    "src/index.mjs",
    "src/index.ejs",
    "src/index.esm"
];

export default async function detectEntrypoint(): Promise<string> {
    for (const entrypoint of possibleEntrypoints) {
        const resolved = await resolveUserFile(entrypoint);
        if (existsSync(resolved)) return resolved;
    }

    logger.error(
        "No entrypoint found! Specify one in the config, or create an index file in src."
    );
    process.exit(1);
}
