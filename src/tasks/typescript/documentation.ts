import {createStaticTask} from "../utils";
import resolveUserFile from "../../utils/resolveUserFile";
import runDocumentationGenerator from "../../utils/runDocumentationGenerator";

export default createStaticTask("Generate API documentation", async (ctx, then) => {
    const {config, tsDocsTempJson} = ctx;

    const customGenerator = await resolveUserFile("pkglib.documenter", ["js", "mjs", "ts"]);
    ctx.customDocumenter = customGenerator;
    await runDocumentationGenerator(then, config, tsDocsTempJson, customGenerator);
}, {
    enabled: ({config}) => !!config.docsDir
});
