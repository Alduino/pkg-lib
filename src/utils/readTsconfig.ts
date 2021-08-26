import resolveUserFile from "./resolveUserFile";
import {readFile} from "fs/promises";
import {existsSync} from "fs";
import logger from "consola";

export interface Tsconfig {
    compilerOptions?: {
        jsx?: string;
        isolatedModules?: boolean;
    };

    include?: string[];
    files?: string[];
}

export default async function readTsconfig<Required extends boolean = false>(required?: Required): Promise<Required extends true ? Tsconfig : Tsconfig | null> {
    const path = await resolveUserFile("tsconfig.json");

    if (!existsSync(path)) {
        if (required) {
            logger.error("`tsconfig.json` was not found. Make sure it exists in the root of your package. (In a monorepo, add a tsconfig that contains `{\"extends\":\"../path/to/tsconfig.json\"}`");
            process.exit(1);
        } else {
            return null;
        }
    }

    return JSON.parse(await readFile(path, "utf8"));
}
