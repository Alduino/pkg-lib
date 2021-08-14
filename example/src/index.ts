import invariant, {warning} from "./invariant";
export {Example} from "./example";

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

export function checkInvariant() {
    invariant(5 + 5 > 10, "Maths has stopped existing!");
    warning(5 + 10 > 15, "The universe is about to implode :O");
}
