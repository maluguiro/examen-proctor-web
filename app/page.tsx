
import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-noise animate-superbloom min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{
        background: "linear-gradient(-45deg, #ff9a9e, #fad0c4, #fad0c4, #a18cd1, #fbc2eb)"
      }}>

      {/* Decorative Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/30 rounded-full blur-3xl mix-blend-overlay animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/30 rounded-full blur-3xl mix-blend-overlay animate-pulse" style={{ animationDelay: "2s" }} />

      <main className="glass-card w-full max-w-md p-8 md:p-12 rounded-3xl animate-slide-up relative z-10">
        <div className="text-center space-y-8">

          {/* Header */}
          <div className="space-y-2 animate-slide-up stagger-1">
            <h1 className="font-festive text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
              Examen Proctor
            </h1>
            <p className="text-gray-600 font-medium tracking-wide text-sm md:text-base">
              PLATAFORMA INTELIGENTE DE EVALUACIÓN
            </p>
          </div>

          {/* Actions */}
          <div className="grid gap-4 w-full animate-slide-up stagger-2">
            <Link
              href="/t"
              className="btn-premium group flex items-center justify-center gap-3 w-full bg-gray-900 text-white rounded-xl h-14 font-semibold text-lg hover:bg-black transition-colors"
            >
              <span>Ingresar como Docente</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>

            <button
              className="btn-premium flex items-center justify-center gap-3 w-full bg-white text-gray-900 border border-gray-200 rounded-xl h-14 font-semibold text-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
              onClick={() => alert("Funcionalidad de alumno próximamente...")}
            >
              <span>Ingresar como Alumno</span>
            </button>
          </div>

          {/* Footer Info */}
          <div className="pt-4 border-t border-gray-200/50 animate-slide-up stagger-3">
            <p className="text-xs text-gray-500 font-mono">
              v1.0.0 • Secure Environment
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
