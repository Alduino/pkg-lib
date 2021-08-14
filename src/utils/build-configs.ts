import {BuildOptions, Plugin, PluginBuild} from "esbuild";
import NodeResolvePlugin from "@esbuild-plugins/node-resolve";
import {readFile} from "fs/promises";
import {transform} from "@babel/core";
import {dirname, relative} from "path";
import Config from "../Config";

export type JSX = "react-jsx" | "createElement";

function reactJsxPlugin(entrypoint: string, jsx: JSX, isDev: boolean): Plugin {
    const entryDir = dirname(entrypoint);

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
                    filename: "/" + relative(entryDir, args.path),
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

export function createCommonJsDevBuild(config: Config, jsx: JSX): BuildOptions {
    return {
        ...getCommonEsbuildOptions(config, [
            jsx && reactJsxPlugin(config.entrypoint, jsx, true)
        ]),
        outfile: config.cjsDevOut,
        format: "cjs",
        define: {
            ...(config.dev && {
                __DEV__: "true",
                "process.env.NODE_ENV": '"development"'
            })
        }
    };
}

export function createCommonJsProdBuild(config: Config, jsx: JSX): BuildOptions {
    return {
        ...getCommonEsbuildOptions(config, [
            jsx && reactJsxPlugin(config.entrypoint, jsx, false)
        ]),
        outfile: config.cjsProdOut,
        format: "cjs",
        minify: true,
        define: {
            ...(config.dev && {
                __DEV__: "false",
                "process.env.NODE_ENV": '"production"'
            })
        }
    };
}

export function createEsmBuild(config: Config, jsx: JSX): BuildOptions {
    return {
        ...getCommonEsbuildOptions(config, [
            jsx && reactJsxPlugin(config.entrypoint, jsx, false)
        ]),
        outfile: config.esmOut,
        format: "esm",
        define: {
            ...(config.dev && {
                __DEV__: "false",
                "process.env.NODE_ENV": '"production"'
            })
        }
    };
}
