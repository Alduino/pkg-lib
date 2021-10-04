export default function createCommonJsEntrypointSource(
    prodPath: string,
    devPath: string,
    hashbang?: string
): string {
    // language=js
    return `${hashbang ? hashbang + "\n\n" : ""}if (process.env.NODE_ENV === "production") {
    module.exports = require(${JSON.stringify(prodPath)});
} else {
    module.exports = require(${JSON.stringify(devPath)});
}
`;
}
