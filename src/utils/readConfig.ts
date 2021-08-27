import {existsSync} from "fs";
import {readFile} from "fs/promises";
import invariant from "tiny-invariant";
import Config from "../Config";
import {BuildOpts} from "../commands/build";
import detectEntrypoint from "./detectEntrypoint";
import resolveUserFile from "./resolveUserFile";

interface FileConfigChanges {
    invariant?: string[] | string | false;
    warning?: string[] | string | false;
    docsDir?: string | false;
}

type FileConfig = Partial<Omit<Config, keyof FileConfigChanges>> &
    FileConfigChanges;

interface ConfigReaderBase<Type extends string, Source> {
    type: Type;
    order?: number;
    read(source: Source): FileConfig;
}

interface FileConfigReader extends ConfigReaderBase<"file", string> {
    path: string;

    read(source: string): FileConfig;
}

interface CliConfigReader extends ConfigReaderBase<"cli", BuildOpts> {
    read(source: BuildOpts): FileConfig;
}

type ConfigReader = FileConfigReader | CliConfigReader;

const staticReaders: ConfigReader[] = [
    {
        type: "file",
        path: "package.json",
        read(source) {
            const {
                source: entrypoint,
                main,
                module,
                typings,
                docs
            } = JSON.parse(source);

            return {
                entrypoint,
                cjsOut: main,
                esmOut: module,
                typings: typings,
                docsDir: docs
            };
        }
    },
    {
        type: "cli",
        order: Infinity,
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
                warning: source.noWarning ? false : source.warning
            };
        }
    }
];

function readConfigItem<Reader extends ConfigReaderBase<string, unknown>>([
    reader,
    source
]: Reader extends ConfigReaderBase<string, infer Source>
    ? readonly [Reader, Source]
    : never) {
    return reader.read(source);
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
        cjsOut: "dist/index.js",
        cjsDevOut: `dist/development.js`,
        cjsProdOut: `dist/production.min.js`,
        esmOut: "dist/index.mjs",
        platform: "neutral",
        target: "es6",
        typings: "dist/index.d.ts",
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

    for (const configItem of loadedConfig) {
        const fileConfig = readConfigItem<typeof configItem[0]>(configItem);

        if (fileConfig.cjsOut)
            configObj.cjsOut = await resolveUserFile(fileConfig.cjsOut);
        if (fileConfig.esmOut)
            configObj.esmOut = await resolveUserFile(fileConfig.esmOut);
        if (fileConfig.entrypoint)
            configObj.entrypoint = await resolveUserFile(fileConfig.entrypoint);
        if (fileConfig.typings)
            configObj.typings = await resolveUserFile(fileConfig.typings);
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

    if (!configObj.entrypoint) configObj.entrypoint = await detectEntrypoint();

    return configObj as Config;
}
