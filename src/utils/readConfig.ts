import {existsSync} from "fs";
import {readFile} from "fs/promises";
import logger from "consola";
import invariant from "tiny-invariant";
import Config from "../Config";
import {BuildOpts} from "../commands/build";
import detectEntrypoint, {
    entrypointExtensions,
    Entrypoints,
    resolveEntrypoints
} from "./entrypoint";
import fillNameTemplate from "./fillNameTemplate";
import getEntrypointMatch, {getEntrypointName} from "./getEntrypointMatch";
import resolveUserFile from "./resolveUserFile";

interface FileConfigChanges {
    entrypoint?: string | false;
    entrypoints?: Entrypoints;
    invariant?: string[] | string | false;
    warning?: string[] | string | false;
    docsDir?: string | false;
}

type FileConfig = Partial<Omit<Config, keyof FileConfigChanges>> &
    FileConfigChanges;

interface ConfigReaderBase<Type extends string, Source> {
    type: Type;
    order?: number;

    read(source: Source, workingConfig: Partial<Config>): FileConfig;

    validate?(source: Source, config: Config): void;
}

interface FileConfigReader extends ConfigReaderBase<"file", string> {
    path: string;
}

type CliConfigReader = ConfigReaderBase<"cli", BuildOpts>;

type ConfigReader = FileConfigReader | CliConfigReader;

function parseCliEntrypoints(entrypoints: string): Entrypoints {
    const parts = entrypoints.split(",");
    const equalsIndexes = parts.map(part => [part, part.indexOf("=")] as const);

    const literalPaths = equalsIndexes
        .filter(([, idx]) => idx === -1)
        .map(([part]) => part);

    const namedParts = Object.fromEntries(
        equalsIndexes
            .filter(([, idx]) => idx !== -1)
            .map(([part, idx]) => [
                part.substring(0, idx),
                part.substring(idx + 1)
            ])
    );

    return [...literalPaths, namedParts];
}

const staticReaders: ConfigReader[] = [
    {
        type: "file",
        path: "package.json",
        order: 110,
        read(source, workingConfig: Partial<Config>) {
            const {main, module, typings} = JSON.parse(source);

            invariant(workingConfig.cjsOut, "`cjsOut` has not been set");
            invariant(workingConfig.esmOut, "`esmOut` has not been set");
            invariant(workingConfig.typings, "`typings` has not been set");

            const mainMatch =
                main && getEntrypointMatch(main, workingConfig.cjsOut);
            const moduleMatch =
                module && getEntrypointMatch(module, workingConfig.esmOut);
            const typingsMatch =
                typings && getEntrypointMatch(typings, workingConfig.typings);

            invariant(
                (!main && !module && !typings) ||
                    mainMatch ||
                    moduleMatch ||
                    typingsMatch,
                "Could not determine `mainEntry` from the package.json `main`, `module`, or `typings` fields"
            );

            const mainEntry = mainMatch ?? moduleMatch;
            return {mainEntry};
        },
        validate(source: string, config: Config) {
            const {main, module, typings} = JSON.parse(source);

            const expectedMainPath = fillNameTemplate(config.cjsOut, {
                entrypoint: config.mainEntry
            });

            const expectedModulePath = fillNameTemplate(config.esmOut, {
                entrypoint: config.mainEntry
            });

            const expectedTypingsPath = fillNameTemplate(config.typings, {
                entrypoint: config.mainEntry
            });

            invariant(
                !main || main === expectedMainPath,
                `\`main\` field in package.json must be \`${expectedMainPath}\` or not be defined`
            );

            invariant(
                !module || module === expectedModulePath,
                `\`module\` field in package.json must be \`${expectedModulePath}\` or not be defined`
            );

            invariant(
                !typings || typings === expectedTypingsPath,
                `\`typings\` field in package.json must be \`${expectedTypingsPath}\` or not be defined`
            );
        }
    },
    {
        type: "file",
        path: "package.json",
        read(source) {
            const {source: entrypoint, docs} = JSON.parse(source);

            return {
                entrypoint,
                docsDir: docs
            };
        }
    },
    {
        type: "cli",
        order: 100,
        read(source) {
            invariant(
                !(source.noInvariant && source.invariant),
                "--invariant cannot be specified while --no-invariant is set"
            );
            invariant(
                !(source.noWarning && source.warning),
                "--warning cannot be specified while --no-warning is set"
            );

            return {
                ...source,
                dev: !source.noDev,
                invariant: source.noInvariant ? false : source.invariant,
                warning: source.noWarning ? false : source.warning,
                entrypoints:
                    source.entrypoints &&
                    parseCliEntrypoints(source.entrypoints)
            };
        }
    }
];

