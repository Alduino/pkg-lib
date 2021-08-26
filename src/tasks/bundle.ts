import {createStaticTask} from "./utils";
import bundleCommonJs from "./bundleCommonJs";
import bundleEsm from "./bundleEsm";
import typescriptFeatures from "./typescript";

export default createStaticTask("Bundle", async (_, then) => {
    await bundleCommonJs(then).and(...bundleEsm.and).and(...typescriptFeatures.and);
});

export const bundleWithoutTypescript = createStaticTask("Bundle", async (_, then) => {
    await bundleCommonJs(then).and(...bundleEsm.and);
});
