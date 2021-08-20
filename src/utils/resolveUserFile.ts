import {resolve} from "path";
import {realpath} from "fs/promises";
import {existsSync} from "fs";

let userDirectoryCache: string | null = null;

/**
 * Returns the full path to the specified file
 * @param path The path of the file relative to the project directory
 * @param extensions If this value is set, will test if a file with each extension exists, and return the first one. Should not start with a dot
 * @example
 * await resolveUserFile("package.json");
 * @example
 * await resolveUserFile("setup", ["js", "mjs", "ts"]);
 * @returns Resolved path. If `extensions` is specified and none match, returns `null`.
 */
export default async function resolveUserFile(path: string, extensions?: string[]) {
    const userDirectory = userDirectoryCache || (userDirectoryCache = await realpath(process.cwd()));

    if (extensions) {
        return extensions
            .map(ext => resolve(userDirectory, path + "." + ext))
            .find(it => existsSync(it));
    }

    return resolve(userDirectory, path);
}

export async function getUserDirectory() {
    return userDirectoryCache || (userDirectoryCache = await realpath(process.cwd()));
}