function readConfigItem<Reader extends ConfigReaderBase<string, unknown>>(
    workingConfig: Partial<Config>,
    [reader, source]: Reader extends ConfigReaderBase<string, infer Source>
        ? readonly [Reader, Source]
        : never
) {
    return reader.read(source, workingConfig);
}

function validateConfigItem<Reader extends ConfigReaderBase<string, unknown>>(
    config: Config,
    [reader, source]: Reader extends ConfigReaderBase<string, infer Source>
        ? readonly [Reader, Source]
        : never
): void {
    reader.validate?.(source, config);
}

function addEntrypoints(
    source: Record<string, string>,
    target: Record<string, string>
) {
    const targetKeys = Object.keys(target);
    for (const [name, value] of Object.entries(source)) {
        invariant(
            !targetKeys.includes(name),
            "An entrypoint name is duplicated"
        );

        target[name] = value;
    }
}

/**
 * Checks if `path` would match a build result path, where `[entrypoint]` is a wildcard.
 */
function isConflictingEntrypoint(path: string, buildResult: string) {
    return !!getEntrypointMatch(path, buildResult, false);
}

function createEntrypointSkipper(configObj: Config) {
    return (path: string) => {
        return (
            isConflictingEntrypoint(path, configObj.typings) ||
            isConflictingEntrypoint(path, configObj.cjsOut) ||
            isConflictingEntrypoint(path, configObj.cjsDevOut) ||
            isConflictingEntrypoint(path, configObj.cjsProdOut) ||
            isConflictingEntrypoint(path, configObj.esmOut)
        );
    };
}

function removeConflictingEntrypoints(configObj: Config) {
    for (const [name, path] of Object.entries(configObj.entrypoints)) {
        if (
            isConflictingEntrypoint(path, configObj.typings) ||
            isConflictingEntrypoint(path, configObj.cjsOut) ||
            isConflictingEntrypoint(path, configObj.cjsDevOut) ||
            isConflictingEntrypoint(path, configObj.cjsProdOut) ||
            isConflictingEntrypoint(path, configObj.esmOut)
        ) {
            logger.debug(
                "%s conflicts with a build result path, so it was not included as an entrypoint",
                path
            );
            delete configObj.entrypoints[name];
        }
    }
}

