"use client";
import * as React from "react";

type Props = {
    variant?: "default" | "subtle";
};

export default function NatureCaustics({ variant = "subtle" }: Props) {
    const opacity = variant === "subtle" ? 0.10 : 0.16;

    return (
        <svg
            className="bg-caustics-svg pointer-events-none fixed inset-0 z-0 mix-blend-screen"
            style={{ opacity }}
            aria-hidden="true"
        >
            <filter id="water-light">
                <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.008"
                    numOctaves={2}
                    seed={3}
                    result="noise"
                >
                    <animate
                        attributeName="baseFrequency"
                        dur="16s"
                        values="0.007;0.010;0.008;0.007"
                        repeatCount="indefinite"
                    />
                    <animate
                        attributeName="seed"
                        dur="20s"
                        values="2;3;4;3;2"
                        repeatCount="indefinite"
                    />
                </feTurbulence>

                <feColorMatrix
                    type="matrix"
                    values="
            2 0 0 0 -0.8
            0 2 0 0 -0.8
            0 0 2 0 -0.8
            0 0 0 1  0"
                />

                <feGaussianBlur stdDeviation={0.4} />
            </filter>

            <rect width="100%" height="100%" filter="url(#water-light)" />
        </svg>
    );
}
