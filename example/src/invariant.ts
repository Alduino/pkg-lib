/**
 * If `check` is false, throws an error with the specified message
 * @param check The value to check
 * @param message The message to set in the error
 * @returns Only if `check` is true
 */
export default function invariant(
    check: unknown,
    message: string
): asserts check {
    if (!check) throw new Error(message ?? "Invariant failed");
}

/**
 * Logs the specified warning message if `check` is false
 * @param check The value to check
 * @param message The message to log
 */
export function warning(check: unknown, message: string): void {
    if (!check) console.warn("Warning:", message);
}
