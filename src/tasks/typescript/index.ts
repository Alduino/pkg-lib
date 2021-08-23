import {createStaticTask} from "../utils";
import prepare from "./prepare";
import declaration from "./declaration";
import documentation from "./documentation";
import {rm} from "fs/promises";

export default createStaticTask("Typescript features", async (_, then) => {
    await prepare(then);
    await declaration(then);
    await documentation(then);
}, {
    async cleanup({tsDeclTempEntry, tsDeclTempOut, tsDocsTempJson}) {
        await Promise.all([
            rm(tsDeclTempEntry, {force: true}),
            rm(tsDeclTempOut, {recursive: true, force: true}),
            rm(tsDocsTempJson, {recursive: true, force: true})
        ]);
    }
});

export {prepare, declaration, documentation};
