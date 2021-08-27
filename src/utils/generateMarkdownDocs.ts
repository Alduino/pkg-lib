import {mkdir, writeFile} from "fs/promises";
import {dirname} from "path";
import {
    ApiDeclaredItem,
    ApiDocumentedItem,
    ApiItem,
    ApiPackage,
    ApiParameterListMixin,
    ApiReleaseTagMixin,
    ApiReturnTypeMixin,
    ReleaseTag
} from "@microsoft/api-extractor-model";
import {DocExcerpt, DocNode} from "@microsoft/tsdoc";
import invariant from "tiny-invariant";
import Config from "../Config";

let headingLevel = 1;

function getHeading() {
    return "#".repeat(headingLevel);
}

function sortDefault(a: string, b: string): number {
    if (a.startsWith("export default ")) return -1;
    if (b.startsWith("export default ")) return 1;
    return 0;
}

function isReactComponent(item: ApiDeclaredItem): boolean {
    if (!ApiReturnTypeMixin.isBaseClassOf(item)) return false;
    if (item.returnTypeExcerpt.text !== "ReactElement") return false;
    if (!ApiParameterListMixin.isBaseClassOf(item)) return false;
    if (item.parameters.length === 0) return false;
    return true;
}

function getExportType(token: string) {
    if (token.startsWith("export default declare ")) return "export default ";
    if (token.startsWith("export declare ")) return "export ";
    if (token.startsWith("declare ")) return "declare ";
    return "";
}

function generateReactFunction(item: ApiDeclaredItem) {
    invariant(
        ApiReturnTypeMixin.isBaseClassOf(item),
        "Api item does not have a return type"
    );
    invariant(
        ApiParameterListMixin.isBaseClassOf(item),
        "Api item does not have parameters"
    );

    const exports = getExportType(item.excerptTokens[0].text);

    const name = item.displayName;
    const [props] = item.parameters;

    return `${exports}<${name} {...props: ${props.parameterTypeExcerpt.text}} />`;
}

function generateDeclaredItemDeclaration(item: ApiDeclaredItem) {
    if (isReactComponent(item)) return generateReactFunction(item);

    return item.excerptTokens
        .map(t => t.text)
        .map(t => t.replace("export declare ", "export "))
        .sort(sortDefault)
        .filter(t => t !== ";")
        .join("");
}

function generateTitle(item: ApiItem) {
    const result: string[] = [];

    if (item instanceof ApiDeclaredItem)
        result.push(generateDeclaredItemDeclaration(item));

    return result.join("");
}

function docNodeConcat(item: DocNode, arr: string[] = []) {
    if (item instanceof DocExcerpt && item.content.toString().trim())
        arr.push(item.content.toString());
    for (const child of item.getChildNodes()) docNodeConcat(child, arr);
    return arr;
}

function generateSummary(item: ApiItem) {
    if (!(item instanceof ApiDocumentedItem)) return "";
    if (!item.tsdocComment?.summarySection) return "";

    return docNodeConcat(item.tsdocComment.summarySection).join("");
}

function generateParams(item: ApiItem) {
    if (!ApiParameterListMixin.isBaseClassOf(item)) return "";

    const output = [getHeading() + " Parameters"];

    if (item.parameters.length === 0) {
        return "";
    }

    for (const param of item.parameters) {
        const paramBaseInfo = ` - \`${param.name}: ${param.parameterTypeExcerpt.text}\``;

        if (param.tsdocParamBlock) {
            output.push(
                `${paramBaseInfo}: ${docNodeConcat(
                    param.tsdocParamBlock.content
                ).join("")}`
            );
        } else {
            output.push(paramBaseInfo);
        }
    }

    return output.join("\n");
}

function generateReturns(item: ApiItem) {
    if (!ApiReturnTypeMixin.isBaseClassOf(item)) return "";
    if (!(item instanceof ApiDocumentedItem) || !item.tsdocComment.returnsBlock)
        return "";

    const output = [
        getHeading(),
        " Returns\n",
        `\`${item.returnTypeExcerpt.text}\`:`,
        docNodeConcat(item.tsdocComment.returnsBlock.content).join("")
    ];

    return output.filter(el => el.trim()).join("");
}

function generateRemarks(item: ApiItem) {
    if (!(item instanceof ApiDocumentedItem)) return "";
    if (!item.tsdocComment?.remarksBlock) return "";

    return [
        getHeading() + " Remarks",
        docNodeConcat(item.tsdocComment.remarksBlock.content).join("")
    ].join("\n");
}

function generateItem(config: Config, item: ApiItem, output: string[]) {
    const childOutput: string[] = [];

    headingLevel++;
    for (const subItem of item.members) {
        generateItem(config, subItem, childOutput);
    }
    headingLevel--;

    if (item.kind === "EntryPoint") {
        output.push(...childOutput);
        return;
    }

    output.push(`${getHeading()} \`${generateTitle(item)}\``);

    headingLevel++;
    output.push(
        generateSummary(item),
        generateParams(item),
        generateReturns(item),
        generateRemarks(item)
    );
    headingLevel--;

    if (
        ApiReleaseTagMixin.isBaseClassOf(item) &&
        item.releaseTag === ReleaseTag.Beta
    ) {
        output.push(
            "> **Warning**: This is part of the beta API, and is subject to change at any time."
        );
    }

    output.push(...childOutput);
}

export default async function generateMarkdownDocs(
    config: Config,
    outputFile: string,
    apiPackage: ApiPackage
): Promise<void> {
    const source: string[] = [];

    for (const item of apiPackage.members) {
        generateItem(config, item, source);
    }

    await mkdir(dirname(outputFile), {recursive: true});
    await writeFile(outputFile, source.filter(l => l.trim()).join("\n"));
}
