import sade from "sade";
import {name as packageName, version as packageVersion} from "../package.json";
import build from "./commands/build";

export default function createCli(args: string[]) {
    const prog = sade(packageName);

    prog.version(packageVersion)
        .option("--verbose, -V", "Enables verbose logging", false);

    prog.command("build")
        .describe("Bundles the library a single time.")
        .action(build);

    prog.parse(args);
}
