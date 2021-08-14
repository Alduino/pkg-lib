export default function invariant(check: unknown, message: string): asserts check {
    if (!check) throw message;
}

export function warning(check: unknown, message: string) {
    if (!check) console.warn(message);
}
