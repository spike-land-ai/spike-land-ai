import { createContext, useContext, useState, ReactNode } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface LightboxContextType {
  openLightbox: (index: number, slides: { src: string; alt?: string }[]) => void;
  closeLightbox: () => void;
}

const LightboxContext = createContext<LightboxContextType | null>(null);

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [slides, setSlides] = useState<{ src: string; alt?: string }[]>([]);

  const openLightbox = (i: number, s: { src: string; alt?: string }[]) => {
    setSlides(s);
    setIndex(i);
    setOpen(true);
  };

  return (
    <LightboxContext.Provider value={{ openLightbox, closeLightbox: () => setOpen(false) }}>
      {children}
      <Lightbox open={open} close={() => setOpen(false)} index={index} slides={slides} />
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error("useLightbox must be used within a LightboxProvider");
  }
  return context;
}
