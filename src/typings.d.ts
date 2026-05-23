declare module 'bootstrap' {
  export class Modal {
    constructor(element: Element | string, options?: {
      backdrop?: boolean | 'static';
      keyboard?: boolean;
      focus?: boolean;
    });
    show(): void;
    hide(): void;
    toggle(): void;
    dispose(): void;
    static getInstance(element: Element): Modal | null;
  }

  export class Offcanvas {
    constructor(element: Element | string, options?: {
      backdrop?: boolean | 'static';
      keyboard?: boolean;
      scroll?: boolean;
    });
    show(): void;
    hide(): void;
    toggle(): void;
    dispose(): void;
    static getInstance(element: Element): Offcanvas | null;
  }
}
