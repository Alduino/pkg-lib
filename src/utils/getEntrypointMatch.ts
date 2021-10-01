import {basename, extname} from "path";
import {capture} from "micromatch";

export function getEntrypointName(testPath: string, glob: string): string | null {
    const starCount = glob.match(/\*{1,2}/g)?.length ?? 0;
    if (starCount === 0) return basename(testPath, extname(testPath));
    return capture(glob, testPath)?.[starCount - 1] ?? null;
}

export default function getEntrypointMatch(testPath: string, matcher: string, recursive = true): string | null {
    const matcherGlob = matcher.replace(/\[entrypoint]/g, recursive ? "**" : "*");
    return getEntrypointName(testPath, matcherGlob);
}
