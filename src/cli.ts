import sade from "sade";
import {version as packageVersion} from "../package.json";
import build from "./commands/build";

export default function createCli(args: string[]) {
    const prog = sade("pkg-lib");

    prog.version(packageVersion)
        .option("--verbose, -V", "Enables verbose logging", false);

    prog.command("build")
        .describe("Bundles the library a single time.")
        .option("-c, --config <path>", "Path to the configuration file", ".pkglibrc")
        .option("-e, --entrypoint <path>", "File to enter from")
        .option("-T, --typings <path>", "Output for Typescript typings")
        .option("-O, --cjsOut <path>", "Output for CommonJS entrypoint")
        .option("-C, --cjsDevOut <path>", "Output for CommonJS development build")
        .option("-P, --cjsProdOut <path>", "Output for CommonJS production build")
        .option("-E, --esmOut <path>", "Output for ESModule build")
        .option("-p, --platform <name>", "Target platform")
        .option("-t, --target <name>", "Javascript syntax and standard library available")
        .option("-D, --no-dev", "Disable __DEV__")
        .option("-I, --no-invariant", "Disable invariant function optimisation")
        .option("-W, --no-warning", "Disable warning function optimisation")
        .option("-i, --invariant <name>", "Change invariant function name")
        .option("-w, --warning <name>", "Change warning function name")
        .option("-d, --docsDir <path>", "Output directory for documentation files")
        .action(build);

    prog.parse(args);
}
