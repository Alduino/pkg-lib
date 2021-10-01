import logger from "consola";
import fg from "fast-glob";
import invariant from "tiny-invariant";
import {getEntrypointName} from "./getEntrypointMatch";
import resolveUserFile from "./resolveUserFile";

export const entrypointExtensions = [
    "js",
    "ts",
    "jsx",
    "tsx",
    "cjs",
    "mjs",
    "ejs",
    "esm"
];

export default async function detectEntrypoint(): Promise<string | undefined> {
    return await resolveUserFile("src/index", entrypointExtensions);
}

type EntrypointObject = Record<string, string>;
type EntrypointArray = (string | EntrypointObject)[];
export type Entrypoints = string | EntrypointArray | EntrypointObject;

function assertFirstName(name: string, output: Map<string, string>) {
    invariant(name, `Entrypoint does not have a name`);

    invariant(
        !output.has(name),
        `Duplicate entrypoint names were found (${name}). A glob may be matching files you don't want it to.`
    );
}

function addMatchesFromObject(
    object: EntrypointObject,
    output: Map<string, string>
) {
    for (const [name, path] of Object.entries(object)) {
        assertFirstName(name, output);
        output.set(name, path);
    }
}

async function addMatchesFromGlob(
    glob: string,
    output: Map<string, string>,
    skip?: (path: string) => boolean
) {
    const matches = await fg(glob);

    for (const match of matches) {
        if (skip?.(match)) {
            logger.debug(
                "%s conflicts with a build result path, so it was not included as an entrypoint",
                match
            );
            continue;
        }

        const name = getEntrypointName(match, glob);
        assertFirstName(name, output);
        output.set(name, match);
    }
}

/**
 * Resolves an entrypoint list into a map of the names and their paths
 * @param entrypoints Entrypoint list
 * @param skip Check if an endpoint from a glob should be skipped
 */
export async function resolveEntrypoints(
    entrypoints: Entrypoints,
    skip?: (path: string) => boolean
): Promise<Record<string, string>> {
    const arr = Array.isArray(entrypoints) ? entrypoints : [entrypoints];
    const foundEntrypoints = new Map<string, string>();

    await Promise.all(
        arr.map(async entrypoint => {
            if (typeof entrypoint === "string") {
                await addMatchesFromGlob(entrypoint, foundEntrypoints, skip);
            } else {
                addMatchesFromObject(entrypoint, foundEntrypoints);
            }
        })
    );

    return Object.fromEntries(foundEntrypoints.entries());
}
