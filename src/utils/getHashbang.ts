import {readFile} from "fs/promises";

export default async function getHashbang(path: string): Promise<string | null> {
    const source = await readFile(path, "utf8");
    const firstLine = source.split("\n")[0];
    if (firstLine.startsWith("#!")) return firstLine;
    return null;
}
