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
| Deshacer / Rehacer (todo el capítulo: también borrar, añadir, duplicar y mover páginas) | `Ctrl/Cmd+Z` · `Ctrl/Cmd+Y` o `Ctrl/Cmd+Shift+Z` |
| Borrar selección | `Supr` / `Backspace` |
| Mover lienzo | `Espacio` + arrastrar, o botón central |
| Zoom | rueda · `Ctrl/Cmd +/−` · `Ctrl/Cmd 0` encajar |
| Cambiar de página | `RePág` / `AvPág` |
| Reordenar páginas | arrastra la miniatura arriba/abajo · teclado: asa ⋮⋮ + `Espacio`, flechas, `Espacio` |
| Seleccionar varias páginas | `Ctrl/Cmd+clic` (añadir/quitar) · `Shift+clic` (rango) · `Esc` quita la selección · `Supr` las elimina |
| Encuadrar imagen de la viñeta | doble clic o `Enter` · `Esc` para salir |
| Mover imagen dentro de la viñeta | flechas (1u) · `Shift` + flechas (10u) |
| Quitar imagen de la viñeta | `Supr` con la viñeta seleccionada |
| Copiar / cortar | `Ctrl/Cmd+C` · `Ctrl/Cmd+X` — imagen de la viñeta (con su encuadre) o globo/onomatopeya seleccionado |
| Pegar | `Ctrl/Cmd+V` — se pega lo último copiado: la imagen en la viñeta seleccionada (también imágenes de otra app o web), o el globo en la página actual (misma posición en otra página; desplazado si es la misma) |
| Olvidar lo copiado | `Esc` sin nada seleccionado |
| Editar texto de globo / onomatopeya | doble clic o `Enter` · `Esc` o `Ctrl/Cmd+Enter` para terminar |
| Duplicar elemento | `Ctrl/Cmd+D` |
| Traer adelante / al frente | `Ctrl/Cmd+]` · `Ctrl/Cmd+Shift+]` |
| Enviar atrás / al fondo | `Ctrl/Cmd+[` · `Ctrl/Cmd+Shift+[` |
| Mover elemento | flechas (1u) · `Shift` + flechas (10u) |

## Panel de páginas: subcategorías

- **Varias páginas a la vez:** selecciónalas con `Cmd/Ctrl+clic` o `Shift+clic` y arrastra cualquiera de ellas: se mueven juntas, en su orden.
- **Subcategorías:** botón de carpeta (o "Agrupar" en la barra de selección) para agrupar las páginas elegidas; el nombre se edita al momento, con doble clic o con el lápiz.
- **Plegar / desplegar** con la flecha del encabezado. Clic en el nombre selecciona todas sus páginas.
- **Mover una subcategoría completa** arrastrando su encabezado.
- Arrastrar una página dentro de una subcategoría la incluye; por encima de su encabezado, la saca. También "Sacar de su subcategoría" o "Desagrupar" (las páginas se quedan).
- La numeración y la exportación siguen el orden real de las páginas; todo se puede deshacer con `Cmd+Z`.
- Botón de filas: miniaturas pequeñas para ver y mover muchas páginas.

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

## Personajes

Pestaña **Personajes** del panel derecho: una ficha por personaje del proyecto.

- Nombre, rol (protagonista, rival…), color identificativo y descripción libre.
- Cuatro sets de referencias: **Cuerpo**, **Rostro**, **Ropa** y **Variantes**. Suelta imágenes en cada sección o usa "Añadir"; cada una lleva una etiqueta editable ("De frente", "Enojada"…).
- Avatar: el que elijas con la estrella o, si no, el primer rostro.
- Clic en una referencia para verla en grande (`Esc` para volver).
- Desde la lista lateral, arrastra una miniatura a una viñeta para usarla como imagen.
- Las referencias se guardan en IndexedDB aparte de la biblioteca de **Imágenes**. Al quitar una referencia o borrar un personaje, el archivo solo se elimina si ninguna viñeta lo usa.

## Empaquetar proyecto

Botón **Empaquetar** de la cabecera (Chrome, Edge o Brave; Safari no permite escribir en carpetas):

```
<Proyecto>/
├─ imagenes/            biblioteca (admite subcarpetas propias)
├─ personajes/<Nombre>/ ficha.txt + cuerpo/ rostro/ ropa/ variantes/
├─ paginas/             001_pagina.png… (opcional, PNG 2×)
├─ proyecto.koma.json   datos del proyecto + mapa de archivos
└─ LEEME.txt
```

- La primera vez eliges dónde crearla; la carpeta queda vinculada al proyecto (el navegador puede volver a pedir permiso).
- **Actualizar paquete** copia lo nuevo sin duplicar: las imágenes conservan su ruta y las que no cambian no se reescriben.
- **Importar imágenes nuevas**: deja en `imagenes/` (o en las carpetas de un personaje) lo que descargues y se importa a la biblioteca o a la ficha. Una carpeta nueva en `personajes/` con subcarpetas `cuerpo/`, `rostro/`, `ropa/` o `variantes/` crea el personaje.
- Koma nunca borra archivos de la carpeta; los que no son imágenes se ignoran.

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
