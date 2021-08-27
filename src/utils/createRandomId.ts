/**
 * Returns random hex characters of the length provided
 * @param length
 */
import {randomBytes} from "crypto";

export default function createRandomId(length: number): string {
    const bytes = Math.ceil(length / 2);
    const buff = randomBytes(bytes);
    return buff.toString("hex").substring(0, length);
}
