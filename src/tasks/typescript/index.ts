import {createStaticTask} from "../utils";
import prepare from "./prepare";
import declaration from "./declaration";
import documentation, {CUSTOM_DOCUMENTER_FILE, CUSTOM_DOCUMENTER_EXTS} from "./documentation";
import {rm} from "fs/promises";
import {relative, resolve} from "path";

export default createStaticTask("Typescript features", async (_, then) => {
    await prepare(then);
    await declaration(then);
    await documentation(then);
}, {
    async cleanup({paths: {userDir}, tsDeclTempEntry, tsDeclTempOut, tsDocsTempJson}) {
        await Promise.all([
            rm(tsDeclTempEntry, {force: true}),
            rm(resolve(tsDeclTempOut, relative(userDir, tsDeclTempEntry.replace(/\.ts$/, ".d.ts"))), {force: true}),
            rm(tsDocsTempJson, {recursive: true, force: true})
        ]);
    }
});

export {prepare, declaration, documentation, CUSTOM_DOCUMENTER_FILE, CUSTOM_DOCUMENTER_EXTS};
