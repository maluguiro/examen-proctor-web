# Plan de UI para Examen de Alumno

## Descripción Actual
El archivo `app/s/[code]/page.tsx` contiene la lógica y vista del examen. Actualmente usa estilos inline básicos y una estructura sencilla que no coincide con el nuevo diseño "premium".

## FASE 1: Layout General y Fondo
**Objetivo:** Crear el contenedor "premium" y la tarjeta central sin tocar la lógica interna ni la funcionalidad.

1.  **Contenedor Principal:**
    *   Reemplazar el `div` raíz actual (`style={{ padding: 16, maxWidth: 900 ... }}`) por un contenedor de pantalla completa.
    *   Estilos: `minHeight: "100vh"`, `display: "flex"`, `justifyContent: "center"`, `alignItems: "center"` (o "flex-start" con padding top para scroll).
    *   **Fondo Pastel:** Usar un gradiente animado suave (ej. tonos rosa, celeste, durazno) similar al dashboard.
    *   **Textura:** Aplicar clase `.bg-noise` (global) o estilo equivalente.

2.  **Tarjeta Central Glassmorphism:**
    *   Envolver el contenido dinámico (que cambia según `step`) en una tarjeta central.
    *   Estilos:
        *   `width: "100%"`, `maxWidth: "900px"`.
        *   `background: "rgba(255, 255, 255, 0.78)"`.
        *   `backdropFilter: "blur(14px)"`.
        *   `borderRadius: "24px"`.
        *   `boxShadow`: `0 8px 32px rgba(31, 38, 135, 0.15)`.
        *   `padding`: `40px` (ajustable en móvil).
        *   `margin`: `20px` (para asegurar espacio en bordes).

3.  **Animación de Entrada:**
    *   Definir `@keyframes fadeSlideUp` localmente (o usar `animate-slide-up` global si el usuario lo permite, pero definiremos una local para garantizar independencia).
    *   Aplicar animación a la tarjeta central al montar.

4.  **Estilos Globales Locales:**
    *   Definir un objeto `const pageStyles = { ... }` dentro del archivo para mantener el código limpio y organizado sin crear archivos extra innecesarios (a menos que crezca mucho).

## FASE 2: Detalles (Preguntas y Botones)
**Objetivo:** Refinar el interior de la tarjeta una vez aprobado el layout de Fase 1. **Solo se aplicará tras confirmación explícita.**

1.  **Encabezado (Timer/Vidas):**
    *   Rediseñar el bloque `Header` y la barra de estado.
    *   Usar un contenedor interno con fondo blanco translúcido y bordes redondeados.
    *   Mejorar alineación y tipografía de "Vidas", "Tiempo", "Usuario".

2.  **Tarjetas de Preguntas:**
    *   Encapsular cada pregunta (`renderQuestion`) en un contenedor con estilos visuales mejorados:
        *   `background: "#ffffff"` (o muy suave #f9fafb).
        *   `borderRadius: "16px"`.
        *   `padding: "24px"`.
        *   `border`: `1px solid rgba(0,0,0,0.05)`.
        *   Separación vertical mayor.

3.  **Inputs y Opciones:**
    *   Estilizar `radio` buttons y `checkboxes` para que sean más grandes y amigables.
    *   Mejorar `textarea` e `inputs` con `focus` ring suave y bordes redondeados.

4.  **Botones de Acción:**
    *   Transformar botones estándar en "Pills" (`borderRadius: 999px`).
    *   **Botón Principal:** Gradiente suave o color sólido oscuro con texto blanco.
    *   **Botón Secundario:** Borde suave, fondo transparente.
    *   **Micro-interacciones:** `transform: scale(1.02)` en hover, transición de sombra.

---
**Nota:** No se tocará ninguna lógica de negocio (`startAttempt`, `submitAttempt`, `reportViolation`, etc.). Solo se cambiará la estructura JSX contenedora y los objetos de estilo `style={{...}}`.
