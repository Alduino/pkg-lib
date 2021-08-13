import NodeResolvePlugin from "@esbuild-plugins/node-resolve";
import {build as runEsbuild, BuildOptions} from "esbuild";
import {Listr} from "listr2";
import {dirname, relative} from "path";
import {mkdir, writeFile} from "fs/promises";
import readConfig from "../utils/readConfig";
import Config from "../Config";
import createCommonJsEntrypointSource from "../utils/createCommonJsEntrypointSource";
import StandardOpts from "./StandardOpts";

export interface BuildOpts extends StandardOpts {}

interface ListrContext {
    opts: BuildOpts;
    config?: Config;
}

function getCommonEsbuildOptions(config: Config): Partial<BuildOptions> {
    return {
        entryPoints: [config.entrypoint],
        bundle: true,
        platform: "node",
        target: config.target,
        external: ["/node_modules/*"],
        plugins: [
            NodeResolvePlugin({
                extensions: [".ts", ".js"],
                onResolved(resolved) {
                    if (resolved.includes("node_modules")) return {external: true};
                    return resolved;
                }
            })
        ]
    };
}

export default async function build(opts: BuildOpts) {
    const tasks = new Listr<ListrContext, "default" | "verbose">([
        {
            title: "Read configuration",
            async task(ctx) {
                ctx.config = await readConfig();
            }
        },
        {
            title: "Bundle",
            task: (_, task) => task.newListr([
                {
                    title: "CommonJS",
                    task: (_, task) => task.newListr([
                        {
                            title: "Development module",
                            async task({config}) {
                                await runEsbuild({
                                    ...getCommonEsbuildOptions(config),
                                    outfile: config.cjsDevOut,
                                    format: "cjs"
                                });
                            }
                        },
                        {
                            title: "Production module",
                            async task({config}) {
                                await runEsbuild({
                                    ...getCommonEsbuildOptions(config),
                                    outfile: config.cjsProdOut,
                                    format: "cjs",
                                    minify: true
                                });
                            }
                        },
                        {
                            title: "Entrypoint",
                            async task({config}) {
                                const indexDir = dirname(config.cjsOut);
                                const relativeProdPath = relative(indexDir, config.cjsProdOut);
                                const relativeDevPath = relative(indexDir, config.cjsDevOut);
                                const source = createCommonJsEntrypointSource("./" + relativeProdPath, "./" + relativeDevPath)
                                await mkdir(dirname(config.cjsOut), {recursive: true});
                                await writeFile(config.cjsOut, source);
                            }
                        }
                    ], {concurrent: true})
                },
                {
                    title: "ESM",
                    async task({config}) {
                        await runEsbuild({
                            ...getCommonEsbuildOptions(config),
                            outfile: config.esmOut,
                            format: "esm"
                        });
                    }
                }
            ], {concurrent: true})
        }
    ], {
        renderer: opts.verbose ? "verbose" : "default"
    });

    await tasks.run({opts});
}
