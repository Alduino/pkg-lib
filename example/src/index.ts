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
