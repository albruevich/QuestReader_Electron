class AliveText {
    constructor(element) {
        this.element = element;
        this.timer = null;
    }

    setText(value, instant = false) {
        this.stop();

        if (!this.element) {
            return;
        }

        if (!value) {
            this.element.innerHTML = "";
            return;
        }

        if (instant) {
            this.element.innerHTML = value;
            return;
        }

        const plainTextLength = AliveText.getHtmlVisibleLength(value);

        if (plainTextLength <= 0) {
            this.element.innerHTML = value;
            return;
        }

        const charsPerSecond = AliveText.getCharsPerSecond(plainTextLength);
        const intervalMs = 16;

        let visibleChars = 0;

        this.element.innerHTML = "";

        this.timer = setInterval(() => {
            visibleChars += charsPerSecond * (intervalMs / 1000);

            this.element.innerHTML = AliveText.sliceHtmlByVisibleChars(
                value,
                Math.floor(visibleChars)
            );

            if (visibleChars >= plainTextLength) {
                this.stop();
                this.element.innerHTML = value;
            }
        }, intervalMs);
    }

    stop() {
        if (!this.timer) {
            return;
        }

        clearInterval(this.timer);
        this.timer = null;
    }

    static setButtonText(button, value) {
        if (!button) {
            return;
        }

        if (!value) {
            button.textContent = "";
            return;
        }

        const charsPerSecond = AliveText.getCharsPerSecond(value.length);
        const intervalMs = 16;

        let visibleChars = 0;
        button.textContent = "";

        const timer = setInterval(() => {
            visibleChars += charsPerSecond * (intervalMs / 1000);

            button.textContent = value.substring(0, Math.floor(visibleChars));

            if (visibleChars >= value.length) {
                clearInterval(timer);
                button.textContent = value;
            }
        }, intervalMs);
    }

    static getHtmlVisibleLength(value) {
        return value
            .replace(/<br\s*\/?>/g, "\n")
            .replace(/<[^>]*>/g, "")
            .length;
    }

    static getCharsPerSecond(textLength) {
        const minCharsPerSecond = 80;
        const maxCharsPerSecond = 700;
        const shortTextLength = 40;
        const longTextLength = 500;

        let ratio =
            (textLength - shortTextLength) /
            (longTextLength - shortTextLength);

        ratio = Math.max(0, Math.min(1, ratio));

        return minCharsPerSecond +
            (maxCharsPerSecond - minCharsPerSecond) * ratio;
    }

    static sliceHtmlByVisibleChars(html, maxChars) {
        let result = "";
        let visible = 0;
        let insideTag = false;

        for (let i = 0; i < html.length; i++) {
            const ch = html[i];

            if (ch === "<") {
                insideTag = true;
            }

            result += ch;

            if (!insideTag) {
                visible++;

                if (visible >= maxChars) {
                    break;
                }
            }

            if (ch === ">") {
                insideTag = false;
            }
        }

        return result;
    }
}

module.exports = {
    AliveText
};
