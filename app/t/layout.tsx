"use client";

import * as React from "react";

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            style={{
                minHeight: "100vh",
                position: "relative",
                background: "#F8F9FA", // Fondo base claro muy sutil
                overflow: "hidden",
                color: "#1a1a1a",
                fontFamily: "var(--font-sans)",
            }}
        >
            {/* --- FLUID AURORA BACKGROUND SYSTEM --- */}

            {/* 1. Orbe Violeta Principal */}
            <div
                className="aurora-blob animate-float-slow"
                style={{
                    top: "-10%",
                    left: "-10%",
                    width: "50vw",
                    height: "50vw",
                    background: "radial-gradient(circle, rgba(121,40,202,0.4) 0%, rgba(121,40,202,0) 70%)",
                }}
            />

            {/* 2. Orbe Rosa Neón */}
            <div
                className="aurora-blob animate-float-medium"
                style={{
                    top: "20%",
                    right: "-10%",
                    width: "40vw",
                    height: "40vw",
                    background: "radial-gradient(circle, rgba(255,0,128,0.35) 0%, rgba(255,0,128,0) 70%)",
                    animationDelay: "2s",
                }}
            />

            {/* 3. Orbe Cyan/Azul Energético */}
            <div
                className="aurora-blob animate-float-slow"
                style={{
                    bottom: "-10%",
                    left: "20%",
                    width: "45vw",
                    height: "45vw",
                    background: "radial-gradient(circle, rgba(0,223,216,0.3) 0%, rgba(0,223,216,0) 70%)",
                    animationDelay: "5s",
                }}
            />

            {/* 4. Orbe Amarillo Solar (Acento sutil) */}
            <div
                className="aurora-blob animate-morph"
                style={{
                    bottom: "10%",
                    right: "10%",
                    width: "25vw",
                    height: "25vw",
                    background: "radial-gradient(circle, rgba(255,209,102,0.25) 0%, rgba(255,209,102,0) 70%)",
                }}
            />

            {/* Capa de Ruido (Noise) para texturizar lo digital */}
            <div
                className="bg-noise"
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 0,
                    opacity: 0.4,
                    pointerEvents: "none",
                }}
            />

            {/* --- CONTENIDO --- */}
            <div style={{ position: "relative", zIndex: 2 }}>
                {children}
            </div>
        </div>
    );
}
