declare module "svg-dom-arrows" {
  interface PathOptions {
    start: {
      element: HTMLElement;
      position: {
        top: number;
        left: number;
      };
    };
    end: {
      element: HTMLElement;
      position: {
        top: number;
        left: number;
      };
    };
    style?: string;
    appendTo?: HTMLElement;
    offset?: {
      start?: {
        left?: number;
        top?: number;
      };
      end?: {
        left?: number;
        top?: number;
      };
    };
  }

  export class CurvyPath {
    constructor(options: PathOptions);
    render(): void;
    element: SVGSVGElement;
  }

  export class LinePath {
    constructor(options: PathOptions);
    render(): void;
    element: SVGSVGElement;
  }

  export class SquarePath {
    constructor(options: PathOptions);
    render(): void;
    element: SVGSVGElement;
  }
}
