import {build} from "esbuild";
import {createCommonJsDevBuild, createCommonJsProdBuild} from "../utils/build-configs";
import ListrContext from "./ListrContext";
import {ListrTask} from "listr2";
import { dirname, relative } from "path";
import createCommonJsEntrypointSource from "../utils/createCommonJsEntrypointSource";
import {mkdir, writeFile} from "fs/promises";

const bundleCommonjsTasks: ListrTask<ListrContext> = {
    title: "CommonJS",
    task(_, task) {
        return task.newListr([
            {
                title: "Development module",
                async task({config, jsx}) {
                    await build(createCommonJsDevBuild(config, jsx));
                }
            },
            {
                title: "Production module",
                async task({config, jsx}) {
                    await build(createCommonJsProdBuild(config, jsx));
                }
            },
            {
                title: "Entrypoint",
                async task({config}) {
                    const indexDir = dirname(config.cjsOut);
                    const relativeProdPath = relative(indexDir, config.cjsProdOut);
                    const relativeDevPath = relative(indexDir, config.cjsDevOut);
                    const source = createCommonJsEntrypointSource("./" + relativeProdPath, "./" + relativeDevPath);
                    await mkdir(dirname(config.cjsOut), {recursive: true});
                    await writeFile(config.cjsOut, source);
                }
            }
        ], {
            concurrent: true
        });
    }
};

export default bundleCommonjsTasks;
