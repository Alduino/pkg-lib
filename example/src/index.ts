import invariant, {warning} from "./invariant";

export {Example} from "./example";
export type {ExampleProps} from "./example";
export {invariant, warning};

/**
 * Returns "Hello, {name}!"
 * @param name The name to say hello to
 */
export default function example(name: string) {
    return `Hello, ${name}!`;
}

/**
 * Logs if we're running in dev mode or production mode
 * @remarks Logs the value of `__DEV__` and `NODE_ENV` separately
 */
export function checkDev() {
    if (__DEV__) {
        console.log("__DEV__ == true");
    } else {
        console.log("__DEV__ == false");
    }

    if (process.env.NODE_ENV === "development") {
        console.log("Development mode");
    } else {
        console.log("Production mode");
    }
}

/**
 * Checks if the invariant functions are working
 */
export function checkInvariant() {
    invariant(5 + 5 > 10, "Maths has stopped existing!");
    warning(5 + 10 > 15, "The universe is about to implode :O");
}
