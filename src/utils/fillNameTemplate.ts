type TemplateValueFunction = (...args: string[]) => string;
type TemplateValue = string | TemplateValueFunction;
type TemplateValues = Record<string, TemplateValue>;

export default function fillNameTemplate(source: string, values: TemplateValues): string {
    return source.replace(/\[([^\]:]+)(?::([^\]]+))?]/g, (_, name, args) => {
        const val = values[name];
        if (typeof val === "string") return val;
        if (typeof val === "function") return val(...args?.split(",") ?? []);
        return `[${name}:${args}]`;
    });
}
