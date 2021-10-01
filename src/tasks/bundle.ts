import {copyFile, mkdir} from "fs/promises";
import {dirname, join} from "path";
import fillNameTemplate from "../utils/fillNameTemplate";
import bundleCommonJs from "./bundleCommonJs";
import bundleEsm from "./bundleEsm";
import typescriptFeatures from "./typescript";
import {createStaticTask} from "./utils";

const extract = createStaticTask("Extract", async ({config, paths}) => {
    await mkdir(dirname(config.cjsDevOut), {recursive: true});
    await mkdir(dirname(config.cjsProdOut), {recursive: true});
    await mkdir(dirname(config.esmOut), {recursive: true});

    for (const name of Object.keys(config.entrypoints)) {
        await copyFile(
            join(paths.tempBundle, "cjs-dev", name + ".js"),
            fillNameTemplate(config.cjsDevOut, {entrypoint: name})
        );
        await copyFile(
            join(paths.tempBundle, "cjs-prod", name + ".js"),
            fillNameTemplate(config.cjsProdOut, {entrypoint: name})
        );
        await copyFile(
            join(paths.tempBundle, "esm", name + ".js"),
            fillNameTemplate(config.esmOut, {entrypoint: name})
        );
    }
});

export default createStaticTask("Bundle", async (_, then) => {
    await bundleCommonJs(then)
        .and(...bundleEsm.and)
        .and(...typescriptFeatures.and);

    await extract(then);
});

export const bundleWithoutTypescript = createStaticTask(
    "Bundle",
    async (_, then) => {
        await bundleCommonJs(then).and(...bundleEsm.and);
        await extract(then);
    }
);
