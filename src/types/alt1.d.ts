declare module "alt1/fonts/aa_8px_mono.js" {
    interface FontChar {
        width: number;
        bonus: number;
        chr: string;
        pixels: number[];
        secondary: boolean;
    }

    interface FontMetadata {
        chars: FontChar[];
        width: number;
        spacewidth: number;
        shadow: boolean;
        height: number;
        basey: number;
    }

    const font: FontMetadata;
    export default font;
}

declare module "alt1/fonts/chatbox/12pt.js" {
    interface FontChar {
        width: number;
        bonus: number;
        chr: string;
        pixels: number[];
        secondary: boolean;
    }

    interface FontMetadata {
        chars: FontChar[];
        width: number;
        spacewidth: number;
        shadow: boolean;
        height: number;
        basey: number;
    }

    const fontmono2: FontMetadata;
    export default fontmono2;
}
