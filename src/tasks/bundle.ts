import bundleCommonJs from "./bundleCommonJs";
import bundleEsm from "./bundleEsm";
import typescriptFeatures from "./typescript";
import {createStaticTask} from "./utils";

export default createStaticTask("Bundle", async (_, then) => {
    await bundleCommonJs(then)
        .and(...bundleEsm.and)
        .and(...typescriptFeatures.and);
});

export const bundleWithoutTypescript = createStaticTask(
    "Bundle",
    async (_, then) => {
        await bundleCommonJs(then).and(...bundleEsm.and);
    }
);
