import {BuildOptions, Plugin, PluginBuild} from "esbuild";
import NodeResolvePlugin from "@esbuild-plugins/node-resolve";
import {readFile} from "fs/promises";
import {Node, transform} from "@babel/core";
import {relative} from "path";
import Config from "../Config";
import {declare} from "@babel/helper-plugin-utils";
import {getUserDirectory} from "./resolveUserFile";
import type {NodePath} from "@babel/traverse";
import type {CallExpression} from "@babel/types";

export type JSX = "react-jsx" | "createElement";

function createWarning(message: string, fileName: string, {loc: {start}}: Node) {
    return `Warning: ${message} (at ${fileName}:${start.line + 1}:${start.column + 1})`;
}

const invariantBabelPlugin = declare(({types: t}, opts) => {
    const isDev: boolean = opts.isDev ?? true;
    const file = opts.file;

    const invariantFunctionNames: string[] = opts.invariant;
    const warningFunctionNames: string[] = opts.warning;

    function logWarning(message: string, fileName: string, node: Node) {
        opts.log?.push(createWarning(message, fileName, node));
    }

    const falseLiteral = t.booleanLiteral(false);

    function rebuildInvariant(path: NodePath<CallExpression>) {
        const callee = path.get("callee");
        const [firstArgument, secondArgument] = path.get("arguments");

        if (!t.isExpressionStatement(path.parent)) {
            logWarning("Invalid `invariant` call. Cannot be used as part of an expression.", file, path.node);
            return;
        }

        if (!firstArgument) {
            logWarning("Invalid `invariant` call. Missing check parameter.", file, path.node);
            return;
        }

        if (!firstArgument.isExpression()) {
            logWarning("Invalid `invariant` call. The first argument (the check) must be an expression.", file, firstArgument.node);
            return;
        }

        if (!secondArgument) {
            logWarning("Invalid `invariant` call. Missing message parameter.", file, path.node);
            return;
        }

        if (!secondArgument.isStringLiteral()) {
            logWarning("Invalid `invariant` call. The second argument (the message) must be a string literal.", file, secondArgument.node);
            return;
        }

        const callExpr = isDev ? t.callExpression(callee.node, [falseLiteral, secondArgument.node]) : t.callExpression(callee.node, [falseLiteral]);
        path.replaceWith(t.logicalExpression("||", firstArgument.node, callExpr));
        path.skip();
    }

    function rebuildWarning(path: NodePath<CallExpression>) {
        const callee = path.get("callee");
        const [firstArgument, ...args] = path.get("arguments");

        if (!t.isExpressionStatement(path.parent)) {
            logWarning("Invalid `warning` call. Cannot be used as part of an expression.", file, path.node);
            return;
        }

        if (!firstArgument) {
            logWarning("Invalid `warning` call. Missing check parameter.", file, path.node);
            return;
        }

        if (!firstArgument.isExpression()) {
            logWarning("Invalid `warning` call. The first argument (the check) must be an expression.", file, firstArgument.node);
            return;
        }

        if (!isDev) {
            path.remove();
            return;
        }

        path.replaceWith(t.logicalExpression("||", firstArgument.node, t.callExpression(callee.node, [falseLiteral, ...args.map(arg => arg.node)])));
        path.skip();
    }

    return {
        name: "invariant",
        visitor: {
            CallExpression(path) {
                const callee = path.get("callee");

                if (!callee.isIdentifier()) return;

                if (invariantFunctionNames.includes(callee.node.name)) {
                    rebuildInvariant(path);
                } else if (warningFunctionNames.includes(callee.node.name)) {
                    rebuildWarning(path);
                }
            }
        }
    };
});

async function pkglibPlugin(config: Config, jsx: JSX, isDev: boolean, log?: string[]): Promise<Plugin> {
    const entryDir = await getUserDirectory();

    return {
        name: "@alduino/esbuild-plugin-pkg-lib",
        setup(build: PluginBuild) {
            build.onLoad({filter: /\.m?[jte]s[\dm]?$/}, async args => {
                const src = await readFile(args.path, "utf8");
                if (!src.includes("invariant")) return {};
                const result = await transform(src, {
                    plugins: [
                        "@babel/plugin-transform-typescript",
                        [invariantBabelPlugin, {
                            isDev,
                            log,
                            file: relative(entryDir, args.path),
                            invariant: config.invariant,
                            warning: config.warning
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
                        }],
                        [invariantBabelPlugin, {
                            isDev,
                            log,
                            file: relative(entryDir, args.path),
                            invariant: config.invariant,
                            warning: config.warning
                        }]
                    ].filter(v => v)
                });
                return {contents: result.code};
            });

            build.onLoad({filter: /\.jsx$/}, async args => {
                const src = await readFile(args.path, "utf8");
                const result = await transform(src, {
                    plugins: [
                        ["@babel/plugin-transform-react-jsx", {
                            runtime: jsx === "react-jsx" ? "automatic" : "classic"
                        }],
                        [invariantBabelPlugin, {
                            isDev,
                            log,
                            file: relative(entryDir, args.path),
                            invariant: config.invariant,
                            warning: config.warning
                        }]
                    ]
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
            ...plugins.filter(pl => pl) as Plugin[],
            NodeResolvePlugin({
                extensions: [".ts", ".js"],
                onResolved(resolved) {
                    if (resolved.includes("node_modules")) return {external: true};
                    return resolved;
                }
            }),
        ]
    };
}

export async function createCommonJsDevBuild(config: Config, jsx: JSX, log?: string[]): Promise<BuildOptions> {
    return {
        ...getCommonEsbuildOptions(config, [
            jsx && await pkglibPlugin(config, jsx, true, log)
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

export async function createCommonJsProdBuild(config: Config, jsx: JSX, log?: string[]): Promise<BuildOptions> {
    return {
        ...getCommonEsbuildOptions(config, [
            jsx && await pkglibPlugin(config, jsx, false, log)
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

export async function createEsmBuild(config: Config, jsx: JSX, log?: string[]): Promise<BuildOptions> {
    return {
        ...getCommonEsbuildOptions(config, [
            jsx && await pkglibPlugin(config, jsx, false, log)
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
