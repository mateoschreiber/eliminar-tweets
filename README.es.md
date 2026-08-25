# X Post Cleaner

Un Snippet gratuito, local y sin dependencias para DevTools que revisa y elimina tus propios posts y respuestas de X según un umbral configurable de Likes.

> El borrado es irreversible. La configuración inicial es `DRY_RUN: true`: primero ejecuta una simulación, revisa la consola y recién después considera el borrado real.

[English](README.md) · [Solución de problemas](docs/TROUBLESHOOTING.md) · [Arquitectura](docs/ARCHITECTURE.md)

## Qué hace

En la cronología de **Posts** o **Respuestas** de tu cuenta, el snippet examina publicaciones de la cuenta seleccionada desde la más reciente hacia la más antigua. Con el umbral predeterminado de 20, conserva las que tienen **20 o más** Likes y marca como candidatas a borrar las que tienen **0–19**. De forma predeterminada procesa sólo las **20 candidatas elegibles más recientes**. En modo simulación sólo registra la decisión; en modo real borra candidatas una por una mediante la interfaz de X.

No borra ni deshace reposts de otras personas. Omite recuentos de Likes desconocidos y rechaza URLs de estado ambiguas o controles pertenecientes a posts citados anidados.

## Privacidad y diseño

- No usa API de X, claves API, OAuth, contraseña, copia de cookies, token de acceso, extensión, servidor ni servicio externo.
- No incluye telemetría, analítica, comprobación de actualizaciones ni llamadas de red a terceros.
- Todo se procesa en la pestaña abierta de `x.com`, dentro de tu sesión existente. El script no solicita ni guarda credenciales.
- Cada acción exige una URL canónica propia `/{handle}/status/{id}`. Las eliminaciones son secuenciales y se verifican en el DOM.

## Instalar y ejecutar en Chrome / Chromium

1. Abre `https://x.com/tu_handle` para Posts o `https://x.com/tu_handle/with_replies` para Respuestas.
2. Abre DevTools (`F12`), entra en **Sources** y después en **Snippets**.
3. Crea un snippet nuevo.
4. Copia el contenido completo de [`dist/x-post-cleaner.js`](dist/x-post-cleaner.js).
5. Revisa el bloque `CONFIG` al inicio y conserva `DRY_RUN: true` en la primera ejecución.
6. Ejecuta el snippet (clic derecho **Run**, o `Ctrl`/`Cmd` + `Enter`) y lee la consola.

DevTools debe permanecer abierto. Recargar o cerrar la pestaña detiene el script.

## Configuración

```js
const CONFIG = {
  HANDLE: '',
  MAX_POSTS_TO_DELETE: 20,
  MIN_LIKES_TO_KEEP: 20,
  DRY_RUN: true,
  SPEED_MODE: 'fast',
  MAX_EMPTY_SCROLLS: 20,
  PERSIST_PROGRESS: false,
  LOG_LEVEL: 'normal',
};
```

`HANDLE` es opcional y no lleva `@`. Si está vacío, la detección sólo funciona en una URL de perfil inequívoca como `/tu_handle` o `/tu_handle/with_replies`; si no, el script se detiene en vez de adivinar. `MIN_LIKES_TO_KEEP: 20` significa que 0–19 son candidatos y 20+ se conservan. Debe ser un entero no negativo.

`MAX_POSTS_TO_DELETE` es el máximo de posts elegibles más recientes que se procesarán y acepta de 1 a 1000. Su valor predeterminado de 20 hace que el limpiador se detenga tras encontrar 20 candidatos que cumplen la regla de Likes; no continúa con candidatos más antiguos. `DRY_RUN` impide todos los clics de borrado. Cambia a `false` sólo después de revisar una simulación; el navegador mostrará una confirmación final por acción irreversible. `SPEED_MODE` puede ser `safe`, `fast` (predeterminado) o `turbo`; todos conservan las mismas validaciones de seguridad y sólo cambian esperas y desplazamiento de respaldo. `MAX_EMPTY_SCROLLS` limita ciclos consecutivos sin posts propios nuevos. `PERSIST_PROGRESS` guarda únicamente IDs procesados en el almacenamiento local de este navegador. `LOG_LEVEL` puede ser `minimal`, `normal` o `verbose`.

## Simulación y borrado real

Ejecuta primero con `DRY_RUN: true`. La consola mostrará, por ejemplo:

```text
[KEEP] ❤️ 42 | https://x.com/user/status/…
[DRY RUN] DELETE ❤️ 7 | https://x.com/user/status/…
[SKIPPED] Unable to determine Like count | https://x.com/user/status/…
```

Verifica cuenta, URLs y candidatos. Para borrar realmente, cambia sólo `DRY_RUN` a `false`, vuelve a ejecutar y acepta la confirmación del navegador. El limpiador abre el menú de X, selecciona Delete/Borrar/Eliminar, espera la hoja de confirmación, confirma y verifica que el post desapareció antes de continuar. Un fallo queda registrado y no se reintenta a ciegas.

## Detener

Ejecuta `stopXCleaner()` en la consola. Escape solicita detener cuando no hay un diálogo abierto. El paso seguro actual puede terminar antes de que finalice el ciclo. `window.__xPostCleanerState` ofrece visibilidad de depuración del estado y contadores.

## Limitaciones y solución de problemas

X controla dinámicamente qué contenido histórico renderiza; la herramienta sólo puede procesar lo que X cargue durante el desplazamiento. X puede cambiar data-test IDs, menús, diálogos, textos traducidos o la cronología, por lo que podrían requerirse actualizaciones de selectores. No puede garantizar descubrir contenido que X no cargue. Consulta [Solución de problemas](docs/TROUBLESHOOTING.md) para detección de perfil, recuentos desconocidos y detención.

Antes de usar modo real, comprueba Posts y Respuestas con límites conocidos de 19/20 Likes, posts citados, reposts de otras cuentas y `stopXCleaner()`. Prueba el borrado verdadero inicialmente sólo con un post desechable y de bajo valor.

## Desarrollo

No hay paso de compilación ni dependencias de ejecución; `src/` y `dist/` son idénticos deliberadamente. Ejecuta las comprobaciones sin dependencias:

```sh
node tests/run-tests.js
```

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para contribuciones, selectores, idiomas y pruebas. Los problemas de seguridad o privacidad deben reportarse de forma privada según [SECURITY.md](SECURITY.md).

## Licencia

Distribuido bajo la [licencia MIT](LICENSE).
