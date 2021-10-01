import {rm} from "fs/promises";
import {relative, resolve} from "path";
import readTsconfig from "../../utils/readTsconfig";
import {createStaticTask} from "../utils";
import declaration from "./declaration";
import documentation, {
    CUSTOM_DOCUMENTER_EXTS,
    CUSTOM_DOCUMENTER_FILE
} from "./documentation";
import prepare from "./prepare";

export default createStaticTask(
    "Typescript features",
    async (_, then) => {
        await prepare(then);
        await declaration(then);
        await documentation(then);
    },
    {
        enabled: async () => !!(await readTsconfig()),
        async cleanup({
            opts,
            paths: {userDir},
            tsDeclTempEntry,
            tsDeclTempOut,
            tsDocsTempJson
        }) {
            if (opts.noCleanup) return;

            await Promise.all([
                ...Object.values(tsDeclTempEntry)
                    .map(path => [
                        rm(path, {force: true}),
                        rm(
                            resolve(
                                tsDeclTempOut,
                                relative(
                                    userDir,
                                    path.replace(/\.ts$/, ".d.ts")
                                )
                            )
                        )
                    ])
                    .flat(),
                rm(tsDocsTempJson, {recursive: true, force: true})
            ]);
        }
    }
);

export {
    prepare,
    declaration,
    documentation,
    CUSTOM_DOCUMENTER_FILE,
    CUSTOM_DOCUMENTER_EXTS
};
