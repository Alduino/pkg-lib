import {getHello} from "repo-a";

export default function(user) {
    return getHello(user) + " This is the fantastic `repo-b` library.";
}
