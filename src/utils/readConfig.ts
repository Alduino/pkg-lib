import {existsSync} from "fs";
import {readFile} from "fs/promises";
import Config from "../Config";
import resolveUserFile from "./resolveUserFile";
import detectEntrypoint from "./detectEntrypoint";
import readPackageInformation from "./readPackageInformation";

interface FileConfigChanges {
    invariant: string[] | string | false;
    warning: string[] | string | false;
}

type FileConfig = Omit<Config, keyof FileConfigChanges> & FileConfigChanges;

interface ConfigReader {
    path: string;
    read(source: string): FileConfig;
}

const readers: ConfigReader[] = [
    {
        path: "package.json",
        read(source) {
            const {source: entrypoint, main, module, typings} = JSON.parse(source);

            return {
                entrypoint,
                cjsOut: main,
                esmOut: module,
                typings: typings
            };
        }
    },
    {
        path: ".pkglibrc",
        read(source) {
            return JSON.parse(source);
        }
    }
];

export default async function readConfig(): Promise<Config> {
    const packageInfo = await readPackageInformation();

    const defaultConfig: Partial<Config> = {
        cjsOut: "dist/index.js",
        cjsDevOut: `dist/${packageInfo.name}.development.js`,
        cjsProdOut: `dist/${packageInfo.name}.production.min.js`,
        esmOut: "dist/index.mjs",
        target: "node12",
        typings: "dist/index.d.ts",
        dev: true,
        invariant: ["invariant"],
        warning: ["warning"],
        recommendedExprCheck: true
    };

    const configWithAbsPath = await Promise.all(readers.map(async reader => {
        const absolutePath = await resolveUserFile(reader.path);
        return [reader, absolutePath, existsSync(absolutePath)] as const;
    }))
        .then(res => res.filter(([,, exists]) => exists))
        .then(res => res.map(([reader, path]) => [reader, path] as const));

    let configObj = {...defaultConfig};

    for (const [config, absPath] of configWithAbsPath) {
        const fileContents = await readFile(absPath, "utf8");
        const fileConfig = config.read(fileContents);

        if (fileConfig.cjsOut) configObj.cjsOut = await resolveUserFile(fileConfig.cjsOut);
        if (fileConfig.esmOut) configObj.esmOut = await resolveUserFile(fileConfig.esmOut);
        if (fileConfig.entrypoint) configObj.entrypoint = await resolveUserFile(fileConfig.entrypoint);
        if (fileConfig.typings) configObj.typings = await resolveUserFile(fileConfig.typings);
        if (fileConfig.dev === false) configObj.dev = false;
        if (Array.isArray(fileConfig.invariant)) configObj.invariant = fileConfig.invariant;
        else if (fileConfig.invariant === false) configObj.invariant = [];
        else if (fileConfig.invariant != null) configObj.invariant = [fileConfig.invariant];
        if (Array.isArray(fileConfig.warning)) configObj.warning = fileConfig.warning;
        else if (fileConfig.warning === false) configObj.warning = [];
        else if (fileConfig.warning != null) configObj.warning = [fileConfig.warning];
        if (fileConfig.recommendedExprCheck === false) configObj.recommendedExprCheck = false;
    }

    if (!configObj.entrypoint) configObj.entrypoint = await detectEntrypoint();

    return configObj as Config;
}
