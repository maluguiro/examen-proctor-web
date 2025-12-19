"use client";

import * as React from "react";

type ChatShellContextType = {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  setHasNew: (v: boolean) => void;
};

// Creamos el contexto. Lo exportamos para que ExamChat lo pueda consumir.
export const ChatShellContext = React.createContext<ChatShellContextType>({
  isOpen: false,
  setIsOpen: () => { },
  setHasNew: () => { },
});

type Props = {
  children: React.ReactNode;
  label?: string;
};

export default function FloatingChatShell({ children, label = "Chat" }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hasNew, setHasNew] = React.useState(false);

  // Al abrir, se limpia la notificación
  React.useEffect(() => {
    if (isOpen) {
      setHasNew(false);
    }
  }, [isOpen]);

  const value = React.useMemo(
    () => ({ isOpen, setIsOpen, setHasNew }),
    [isOpen]
  );

  return (
    <ChatShellContext.Provider value={value}>
      <div
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 9999, // Super alto para estar encima de todo
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Panel del Chat (Visible solo si isOpen) */}
        <div
          style={{
            width: 340,
            maxHeight: "65vh",
            marginBottom: 16,
            background: "rgba(255, 255, 255, 0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 24,
            boxShadow:
              "0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0,0,0,0.05)",
            border: "1px solid rgba(255, 255, 255, 0.8)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            transformOrigin: "bottom right",
            transform: isOpen
              ? "scale(1) translateY(0)"
              : "scale(0.95) translateY(20px)",
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
          }}
        >
          {children}
        </div>

        {/* Botón Flotante (FAB) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            height: 56,
            minWidth: 56,
            padding: "0 24px",
            borderRadius: 999,
            background: "linear-gradient(135deg, #a3e635 0%, #facc15 50%, #fb923c 100%)",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "0 8px 20px rgba(251, 146, 60, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700,
            color: "white",
            letterSpacing: "0.5px",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>
            {isOpen ? "✕" : "🍀​"}
          </span>
          {!isOpen && <span>{label}</span>}

          {/* Badge de notificación */}
          {!isOpen && hasNew && (
            <span
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#ff4757",
                border: "2px solid white",
              }}
            />
          )}
        </button>
      </div>
    </ChatShellContext.Provider>
  );
}
