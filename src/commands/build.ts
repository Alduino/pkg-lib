import {transform} from "@babel/core";
import NodeResolvePlugin from "@esbuild-plugins/node-resolve";
import logger from "consola";
import {build as runEsbuild, BuildOptions, Plugin, PluginBuild} from "esbuild";
import {Listr} from "listr2";
import {dirname, relative} from "path";
import {mkdir, readFile, writeFile} from "fs/promises";
import readConfig from "../utils/readConfig";
import Config from "../Config";
import createCommonJsEntrypointSource from "../utils/createCommonJsEntrypointSource";
import StandardOpts from "./StandardOpts";
import readTsconfig from "../utils/readTsconfig";

export interface BuildOpts extends StandardOpts {
}

interface ListrContext {
    opts: BuildOpts;
    jsx?: "react-jsx" | "createElement";
    config?: Config;
}

function reactJsxPlugin(entrypoint: string, jsx: "react-jsx" | "createElement", isDev: boolean): Plugin {
    return {
        name: "react-jsx",
        setup(build: PluginBuild) {
            build.onLoad({filter: /\.jsx$/}, async args => {
                const src = await readFile(args.path, "utf8");
                const result = await transform(src, {
                    plugins: [
                        ["@babel/plugin-transform-react-jsx", {
                            runtime: jsx === "react-jsx" ? "automatic" : "classic"
                        }]
                    ]
                });
                return {contents: result.code};
            });

            build.onLoad({filter: /\.tsx$/}, async args => {
                const src = await readFile(args.path, "utf8");
                const result = await transform(src, {
                    filename: "/" + relative(entrypoint, args.path),
                    plugins: [
                        ["@babel/plugin-transform-typescript", {
                            isTSX: true
                        }],
                        [isDev && jsx === "react-jsx" ? "@babel/plugin-transform-react-jsx-development" : "@babel/plugin-transform-react-jsx", {
                            runtime: jsx === "react-jsx" ? "automatic" : "classic"
                        }]
                    ].filter(v => v)
                });
                return {contents: result.code};
            });
        }
    }
}

function getCommonEsbuildOptions(config: Config, plugins?: (Plugin | false)[]): Partial<BuildOptions> {
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
            }),
            ...plugins.filter(pl => pl) as Plugin[]
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
                            async task({config, jsx}) {
                                await runEsbuild({
                                    ...getCommonEsbuildOptions(config, [
                                        jsx && reactJsxPlugin(dirname(config.entrypoint), jsx, true)
                                    ]),
                                    outfile: config.cjsDevOut,
                                    format: "cjs"
                                });
                            }
                        },
                        {
                            title: "Production module",
                            async task({config, jsx}) {
                                await runEsbuild({
                                    ...getCommonEsbuildOptions(config, [
                                        jsx && reactJsxPlugin(dirname(config.entrypoint), jsx, false)
                                    ]),
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
                    async task({config, jsx}) {
                        await runEsbuild({
                            ...getCommonEsbuildOptions(config, [
                                jsx && reactJsxPlugin(dirname(config.entrypoint), jsx, false)
                            ]),
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

    const tsconfig = await readTsconfig();

    const jsxOpt = tsconfig?.compilerOptions?.jsx;
    const jsxTransform: ListrContext["jsx"] = jsxOpt?.startsWith("react-jsx") ? "react-jsx" : "createElement";

    if (!tsconfig.compilerOptions?.isolatedModules) {
        logger.error("compilerOptions.isolatedModules must be `true` in your tsconfig");
        process.exit(1);
    }

    if (jsxOpt === "react-jsx") {
        logger.warn("compilerOptions.jsx in your tsconfig should not be `react-jsx`, use `react-jsxdev` instead");
    }

    await tasks.run({opts, jsx: jsxTransform});
}
