import {createStaticTask} from "./utils";
import bundleCommonJs from "./bundleCommonJs";
import bundleEsm from "./bundleEsm";
import typescriptDecl from "./typescriptDecl";

export default createStaticTask("Bundle", async (_, then) => {
    await bundleCommonJs(then).and(...bundleEsm.and).and(...typescriptDecl.and);
});
