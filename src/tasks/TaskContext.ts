import {BuildResult} from "esbuild";
import Config from "../Config";
import {BuildOpts} from "../commands/build";

export default interface TaskContext {
    opts: BuildOpts;
    paths?: {
        tempBundle: string;
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
    tsDeclTempEntry?: Record<string, string>;
    tsDeclTempOut?: string;
    tsDocsTempJson?: string;
    customDocGenTempCleanup?: () => Promise<void>;
    customDocumenter?: string;
    cacheDir: string;
}
