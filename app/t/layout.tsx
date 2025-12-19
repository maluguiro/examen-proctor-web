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
                // background: removed to allow body background to show
                overflow: "hidden", // still useful to prevent horizontal scroll
                color: "#1a1a1a",
                fontFamily: "var(--font-sans)",
            }}
        >
            {/* The global background (body::before) will now be visible. */}

            {/* --- CONTENIDO --- */}
            <div style={{ position: "relative", zIndex: 1 }}>
                {children}
            </div>
        </div>
    );
}
