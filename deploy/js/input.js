(function () {
  "use strict";
  const VB = window.VB;

  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();
      this.pressed = new Set();
      this.mouse = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5, down: false };
      this.touch = { x: 0, y: 0, fire: false, enabled: false };

      window.addEventListener("keydown", (e) => {
        if (
          ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)
        ) {
          e.preventDefault();
        }
        if (!e.repeat) {
          this.keys.add(e.code);
          this.pressed.add(e.code);
        }
      });

      window.addEventListener("keyup", (e) => {
        this.keys.delete(e.code);
      });

      window.addEventListener("blur", () => {
        this.keys.clear();
        this.pressed.clear();
        this.mouse.down = false;
        this.touch.x = 0;
        this.touch.y = 0;
        this.touch.fire = false;
      });

      window.addEventListener("mousemove", (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      });

      window.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
          this.mouse.down = true;
          this.pressed.add("Mouse0");
        }
      });

      window.addEventListener("mouseup", (e) => {
        if (e.button === 0) this.mouse.down = false;
      });

      window.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    down(code) {
      return this.keys.has(code);
    }

    hit(code) {
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        return true;
      }
      return false;
    }

    endFrame() {
      this.pressed.clear();
    }
  }

  VB.Input = Input;
  VB.stage && VB.stage("input");
})();
