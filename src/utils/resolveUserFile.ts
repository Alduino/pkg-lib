import {resolve} from "path";
import {realpath} from "fs/promises";

let userDirectoryCache: string | null = null;
export default async function resolveUserFile(path: string) {
    const userDirectory = userDirectoryCache || (userDirectoryCache = await realpath(process.cwd()));
    return resolve(userDirectory, path);
}
