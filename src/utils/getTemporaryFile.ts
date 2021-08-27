import {existsSync} from "fs";
import {resolve} from "path";
import logger from "consola";
import createRandomId from "./createRandomId";

/**
 * Returns a path to a file in the format [fileName].[8 random chars].[extension]
 * @param directory Directory to place the file in
 * @param fileName Prefix for the file's name
 * @param extension Extension of the file
 * @param attempts The number of attempts to create the file
 */
export default function getTemporaryFile(
    directory: string,
    fileName: string,
    extension: string,
    attempts = 5
): string {
    for (let attempt = 0; attempt < 5; attempt++) {
        const randomChars = createRandomId(13);
        const path = resolve(
            directory,
            `${fileName}.${randomChars}.${extension}`
        );
        if (existsSync(path)) continue;
        return path;
    }

    logger.error(
        "Could not generate temporary file after %s attempts",
        attempts
    );
}
