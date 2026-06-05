import { createContext, useContext, useState, type ReactNode } from "react";

interface GuestState {
  token: string;
  allowedSections: string[];
  expiresAt: string;
  setGuest: (token: string, allowedSections: string[], expiresAt: string) => void;
}

const GuestContext = createContext<GuestState | undefined>(undefined);

export function GuestProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [allowedSections, setAllowedSections] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");

  function setGuest(t: string, sections: string[], exp: string) {
    setToken(t);
    setAllowedSections(sections);
    setExpiresAt(exp);
  }

  return (
    <GuestContext.Provider value={{ token, allowedSections, expiresAt, setGuest }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuest() {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error("useGuest must be used within GuestProvider");
  return ctx;
}
