import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const logos = [
  { name: "YouTube", svg: "M23.5 6.2c-.3-1-1-1.8-2-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.5.6c-1 .3-1.7 1.1-2 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1 1 1.8 2 2.1 1.9.6 9.5.6 9.5.6s7.6 0 9.5-.6c1-.3 1.7-1.1 2-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z" },
  { name: "Spotify", svg: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.3c-.2.3-.6.4-1 .2-2.7-1.6-6-2-10-1.1-.4.1-.8-.2-.9-.5-.1-.4.2-.8.5-.9 4.3-1 8.1-.6 11.1 1.2.4.2.5.7.3 1.1zm1.5-3.3c-.3.4-.8.5-1.2.3-3-1.9-7.7-2.4-11.3-1.3-.5.1-1-.1-1.1-.6-.1-.5.1-1 .6-1.1 4.1-1.3 9.2-.7 12.7 1.5.3.2.5.8.3 1.2zm.1-3.4c-3.7-2.2-9.7-2.4-13.2-1.3-.5.2-1.1-.1-1.3-.6-.2-.5.1-1.1.6-1.3 4-1.2 10.7-1 14.9 1.5.5.3.6.9.4 1.4-.3.4-.9.6-1.4.3z" },
  { name: "TikTok", svg: "M16.6 5.8A4.3 4.3 0 0 1 13.4 0h-3.2v16.6a2.6 2.6 0 0 1-2.6 2.2 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 2.6-2.6c.3 0 .5 0 .8.1V10.4c-.3 0-.5-.1-.8-.1a5.9 5.9 0 0 0-5.9 5.9A5.9 5.9 0 0 0 7.6 22a5.9 5.9 0 0 0 5.9-5.9V8a7.5 7.5 0 0 0 4.3 1.4V6.2a4.4 4.4 0 0 1-1.2-.4z" },
  { name: "Vimeo", svg: "M23.9 6.7c-.1 2.2-1.6 5.3-4.6 9.1C16.1 20 13.5 22 11.3 22c-1.4 0-2.5-1.3-3.4-3.8L6.2 12c-.6-2.5-1.2-3.8-1.9-3.8-.1 0-.7.3-1.6.9L1.7 8l3.2-2.8c1.4-1.2 2.5-1.9 3.2-1.9 1.7-.2 2.7 1 3 3.4.4 2.6.6 4.3.8 4.9.5 2 .9 3 1.5 3 .4 0 1.1-.7 1.9-2 .8-1.3 1.3-2.3 1.4-3 .1-1.2-.3-1.8-1.4-1.8-.5 0-1 .1-1.5.3 1-3.3 2.9-4.9 5.7-4.8 2.1.1 3.1 1.4 2.4 4.4z" },
  { name: "Netflix", svg: "M5.4 0L1.8 0 7.2 24c.8 0 1.5-.1 2.3-.3L5.4 0zm6.6 0v17.7c.7-.2 1.5-.5 2.2-.8V0h-2.2zm6.6 0l-4.1 13.2c.7-.4 1.4-.8 2-1.3L19.3 3 22.2 24c.7-.5 1.3-1 1.8-1.5V0h-5.4z" },
  { name: "Adobe", svg: "M14.3 0H24l-9.7 24h-3.8l5.8-14.4L12.4 0h1.9zM9.7 0H0l9.7 24h3.8L7.7 9.6 9.7 0z" },
  { name: "Figma", svg: "M8 24c2.2 0 4-1.8 4-4v-4H8c-2.2 0-4 1.8-4 4s1.8 4 4 4zm-4-12c0-2.2 1.8-4 4-4h4v8H8c-2.2 0-4-1.8-4-4zm0-8c0-2.2 1.8-4 4-4h4v8H8C5.8 8 4 6.2 4 4zm8-4h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4V0zm8 12c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4 4 1.8 4 4z" },
  { name: "Canva", svg: "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm0 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z" },
];

export default function ClientLogos() {
  return (
    <section className="py-16 px-4 border-y border-border/30 relative overflow-hidden">
      <AnimatedSection>
        <p className="text-center text-sm text-muted-foreground mb-8 tracking-widest uppercase">
          Exportez vers vos plateformes favorites
        </p>
      </AnimatedSection>

      {/* Infinite scroll container */}
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />

        <motion.div
          className="flex gap-16 items-center"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {/* Double the logos for seamless loop */}
          {[...logos, ...logos].map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="flex-shrink-0 flex items-center gap-2 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                <path d={logo.svg} />
              </svg>
              <span className="text-sm font-medium whitespace-nowrap">{logo.name}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
