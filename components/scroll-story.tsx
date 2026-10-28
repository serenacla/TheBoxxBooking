"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
export default function ScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const reducedMotionFrame = window.requestAnimationFrame(() =>
        setProgress(1),
      );
      return () => window.cancelAnimationFrame(reducedMotionFrame);
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const range = Math.max(1, rect.height - window.innerHeight);
      const next = Math.max(0, Math.min(1, -rect.top / range));
      setProgress((current) =>
        Math.abs(current - next) > 0.001 ? next : current,
      );
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const first = clamp(1 - progress / 0.4);
  const second = clamp(1 - Math.abs(progress - 0.5) / 0.3);
  const third = clamp((progress - 0.64) / 0.22);
  const motion = {
    "--booth-y": `${(0.5 - progress) * 26}px`,
    "--booth-turn": `${(progress - 0.5) * 8}deg`,
    "--booth-scale": String(0.9 + progress * 0.1),
    "--orbit-turn": `${-24 + progress * 54}deg`,
    "--orbit-turn-reverse": `${24 - progress * 54}deg`,
    "--flash-x": `${-55 + progress * 160}px`,
    "--flash-y": `${35 - progress * 105}px`,
    "--flash-turn": `${-12 + progress * 28}deg`,
    "--strip-x": `${40 - progress * 210}px`,
    "--strip-y": `${-45 + progress * 125}px`,
    "--strip-turn": `${15 - progress * 34}deg`,
    "--memory-x": `${-25 + progress * 105}px`,
    "--memory-y": `${-15 + progress * 70}px`,
    "--layout-x": `${38 - progress * 120}px`,
    "--layout-y": `${20 - progress * 58}px`,
  } as CSSProperties;

  return (
    <section
      className="scroll-story"
      ref={sectionRef}
      aria-label="THE BOXX Erlebnis beim Scrollen"
    >
      <div className="scroll-stage" style={motion}>
        <div className="story-kicker">
          <span>03 / In Bewegung</span>
          <b>{String(Math.round(progress * 100)).padStart(2, "0")}</b>
        </div>
        <div className="story-copy">
          <article
            style={{
              opacity: first,
              transform: `translateY(${(1 - first) * -22}px)`,
            }}
          >
            <small>Hinstellen</small>
            <h2>
              Bereit,
              <br />
              <em>wenn ihr es seid.</em>
            </h2>
            <p>
              Die Boxx kommt zu eurem Event, wird eingerichtet und fügt sich
              direkt in die Feier ein.
            </p>
          </article>
          <article
            style={{
              opacity: second,
              transform: `translateY(${(1 - second) * 22}px)`,
            }}
          >
            <small>Auslösen</small>
            <h2>
              Ein Blitz.
              <br />
              <em>Echte Reaktionen.</em>
            </h2>
            <p>
              Antippen, zusammenrücken, lachen – und aus einem kurzen Moment
              wird eine bleibende Erinnerung.
            </p>
          </article>
          <article
            style={{
              opacity: third,
              transform: `translateY(${(1 - third) * 22}px)`,
            }}
          >
            <small>Mitnehmen</small>
            <h2>
              Sofort gedruckt.
              <br />
              <em>Für immer eures.</em>
            </h2>
            <p>
              Hochwertige Fotostreifen direkt in der Hand und alle Aufnahmen
              zusätzlich in eurer digitalen Galerie.
            </p>
          </article>
        </div>
        <div className="story-visual" aria-hidden="true">
          <div className="story-glow" />
          <div className="story-orbit orbit-one" />
          <div className="story-orbit orbit-two" />
          <div className="scroll-booth">
            <div className="booth-brand">
              <span>THE</span> BOXX<b>.</b>
            </div>
            <div className="booth-lens">
              <i />
            </div>
            <div className="booth-screen">
              <small>DEIN MOMENT</small>
              <strong>3 · 2 · 1</strong>
            </div>
            <div className="print-slot" />
            <div className="printed-photo">
              <i />
              <i />
              <i />
              <small>
                KEEP
                <br />
                THE
                <br />
                MOMENT
              </small>
            </div>
          </div>
          <div className="motion-chip flash-chip">
            <i />
            FLASH
          </div>
          <div className="motion-chip memory-chip">
            <b>∞</b>
            <span>Erinnerungen</span>
          </div>
          <div className="motion-chip layout-chip">
            <i />
            <span>Euer Design</span>
          </div>
          <div className="photo-strip">
            <i />
            <i />
            <i />
            <small>THE BOXX</small>
          </div>
        </div>
        <div className="story-progress">
          <span>Scrollen</span>
          <i>
            <b style={{ transform: `scaleX(${progress})` }} />
          </i>
          <span>Erinnerung</span>
        </div>
      </div>
    </section>
  );
}
