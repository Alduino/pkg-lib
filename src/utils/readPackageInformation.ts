import resolveUserFile from "./resolveUserFile";
import {readFile} from "fs/promises";
import logger from "consola";

export interface Package {
    name: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

export default async function readPackageInformation() {
    const path = await resolveUserFile("package.json");
    const source = await readFile(path, "utf8");
    const content = JSON.parse(source);

    if (!content.name) {
        logger.error("Your package.json file doesn't contain a `name` property.");
        process.exit(1);
    }

    return {
        name: content.name,
        dependencies: content.dependencies,
        peerDependencies: content.peerDependencies
    };
}
