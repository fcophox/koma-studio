# Koma Studio

Creador y maquetador de cómics / manga **local-first**: Next.js 16 (App Router) + TypeScript + Tailwind v4 + react-konva + Zustand + IndexedDB.

```bash
npm install
npm run dev        # http://localhost:3000
```

Todo se guarda en el navegador (IndexedDB). Las fuentes las sirve la propia app vía `next/font`.

## Estructura

```
src/
├── app/
│   ├── layout.tsx                 # fuentes + estilos globales
│   ├── page.tsx                   # dashboard de proyectos
│   └── editor/[projectId]/page.tsx
├── components/
│   ├── ui/                        # Button, Modal (<dialog>), Fields, ConfirmDialog
│   ├── shared/                    # Logo, PagePreview (SVG en vivo), TemplatePreview
│   ├── dashboard/                 # Dashboard, ProjectCard, NewProjectDialog
│   └── editor/
│       ├── EditorScreen.tsx       # carga + autoguardado + atajos + layout
│       ├── EditorHeader.tsx       # metadata, deshacer/rehacer, guardado, exportar
│       ├── PagesSidebar.tsx       # miniaturas, reordenar (dnd-kit), duplicar, borrar
│       ├── ToolsSidebar.tsx       # pestañas Página / Globos / SFX / Capas
│       ├── TemplateGrid.tsx, TemplatePickerDialog.tsx
│       ├── ProjectSettingsDialog.tsx, ExportDialog.tsx
│       ├── tools/                 # PageTab, LayersTab, UpcomingTab
│       └── canvas/                # EditorCanvas (ssr:false), CanvasStage (zoom/pan), PageRenderer
└── lib/
    ├── types.ts                   # Project, Page, PanelSlot, PlacedImage, SpeechBubble, OnomatopoeiaElement…
    ├── formats.ts                 # B5, cómic US, A4, Webtoon (4 u/mm → 3x ≈ 305 DPI)
    ├── templates.ts               # biblioteca de plantillas (polígonos normalizados)
    ├── geometry.ts                # área útil, inset de polígonos (gutter), espejado RTL
    ├── page-number.ts             # posición del número impreso (centro / borde exterior)
    ├── factory.ts                 # crear proyecto/página, cambiar plantilla conservando imágenes
    ├── db.ts                      # IndexedDB: proyectos + assets (Blobs) + caché de Object URLs
    ├── store/editor-store.ts      # Zustand: proyecto, páginas, selección, historial por página
    ├── store/autosave.ts          # sincronización Zustand → IndexedDB con debounce
    └── hooks/use-editor-shortcuts.ts
```

## Atajos

| Acción | Atajo |
| --- | --- |
| Deshacer / Rehacer (por página) | `Ctrl/Cmd+Z` · `Ctrl/Cmd+Y` o `Ctrl/Cmd+Shift+Z` |
| Borrar selección | `Supr` / `Backspace` |
| Mover lienzo | `Espacio` + arrastrar, o botón central |
| Zoom | rueda · `Ctrl/Cmd +/−` · `Ctrl/Cmd 0` encajar |
| Cambiar de página | `RePág` / `AvPág` |
| Encuadrar imagen de la viñeta | doble clic o `Enter` · `Esc` para salir |
| Mover imagen dentro de la viñeta | flechas (1u) · `Shift` + flechas (10u) |
| Quitar imagen de la viñeta | `Supr` con la viñeta seleccionada |
| Editar texto de globo / onomatopeya | doble clic o `Enter` · `Esc` o `Ctrl/Cmd+Enter` para terminar |
| Duplicar elemento | `Ctrl/Cmd+D` |
| Traer adelante / al frente | `Ctrl/Cmd+]` · `Ctrl/Cmd+Shift+]` |
| Enviar atrás / al fondo | `Ctrl/Cmd+[` · `Ctrl/Cmd+Shift+[` |
| Mover elemento | flechas (1u) · `Shift` + flechas (10u) |

## Imágenes

- Arrastra archivos PNG/JPG/WEBP desde el sistema directamente sobre una viñeta, o a la pestaña **Imágenes**.
- Desde la biblioteca: arrastra una miniatura a una viñeta, o selecciona la viñeta y haz clic en la miniatura.
- Doble clic en una viñeta vacía abre el selector de archivos.
- Las imágenes se guardan como Blob en IndexedDB (`koma-assets`), separadas del JSON del proyecto.

## Globos y onomatopeyas

- **Globos:** ovalado, pensamiento (nube), grito, susurro (punteado) y narración. Clic en el catálogo para añadir al centro de la vista, o arrástralo a la página.
- La cola se orienta arrastrando el punto naranja; también hay posiciones rápidas (izq. / abajo / der. / sin cola).
- Redimensionar un globo cambia su ancho/alto (el texto refluye); "Ajustar" adapta el alto al texto.
- **Onomatopeyas:** catálogo por categorías (Acción, Velocidad, Emoción, Efectos) con versiones en japonés (ドン, ゴゴゴ, ドキドキ). Color de relleno y contorno, inclinación, espaciado, modo vertical y texto propio con el mismo estilo.
- Fuentes self-hosted: Comic Neue, Bangers, Dela Gothic One (japonés) e Inter. Los proyectos guardan un id de fuente, no el nombre interno de next/font.

## Exportación

Botón **Exportar** de la cabecera:

| Opción | Valores |
| --- | --- |
| Alcance | Página actual · Capítulo completo |
| Formato | PNG · JPG (calidad 50–100 %) · PDF multipágina |
| Resolución | 1× vista previa · 2× web · 3× impresión (≈ 305 DPI en formatos impresos) |

- Capítulo en PNG/JPG → `[Proyecto]_Cap[NN]_[AAAAMMDD-HHmm].zip` con `001_pagina.png`, `002_pagina.png`…
- PDF → páginas al tamaño físico real (mm); en lectura manga se marca como derecha → izquierda.
- El render usa el mismo `PageRenderer` del editor en modo `export`: sin selección, asas, sombras ni números guía. Antes de rasterizar se esperan imágenes y fuentes (incluidos los glifos japoneses).
- Todo se genera en el navegador; JSZip y jsPDF se cargan solo al exportar.

## Fases

1. ✅ Arquitectura, tipos, store y persistencia
2. ✅ Dashboard y editor base
3. ✅ Imágenes en viñetas (drop, pan, zoom, rotación, flip)
4. ✅ Globos de diálogo y onomatopeyas
5. ✅ Exportación PNG/JPG/PDF y lote ZIP
