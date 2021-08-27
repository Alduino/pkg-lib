export default function createCommonJsEntrypointSource(
    prodPath: string,
    devPath: string
): string {
    // language=js
    return `if (process.env.NODE_ENV === "production") {
    module.exports = require(${JSON.stringify(prodPath)});
} else {
    module.exports = require(${JSON.stringify(devPath)});
}
`;
}
