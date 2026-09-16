// Nous adapter for the unmodified thinking-orbs 0.3.1 engine (MIT).
import { MODE_FRAMES, resolvePreset, paintFrame } from './vendor/thinking-orbs/engine.es.js';

class NousOrb extends HTMLElement {
  static observedAttributes = ['state', 'size', 'hidden'];
  connectedCallback() {
    if (this.canvas) return;
    this.setAttribute('aria-hidden', 'true'); // Adjacent status text names the operation.
    this.canvas = document.createElement('canvas');
    this.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.sync = () => this.restart();
    this.motion.addEventListener('change', this.sync);
    document.addEventListener('visibilitychange', this.sync);
    this.observer = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.restart();
    });
    this.observer.observe(this);
    this.restart();
  }
  attributeChangedCallback() { if (this.canvas) this.restart(); }
  restart() {
    cancelAnimationFrame(this.raf);
    if (!this.ctx || !this.isConnected || this.hidden || document.hidden || this.visible === false) return;
    const size = this.getAttribute('size') === '64' ? 64 : 20;
    const state = ['working','connecting','composing'].includes(this.getAttribute('state')) ? this.getAttribute('state') : 'working';
    const preset = resolvePreset(state, size);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = this.canvas.height = size * dpr;
    this.canvas.style.width = this.canvas.style.height = `${size}px`;
    const draw = () => {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.clearRect(0, 0, size, size);
      const time = this.motion.matches ? 0.6 : performance.now() / 1000 * preset.speed;
      paintFrame(this.ctx, MODE_FRAMES[preset.mode](size, time, preset.opts), false);
      if (!this.motion.matches) this.raf = requestAnimationFrame(draw);
    };
    draw();
  }
  disconnectedCallback() {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.motion?.removeEventListener('change', this.sync);
    document.removeEventListener('visibilitychange', this.sync);
    this.canvas?.remove();
    this.canvas = null;
  }
}
customElements.define('nous-orb', NousOrb);