export default async function readConfig(opts: BuildOpts): Promise<Config> {
    const readers: ConfigReader[] = [
        ...staticReaders,
        {
            type: "file",
            path: opts.config,
            read(source) {
                return JSON.parse(source);
            }
        }
    ];

    const defaultConfig: Partial<Config> = {
        typings: "[entrypoint].d.ts",
        esmOut: "[entrypoint].mjs",
        cjsOut: "[entrypoint].js",
        cjsDevOut: `dist/[entrypoint].dev.js`,
        cjsProdOut: `dist/[entrypoint].prod.min.js`,
        platform: "neutral",
        target: "es6",
        dev: true,
        invariant: ["invariant"],
        warning: ["warning"],
        recommendedExprCheck: true
    };

    const loadedConfig = (
        await Promise.all(
            readers
                .sort((a, b) => a.order ?? 0 - b.order ?? 0)
                .map(async reader => {
                    switch (reader.type) {
                        case "cli":
                            return [reader, opts] as const;
                        case "file": {
                            const resolved = await resolveUserFile(reader.path);
                            if (!existsSync(resolved)) return null;
                            return [
                                reader,
                                await readFile(resolved, "utf8")
                            ] as const;
                        }
                    }
                })
        )
    ).filter(el => el);

    const configObj = {...defaultConfig};
    const entrypointSkipper = createEntrypointSkipper(configObj as Config);

    for (const configItem of loadedConfig) {
        const fileConfig = readConfigItem<typeof configItem[0]>(
            configObj,
            configItem
        );

        if (fileConfig.cjsOut) configObj.cjsOut = fileConfig.cjsOut;
        if (fileConfig.esmOut) configObj.esmOut = fileConfig.esmOut;
        if (fileConfig.entrypoint)
            configObj.entrypoint = await resolveUserFile(fileConfig.entrypoint);
        else if (fileConfig.entrypoint === false)
            configObj.hasMainEntrypoint = false;
        if (fileConfig.entrypoints) {
            if (!configObj.entrypoints) configObj.entrypoints = {};
            addEntrypoints(
                await resolveEntrypoints(
                    fileConfig.entrypoints,
                    entrypointSkipper
                ),
                configObj.entrypoints
            );
        }
        if (fileConfig.typings)
            configObj.typings = await resolveUserFile(fileConfig.typings);
        if (fileConfig.mainEntry) configObj.mainEntry = fileConfig.mainEntry;
        if (fileConfig.platform) configObj.platform = fileConfig.platform;
        if (fileConfig.target) configObj.target = fileConfig.target;
        if (fileConfig.dev === false) configObj.dev = false;
        if (Array.isArray(fileConfig.invariant))
            configObj.invariant = fileConfig.invariant;
        else if (fileConfig.invariant === false) configObj.invariant = [];
        else if (fileConfig.invariant != null)
            configObj.invariant = [fileConfig.invariant];
        if (Array.isArray(fileConfig.warning))
            configObj.warning = fileConfig.warning;
        else if (fileConfig.warning === false) configObj.warning = [];
        else if (fileConfig.warning != null)
            configObj.warning = [fileConfig.warning];
        if (fileConfig.recommendedExprCheck === false)
            configObj.recommendedExprCheck = false;
        if (fileConfig.docsDir)
            configObj.docsDir = await resolveUserFile(fileConfig.docsDir);
    }

    if (!configObj.entrypoint && configObj.hasMainEntrypoint !== false) {
        configObj.entrypoint = await detectEntrypoint();
        if (!configObj.mainEntry) configObj.mainEntry = "index";
    }

    if (!configObj.entrypoints) {
        addEntrypoints(
            await resolveEntrypoints(
                [
                    `./*.{${entrypointExtensions}}`,
                    `./entry/*.{${entrypointExtensions}}`
                ],
                entrypointSkipper
            ),
            (configObj.entrypoints = {})
        );
    }

    removeConflictingEntrypoints(configObj as Config);

    logger.trace("Loading config: %s", JSON.stringify(configObj, null, 2));

    invariant(
        configObj.entrypoint || Object.keys(configObj.entrypoints).length > 0,
        "No entrypoints are defined"
    );

    invariant(
        !configObj.entrypoint || configObj.mainEntry,
        "`mainEntry` must be defined if `entrypoint` is defined"
    );

    invariant(
        !configObj.mainEntry || configObj.entrypoint,
        "`entrypoint` must be defined if `mainEntry` is defined"
    );

    if (configObj.entrypoint && configObj.mainEntry) {
        if (!configObj.entrypoints) configObj.entrypoints = {};

        addEntrypoints(
            {[configObj.mainEntry]: configObj.entrypoint},
            configObj.entrypoints
        );
    }

    const asConfig = configObj as Config;

    for (const configItem of loadedConfig) {
        validateConfigItem<typeof configItem[0]>(asConfig, configItem);
    }

    return asConfig;
}
