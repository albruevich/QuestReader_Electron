export class FormulaEvaluator {
    public static evaluate(expr: string, vars: Record<string, number>): number {
        const parser = new Parser(expr, vars);
        const result = parser.parseExpression();
        parser.ensureEnd();
        return result;
    }

    public static evaluateBool(expr: string, vars: Record<string, number>): boolean {
        return FormulaEvaluator.evaluate(expr, vars) !== 0;
    }
}

class Parser {
    private pos = 0;

    constructor(
        private readonly s: string,
        private readonly vars: Record<string, number>
    ) { }

    public ensureEnd(): void {
        this.skipSpaces();

        if (this.pos < this.s.length) {
            throw new Error("Unexpected tail: " + this.s.substring(this.pos));
        }
    }

    private peek(): string {
        return this.pos < this.s.length ? this.s[this.pos] : "\0";
    }

    private next(): string {
        return this.pos < this.s.length ? this.s[this.pos++] : "\0";
    }

    private skipSpaces(): void {
        while (/\s/.test(this.peek())) {
            this.pos++;
        }
    }

    public parseExpression(): number {
        this.skipSpaces();

        const condition = this.parseOr();

        this.skipSpaces();

        if (this.peek() === "?") {
            this.next();

            const trueExpr = this.parseExpression();

            this.skipSpaces();
            if (this.next() !== ":") {
                throw new Error("Expected ':'");
            }

            const falseExpr = this.parseExpression();

            return condition !== 0 ? trueExpr : falseExpr;
        }

        return condition;
    }

    private parseOr(): number {
        let left = this.parseAnd();

        while (true) {
            this.skipSpaces();

            if (this.match("||")) {
                const right = this.parseAnd();
                left = this.bool(left !== 0 || right !== 0);
            } else {
                break;
            }
        }

        return left;
    }

    private parseAnd(): number {
        let left = this.parseComparison();

        while (true) {
            this.skipSpaces();

            if (this.match("&&")) {
                const right = this.parseComparison();
                left = this.bool(left !== 0 && right !== 0);
            } else {
                break;
            }
        }

        return left;
    }

    private parseComparison(): number {
        let left = this.parseAddSub();

        while (true) {
            this.skipSpaces();

            if (this.match("==")) {
                left = this.bool(left === this.parseAddSub());
            } else if (this.match("!=")) {
                left = this.bool(left !== this.parseAddSub());
            } else if (this.match(">=")) {
                left = this.bool(left >= this.parseAddSub());
            } else if (this.match("<=")) {
                left = this.bool(left <= this.parseAddSub());
            } else if (this.match(">")) {
                left = this.bool(left > this.parseAddSub());
            } else if (this.match("<")) {
                left = this.bool(left < this.parseAddSub());
            } else {
                break;
            }
        }

        return left;
    }

    private parseAddSub(): number {
        let value = this.parseMulDiv();

        while (true) {
            this.skipSpaces();

            if (this.peek() === "+") {
                this.next();
                value += this.parseMulDiv();
            } else if (this.peek() === "-") {
                this.next();
                value -= this.parseMulDiv();
            } else {
                break;
            }
        }

        return value;
    }

    private parseMulDiv(): number {
        let value = this.parseUnary();

        while (true) {
            this.skipSpaces();

            if (this.peek() === "*") {
                this.next();
                value *= this.parseUnary();
            } else if (this.peek() === "/") {
                this.next();

                const divisor = this.parseUnary();

                if (divisor === 0) {
                    throw new Error("Division by zero");
                }

                value = Math.trunc(value / divisor);
            } else {
                break;
            }
        }

        return value;
    }

    private parseUnary(): number {
        this.skipSpaces();

        if (this.peek() === "!") {
            this.next();
            return this.bool(this.parseUnary() === 0);
        }

        if (this.peek() === "-") {
            this.next();
            return -this.parseUnary();
        }

        return this.parsePrimary();
    }

    private parsePrimary(): number {
        this.skipSpaces();

        if (this.peek() === "(") {
            this.next();

            const value = this.parseExpression();

            this.skipSpaces();
            if (this.next() !== ")") {
                throw new Error("Expected ')'");
            }

            return value;
        }

        if (this.isDigit(this.peek())) {
            return this.parseNumber();
        }

        if (this.isLetter(this.peek())) {
            return this.parseIdentifier();
        }

        throw new Error("Unexpected character: " + this.peek());
    }

    private parseNumber(): number {
        const start = this.pos;

        while (this.isDigit(this.peek())) {
            this.next();
        }

        return parseInt(this.s.substring(start, this.pos), 10);
    }

    private parseIdentifier(): number {
        const start = this.pos;

        while (this.isLetterOrDigit(this.peek())) {
            this.next();
        }

        const name = this.s.substring(start, this.pos);

        this.skipSpaces();

        if (name === "rnd" && this.peek() === "(") {
            this.next();

            const min = this.parseExpression();

            this.skipSpaces();
            if (this.next() !== ",") {
                throw new Error("Expected ','");
            }

            const max = this.parseExpression();

            this.skipSpaces();
            if (this.next() !== ")") {
                throw new Error("Expected ')'");
            }

            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        const value = this.vars[name];

        if (value !== undefined) {
            return value;
        }

        throw new Error("Unknown variable: " + name);
    }

    private match(token: string): boolean {
        this.skipSpaces();

        if (this.pos + token.length > this.s.length) {
            return false;
        }

        for (let i = 0; i < token.length; i++) {
            if (this.s[this.pos + i] !== token[i]) {
                return false;
            }
        }

        this.pos += token.length;
        return true;
    }

    private bool(value: boolean): number {
        return value ? 1 : 0;
    }

    private isDigit(ch: string): boolean {
        return ch >= "0" && ch <= "9";
    }

    private isLetter(ch: string): boolean {
        return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
    }

    private isLetterOrDigit(ch: string): boolean {
        return this.isLetter(ch) || this.isDigit(ch);
    }
}