import Config from "../Config";
import {BuildOpts} from "../commands/build";
import {BuildResult} from "esbuild";

export default interface TaskContext {
    opts: BuildOpts;
    paths?: {
        userDir: string;
        config: string;
        packageJson: string;
        tsconfig: string;
    };
    jsx?: "react-jsx" | "createElement";
    config?: Config;
    watch?: boolean;
    commonJsDevBuildResult?: BuildResult;
    commonJsProdBuildResult?: BuildResult;
    esmBuildResult?: BuildResult;
    tsDeclTempEntry?: string;
    tsDeclTempOut?: string;
    tsDocsTempJson?: string;
    customDocGenTempCleanup?: () => Promise<void>;
    customDocumenter?: string;
    cacheDir: string;
}
