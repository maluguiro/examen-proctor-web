"use client";

import * as React from "react";

export default function ThemeToggle() {
    const [theme, setTheme] = React.useState<"light" | "dark">("light");
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem("theme") as "light" | "dark" | null;
        if (stored) {
            setTheme(stored);
            document.documentElement.classList.toggle("dark", stored === "dark");
        } else {
            // Opcional: detectar prefers-color-scheme si no hay preferencia guardada
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            if (prefersDark) {
                setTheme("dark");
                document.documentElement.classList.add("dark");
            }
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        document.documentElement.classList.toggle("dark", newTheme === "dark");
    };

    // Evitar hydration mismatch renderizando null o un placeholder hasta que esté montado
    if (!mounted) return null;

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/10 text-xl"
            title={`Cambiar a modo ${theme === "light" ? "oscuro" : "claro"}`}
        >
            {theme === "light" ? "🌙" : "🌞"}
        </button>
    );
}
