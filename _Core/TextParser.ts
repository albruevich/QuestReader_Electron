import { Quest } from "../_Data/Quest";
import { FormulaEvaluator } from "./FormulaEvaluator";

export class TextParser {

    constructor(private quest: Quest) {}

    parse(text: string | null | undefined, ignoreColor: boolean = false): string {
        if (!text) {
            return "";
        }

        let result = text;
        const expressions = this.getBetween(result, "{", "}");

        for (const expression of expressions) {
            try {
                const cleanExpression = expression
                    .replace("{", "")
                    .replace("}", "");

                const value = FormulaEvaluator.evaluate(cleanExpression, this.fillFormulaDict());

                const replacement = ignoreColor
                    ? value.toString()
                    : `<span class="formula-value">${value}</span>`;

                result = result.replace(expression, replacement);
            } catch {
                console.warn("Invalid substitution formula!");
            }
        }

        return result;
    }

    cleanLeadingSpaces(text: string): string {
        if (!text) {
            return text;
        }

        return text.replace(/^ +/, "");
    }

    getBetween(source: string, start: string, end: string): string[] {
        const result: string[] = [];
        let text = source;

        while (text.includes(start) && text.includes(end)) {
            const startIndex = text.indexOf(start);
            const endIndex = text.indexOf(end, startIndex) + end.length;

            const content = text.substring(startIndex, endIndex);
            result.push(content);

            text = text.replace(content, "");
        }

        return result;
    }

    fillFormulaDict(): Record<string, number> {
        const dict: Record<string, number> = {};

        for (const parameter of this.quest.parameters) {
            dict["p" + parameter.index] = parameter.value;
        }

        return dict;
    }

    extractLastTagValue(textWrapper: { value: string }, tag: string): string {
        const tags = this.getBetween(textWrapper.value, "<" + tag, tag + ">");
        let value = "";

        for (const fullTag of tags) {
            textWrapper.value = textWrapper.value.replace(fullTag, "");
            value = fullTag
                .replace("<" + tag, "")
                .replace(tag + ">", "")
                .replaceAll(" ", "");
        }

        return value;
    }

}