import {createStaticTask} from "../utils";
import resolveUserFile from "../../utils/resolveUserFile";
import runDocumentationGenerator from "../../utils/runDocumentationGenerator";

export const CUSTOM_DOCUMENTER_FILE = "pkglib.documenter" as string;
export const CUSTOM_DOCUMENTER_EXTS = ["js", "mjs", "ts"] as readonly string[];

export default createStaticTask("Generate API documentation", async (ctx, then) => {
    const {config, tsDocsTempJson} = ctx;

    const customGenerator = await resolveUserFile(CUSTOM_DOCUMENTER_FILE, CUSTOM_DOCUMENTER_EXTS);
    ctx.customDocumenter = customGenerator;
    await runDocumentationGenerator(then, config, tsDocsTempJson, customGenerator);
}, {
    enabled: ({config}) => !!config.docsDir
});
