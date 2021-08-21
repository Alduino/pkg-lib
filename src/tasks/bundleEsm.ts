import {build} from "esbuild";
import {createEsmBuild} from "../utils/build-configs";
import {createStaticTask} from "./utils";

export default createStaticTask("ESM", async (_, then) => {
    await then("Module", async ({config, jsx}) => {
        await build(await createEsmBuild(config, jsx));
    });
});
