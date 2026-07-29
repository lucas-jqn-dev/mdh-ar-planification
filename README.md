# MDH AR • Planificador de Presupuestos

Aaplicación full stack (Angular + NestJS + MongoDB)
con autenticación JWT + Refresh Tokens, para el equipo MDH de Cencosud
Argentina (marca Easy). Etapa 1 entregó una pantalla de Login segura,
responsive y accesible como único punto de entrada. Etapa 2 agrega la
navegación autenticada (shell con menú lateral), Datos Maestros (ABM de
Perfiles SAP, Consultores —con Perfil SAP asociado— y de PEPs —con país y
presupuesto planificado mensual—) y la identidad visual de marca
(colores/tipografía/logo Easy Cencosud).

## Stack

- **Frontend**: Angular 21 (standalone components, Signals), Angular Material
  (tema M3 custom), SCSS, PWA-ready.
- **Backend**: NestJS 11, Mongoose (MongoDB), Passport JWT, bcrypt, Helmet,
  `@nestjs/throttler`, `nestjs-pino`, Swagger.
- **Base de datos**: MongoDB (Atlas recomendado).
- **Monorepo**: npm workspaces (`frontend/`, `backend/`).

## Requisitos

- Node.js `>= 20.11` (probado con Node 22.13). El CLI global de Angular puede
  estar desactualizado en tu máquina: este repo usa las versiones fijadas en
  cada `package.json` de cada workspace, no el `ng` global.
- npm `>= 10`.
- Un cluster de [MongoDB Atlas](https://www.mongodb.com/atlas) (o cualquier
  MongoDB accesible por URI) — no se incluye MongoDB local.

## Instalación

```bash
npm install
```

Esto instala las dependencias de `frontend/` y `backend/` en un único
`node_modules` raíz (npm workspaces).

## Variables de entorno

### Backend (`backend/.env`)

Copiar `backend/.env.example` a `backend/.env` y completar:

| Variable                  | Descripción                                                             |
| -------------------------- | ------------------------------------------------------------------------ |
| `NODE_ENV`                | `development` \| `production` \| `test`                                  |
| `PORT`                    | Puerto HTTP del backend (default `3000`)                                 |
| `MONGODB_URI`             | Connection string de MongoDB Atlas (Database → Connect → Drivers)        |
| `JWT_SECRET`               | Secreto del access token (≥32 caracteres, aleatorio)                     |
| `JWT_EXPIRATION`           | Vigencia del access token (default `15m`)                                |
| `JWT_REFRESH_SECRET`       | Secreto del refresh token, **distinto** al anterior (≥32 caracteres)     |
| `JWT_REFRESH_EXPIRATION`   | Vigencia del refresh token (default `7d`)                                |
| `CORS_ORIGIN`              | Origin permitido para CORS (default `http://localhost:4200`)             |
| `RATE_LIMIT_TTL` / `_MAX`  | Rate limiting global (ventana en segundos / máx. requests)               |
| `AUTH_RATE_LIMIT_TTL` / `_MAX` | Rate limiting específico de `/auth/login`                            |
| `AUTH_MAX_ATTEMPTS`        | Intentos fallidos antes de bloquear la cuenta                            |
| `AUTH_LOCKOUT_MINUTES`     | Minutos de bloqueo temporal tras superar `AUTH_MAX_ATTEMPTS`             |
| `SEED_ADMIN_*`             | Datos del primer usuario ADMIN, usados solo por `npm run seed:admin`     |

El repo ya trae un `backend/.env` con secretos JWT aleatorios generados y
placeholders para Atlas — solo falta pegar tu `MONGODB_URI` real. Para generar
nuevos secretos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Frontend (`frontend/src/environments/`)

`environment.development.ts` apunta a `http://localhost:3000`;
`environment.ts` (build de producción) apunta a `/api` (pensado para quedar
detrás de un proxy/reverse-proxy que enrute al backend).

## Ejecución

```bash
# Backend + frontend en paralelo
npm run dev

# O por separado
npm run dev:backend    # http://localhost:3000 (Swagger en /api/docs)
npm run dev:frontend   # http://localhost:4200
```

### Crear el primer usuario ADMIN

No existe endpoint público de registro en esta etapa. El primer usuario se
crea desde variables de entorno (`SEED_ADMIN_*` en `backend/.env`):

```bash
npm run seed:admin
```

## Scripts disponibles (raíz)

| Script                  | Descripción                                    |
| ------------------------ | ----------------------------------------------- |
| `npm run dev`            | Backend + frontend en paralelo                  |
| `npm run dev:backend`     | Solo backend (`nest start --watch`)             |
| `npm run dev:frontend`    | Solo frontend (`ng serve`)                       |
| `npm run build`          | Build de producción de ambos paquetes            |
| `npm run lint`           | ESLint en ambos paquetes                         |
| `npm run format`         | Prettier sobre todo el repo                      |
| `npm run seed:admin`      | Crea el primer usuario ADMIN                     |

## Estructura del proyecto

```
planification-mdh-team/
  backend/
    src/
      auth/            # login, refresh, logout, me, guards, estrategias JWT
      users/            # schema, service, seed de admin
      master-data/       # Datos Maestros
        perfiles-sap/      # ABM Perfiles SAP (schema, dto, service, controller)
        consultores/      # ABM Consultores (schema, dto, service, controller; ref a PerfilSap)
        peps/              # ABM PEPs (schema con presupuesto mensual, dto, service, controller)
        ocs/                # ABM OC (schema, dto, service, controller; ref a Pep y Consultor)
        shared/             # normalize-populated-ref.util.ts (reutilizado por los schemas con refs)
      common/            # filtro de excepciones estándar, decorators (@Public, @CurrentUser)
      config/            # configuración centralizada + validación de env (Joi)
      database/          # conexión Mongoose
      logger/            # nestjs-pino
      health/            # GET /health
  frontend/
    src/app/
      core/
        interceptors/    # Authorization header + refresh silencioso ante 401
        guards/           # authGuard / guestGuard
        services/         # AuthService, TokenStore (access token en memoria)
        utils/             # injectIsHandset, formatMonto (breakpoint y formato de moneda compartidos)
      auth/login/         # pantalla de Login
      shared/confirm-dialog/ # dialog de confirmación genérico (usado por Shell.logout())
      layout/shell/         # shell autenticado: sidenav + toolbar + router-outlet
      pages/
        home/                # placeholder protegido
        master-data/
          master-data.ts       # shell: acordeón con un panel por sub-módulo
          perfiles-sap/           # panel + service + dialog de Perfiles SAP
          consultores/           # panel + service + dialog de Consultores
          peps/                   # panel + service + dialog de PEPs
          ocs/                     # panel + service + dialog de OC
      models/               # User, Auth, PerfilSap, Consultor, Pep, Oc (+ enums en espejo con el backend)
  .husky/                 # git hooks (pre-commit: lint-staged, commit-msg: commitlint)
```

## Flujo de autenticación

1. El usuario ingresa credenciales en `/login` (Angular Material, validación
   reactiva, mensajes genéricos ante error).
2. `POST /auth/login` → el backend compara la contraseña con bcrypt, cuenta
   intentos fallidos (bloqueo temporal configurable) y, si es válida, firma un
   access token (JWT corto) y un refresh token (JWT largo).
3. El refresh token se guarda **hasheado** en MongoDB y se envía al cliente
   solo como cookie `HttpOnly + Secure (en prod) + SameSite=Strict`. El access
   token viaja en el body de la respuesta y se guarda **en memoria** (Angular
   Signal), nunca en `localStorage`.
4. Cada request a la API adjunta `Authorization: Bearer <accessToken>` via
   interceptor.
5. Si el access token expira (401), un interceptor intenta `POST
   /auth/refresh` una única vez (cookie HttpOnly + header CSRF de
   doble-submit) y reintenta el request original. Si el refresh falla, se
   limpia la sesión y se redirige a `/login`.
6. `POST /auth/logout` invalida el refresh token guardado en base.
7. Al recargar la página (el access token en memoria se pierde), `authGuard` /
   `guestGuard` intentan un refresh silencioso antes de decidir si mostrar
   `/login` o la ruta protegida.

Detalle completo de decisiones de seguridad (lockout, CSRF, rate limiting,
logging) en [CLAUDE.md](CLAUDE.md).

## Navegación autenticada

Tras el login, `layout/shell` provee un menú lateral con tres rutas hijas de
`''`, todas protegidas por `authGuard` en la ruta padre:

| Ruta               | Página          | Estado                          |
| ------------------- | ---------------- | -------------------------------- |
| `/home`             | Home            | Placeholder                      |
| `/master_data`      | Datos Maestros  | ABM de Perfiles SAP, Consultores, PEPs y OC implementado |
| `/order_recepcions` | Recepciones     | ABM completo implementado        |

**Sidenav en desktop: expandible/contraíble, siempre visible.** A diferencia
de mobile (donde el `mat-sidenav` es `mode="over"`, oculto por default y se
abre/cierra con el botón hamburguesa), en desktop es `mode="side"` — nunca se
oculta del todo, pero un botón en el toolbar (`Shell.toggleCollapsed()`,
signal `collapsed`) alterna su ancho entre 15rem (con ícono + label) y
4.5rem (rail de solo íconos, centrados). El label de cada item
(`matListItemTitle`) se saca del DOM con `@if (!collapsed() || isHandset())`
en vez de ocultarlo con CSS, para que no quede espacio fantasma reservado.
Ver el gotcha de icon-centering en CLAUDE.md si tocás este componente — hubo
que pisar el `flex:1` interno de `MatListItem` con `::ng-deep` para que
`justify-content: center` funcionara de verdad.

**Logout con confirmación.** El botón "Cerrar sesión" del toolbar ya no
dispara el logout directo: abre `ConfirmDialog`
(`frontend/src/app/shared/confirm-dialog/`), un componente genérico
reutilizable (`title`/`message`/`confirmText`/`cancelText` por `MAT_DIALOG_DATA`,
devuelve `boolean` por `dialogRef.close()`) con el mensaje "¿Desea cerrar
sesión y salir?". Solo si el usuario confirma, `Shell.logout()` sigue con el
flujo real (`AuthService.logout()` + redirect a `/login`). Es el primer
componente en `shared/` — esa carpeta estaba preparada pero vacía hasta
ahora; si aparece otro caso de "confirmar antes de una acción", reusar este
componente en vez de escribir un dialog ad-hoc nuevo.

## Datos Maestros

La página `/master_data` organiza sus sub-módulos en un `mat-accordion`
(`multi`, cada panel se expande/colapsa independiente), con un ícono por
panel y botones "Expandir todo" / "Colapsar todo" en el header
(`accordion.openAll()` / `.closeAll()` vía template reference `#accordion`).
Los `<mat-expansion-panel>` viven en `master-data.ts/html` (el shell); cada
sub-módulo (Perfiles SAP, Consultores, PEPs, OC) es un componente aparte que
solo aporta el *contenido* de su panel — ver el gotcha sobre esto en
CLAUDE.md, es importante si agregás un sub-módulo nuevo. Estado actual, en
orden de dependencia: **Perfiles SAP** → **Consultores** (necesita Perfiles
SAP cargados) → **PEPs** → **OC** (necesita Consultores y PEPs cargados).
Todos implementados.

Ambos sub-módulos siguen el mismo patrón CRUD (ver "Patrón de módulo Datos
Maestros" en [CLAUDE.md](CLAUDE.md)): dialog único para alta/edición/baja con
confirmación inline al eliminar, validación reactiva con botón de submit
deshabilitado mientras el form es inválido, y snackbar de feedback en cada
acción.

### Perfiles SAP

Catálogo de perfiles SAP que luego se asignan a los Consultores. Campos:
`codigoSap` (texto libre, único, ej. `8006521`), `descripcion` (texto libre,
obligatoria, ej. `SAP CONSULTOR ABAP ESP.`), `tarifaHora` (numérico ≥ 0) y
`proveedor` (mismo enum compartido con Consultores — ver abajo).

- **Backend**: `backend/src/master-data/perfiles-sap/` — `codigoSap` con
  índice único (409 `ConflictException` si se duplica), CRUD REST en
  `/master-data/perfiles-sap`.
- **Frontend**: `frontend/src/app/pages/master-data/perfiles-sap/` — listado
  responsive y `perfil-sap-form-dialog/`, mismo patrón que Consultores/PEPs.

### Consultores

Basado en la solapa "1- Consultores" del planificador Excel
(`PLanificador MDH.xlsm`). Campos: `nombre` (texto libre), `proveedor`,
`equipo` y `responsable` (selects con valores fijos, tomados de los datos
reales del Excel) y `perfilSap` (select obligatorio, referencia a un Perfil
SAP cargado previamente).

- **Backend**: `backend/src/master-data/consultores/` — enums
  `ProveedorConsultor` (compartido con Perfiles SAP), `EquipoConsultor`,
  `ResponsableConsultor` (`schemas/consultor.schema.ts`); `perfilSap` es un
  `ref` de Mongoose a `PerfilSap` (populado en `findAll`/`create`/`update`,
  con existencia validada contra la colección de perfiles antes de guardar),
  CRUD REST en `/master-data/consultores`.
- **Frontend**: `frontend/src/app/pages/master-data/consultores/` — listado
  responsive (`mat-table` en desktop, cards apiladas en mobile) y
  `consultor-form-dialog/` (carga la lista de Perfiles SAP al abrirse para
  poblar el select).

> Los Consultores creados **antes** de agregar este campo no tienen
> `perfilSap` en Mongo (no se migraron datos existentes): el backend lo
> serializa como `null` y el frontend muestra `—` en la tabla/cards para esos
> registros en vez de romper. Al editarlos, el campo pasa a ser obligatorio
> como cualquier alta nueva.

### PEPs

Basado en la solapa "2- PEPs" del Excel, simplificado para esta etapa (sin
los campos TTL IMPUTADO / TTL DISPONIBLE / fila REAL del Excel — eso queda
para cuando se integren las Recepciones/OC que alimentan lo "imputado").
Campos: `pepId` (ID del PEP, columna A del Excel, único, obligatorio),
`descripcion` (libre, opcional), `pais` (select obligatorio, enum
`Argentina` / `Colombia`) y `presupuestoMensual` (12 montos, uno por mes,
todos numéricos con default `0`). La tabla principal muestra ID PEP,
Descripción, País y **Presupuesto planificado** = suma de los 12 meses
(virtual `presupuestoTotal`, no se persiste, se recalcula siempre desde los
meses).

- **Backend**: `backend/src/master-data/peps/` — subdocumento
  `PresupuestoMensual` (12 props numéricas `min: 0`) embebido en `Pep`
  (`schemas/pep.schema.ts`), enum `PaisPep` (`Argentina` / `Colombia`),
  `presupuestoTotal` como virtual Mongoose, `pepId` con índice único (409
  `ConflictException` si se duplica), CRUD REST en `/master-data/peps`.
- **Frontend**: `frontend/src/app/pages/master-data/peps/` —
  `pep-form-dialog/` arma dinámicamente 12 `FormControl` a partir del array
  `MESES` (`models/pep.model.ts`) y muestra un total en vivo (`computed` sobre
  `valueChanges` del grupo de meses) mientras se completa el formulario. Los
  montos se formatean con `formatMonto()` (`core/utils/format.util.ts`,
  `Intl.NumberFormat('es-AR')`) tanto en el dialog como en la tabla/cards.

> Igual que con `perfilSap` en Consultores: los PEPs creados antes de agregar
> `pais` no lo tienen en Mongo, se muestra `—` en su lugar hasta que se
> editen.

### OC

Basado en la solapa "3- OC" del planificador Excel, **deliberadamente
simplificado** a pedido explícito del usuario: el Excel maneja fechas de
validez, hasta 3 PEPs por posición con porcentaje de reparto y columnas
auxiliares de VLOOKUP; acá una OC tiene un único PEP y los campos mínimos
para cargar una posición. Campos: `solped` (texto, obligatorio),
`posicion` (número, obligatorio — la posición de la OC dentro del SolPed, ej.
10/20/30), `numeroOc` (texto, **opcional** — puede no existir todavía al
cargar la posición), `pep` (select obligatorio, referencia a un PEP cargado),
`cantidadHoras` (número, obligatorio), `consultor` (select obligatorio,
referencia a un Consultor cargado) y `mesDesde`/`mesHasta` (validez de la OC,
granularidad de mes, formato `"YYYY-MM"`, ambos obligatorios). Al elegir el
Consultor, el dialog muestra —de solo lectura— su Perfil SAP, Tarifa hora,
Proveedor, Responsable y el **Total de la posición** (`tarifaHora *
cantidadHoras`, recalculado en vivo a medida que se completa el formulario).

- **Backend**: `backend/src/master-data/ocs/` — `pep` y `consultor` son
  `ref` de Mongoose (a `Pep` y `Consultor` respectivamente), poblados en
  `findAll`/`create`/`update` (`consultor` con doble-populate: también trae
  su `perfilSap`), con existencia validada contra sus colecciones antes de
  guardar (mismo criterio que `perfilSap` en Consultores). `mesDesde`/
  `mesHasta` se validan con `@Matches(MES_ANIO_REGEX)` (`/^\d{4}-(0[1-9]|1
  [0-2])$/`, exportado desde `oc.schema.ts`) tanto en el schema (Mongoose
  `match`) como en el DTO. CRUD REST en `/master-data/ocs`.
- **Frontend**: `frontend/src/app/pages/master-data/ocs/` — `oc-form-dialog/`
  carga las listas de PEPs y Consultores al abrirse; el bloque de "Datos del
  consultor" (Perfil SAP/Tarifa/Proveedor/Responsable/Total) es un
  `computed()` sobre signals derivados de `consultorId.valueChanges` y
  `cantidadHoras.valueChanges` (no sobre `FormControl.value` directo — un
  `computed()` no trackea lecturas de `.value` porque no es una signal, solo
  reacciona a signals; ver gotcha en CLAUDE.md). `mesDesde`/`mesHasta` usan
  dos `<mat-datepicker>` independientes restringidos a mes: abren en vista
  `multi-year` y se cierran apenas se elige el mes (`(monthSelected)`), sin
  pasar nunca por la vista de día — el recipe oficial de Angular Material
  para un "month picker", sin necesitar un header de calendario custom. Un
  validador a nivel de `FormGroup` bloquea el submit si "Mes hasta" es
  anterior a "Mes desde".

> **Decisión de diseño — sin snapshot**: Perfil SAP/Tarifa/Proveedor/
> Responsable de una OC se leen siempre **en vivo** desde el Consultor (y su
> Perfil SAP) referenciado, igual que `Consultor.perfilSap`. Si más adelante
> se edita la tarifa de un Perfil SAP o el proveedor de un Consultor, las OC
> ya cargadas que los referencian van a reflejar el valor nuevo, no el que
> tenían al momento de crear la OC. Es una simplificación consciente para
> esta etapa (ver CLAUDE.md); si el negocio necesita que una OC "congele" la
> tarifa vigente al momento de la carga, hay que decidirlo explícitamente y
> pasar a un modelo de snapshot.

**Presupuesto mensual de la OC.** Cada OC tiene, además, `presupuestoMensual`
— mismo shape que `Pep.presupuestoMensual` (12 montos numéricos, uno por mes,
reusado directo desde `peps/schemas/pep.schema.ts` en vez de duplicarlo), pero
acá **no se carga a mano**: el backend lo recalcula por completo en cada
`create`/`update` de la OC. El cálculo toma el **Total de la posición**
(`tarifaHora` del Perfil SAP del Consultor × `cantidadHoras`) y lo reparte en
partes iguales entre los meses del rango `mesDesde`–`mesHasta` (ambos
inclusive). Ejemplo: una OC de $1.000.000 con `mesDesde="2026-07"` y
`mesHasta="2026-09"` cubre 3 meses (julio, agosto, septiembre) → cada uno
recibe $333.333,33. El resto de los meses queda en `0`. Si el Consultor no
tiene Perfil SAP asociado (dato legacy sin `perfilSap` — ver más arriba),
`tarifaHora` no existe y todo el reparto queda en `0`, igual criterio que usa
el "Total de la posición" del frontend para mostrar `—`.

- **Backend**: `backend/src/master-data/ocs/oc-presupuesto-mensual.util.ts` —
  `calcularPresupuestoMensual(mesDesde, mesHasta, montoTotal)` itera el rango
  de meses (convirtiendo cada `"YYYY-MM"` a una cuenta absoluta de meses para
  poder recorrer el rango sin manejar `Date`) y devuelve un objeto con los 12
  meses, sumando `montoTotal / cantidadDeMeses` a cada mes del rango.
  `OcsService.create`/`update` obtienen `tarifaHora` con una consulta
  dedicada a `Consultor` (`.populate('perfilSap')`) antes de armar el
  documento a guardar — es una consulta extra respecto del simple `.exists()`
  que ya usaba `assertConsultorExists` para validar el ID, a propósito, para
  no mezclar "validar que existe" con "leer su tarifa".
  > **Sin dimensión de año**: igual que `Pep.presupuestoMensual`, el objeto
  > solo tiene 12 claves (`enero`...`diciembre`), sin distinguir a qué año
  > pertenece cada monto. Una OC cuyo rango cruza fin de año (ej.
  > `"2026-11"` a `"2027-02"`) reparte igual en noviembre/diciembre/enero/
  > febrero sin duplicar nombres, pero un rango de más de 12 meses volvería a
  > sumar sobre el mismo mes más de una vez. Limitación consciente, no un bug
  > — mismo criterio de simplicidad que el resto de Datos Maestros en esta
  > etapa.

**Tabla de OC: agrupada según el criterio de sorting activo.** El listado
desktop de OC **no** usa `<table mat-table>` (a diferencia de Perfiles SAP/
Consultores/PEPs) sino una tabla HTML nativa (`ocs-panel.html`) — porque
necesita mezclar libremente filas de "encabezado de grupo" con filas de
datos, algo que el `when` predicate de `*matRowDef` no maneja bien sin luchar
contra el type-checking estricto de los templates. El orden no se elige
clickeando columnas: hay un `mat-radio-group` arriba de la tabla ("Ordenar
por") con 5 opciones — **SolPed, Número OC, Consultor, Proveedor,
Responsable** — y la tabla (y las cards de mobile, que comparten el mismo
signal `sortedOcs`) se reordena en vivo al cambiar la selección. El agrupado
ya **no** es exclusivo de SolPed: cualquiera sea el criterio activo, la
tabla inserta una fila separadora por cada valor distinto de ese campo (ej.
"Proveedor BRIGHTSIDE", "Responsable Lucas") — el prefijo de la etiqueta sale
de `GROUP_LABELS` (`ocs-panel.ts`), un mapa `SortKey → texto`. Los empates
dentro de un mismo criterio (ej. dos OC del mismo Proveedor) se desempatan
siempre por SolPed+Posición, para que el orden no "salte" entre recargas.

**Checkbox "Solo pendientes".** Al final de la barra de sorting (`.oc-sort-bar`)
hay un `mat-checkbox` que filtra la tabla (y las cards de mobile) para
mostrar solo posiciones con `completada: false` — **marcado por defecto** al
entrar al panel (`onlyPending = signal(true)`). El filtro se aplica antes que
el sorting/agrupado (`filteredOcs` → `sortedOcs` → `displayRows`), así que
conviven sin conflicto: si se desmarca, vuelven a aparecer también las
completadas. El resumen del acordeón ("N registradas") sigue contando el
total sin filtrar — no se ve afectado por este checkbox. Hay un mensaje de
estado dedicado ("No hay OC pendientes...") para cuando el filtro deja la
lista vacía, distinto del mensaje de "Todavía no hay OC cargadas" (lista
vacía de verdad).

**Copiar una posición.** Cada fila de la tabla (y cada card en mobile) tiene,
junto al lápiz de editar, un botón "Copiar" (ícono `content_copy`) que abre
el dialog de alta con SolPed, Número OC, Consultor y meses de validez
precargados desde esa fila — Posición, PEP y Cantidad de horas quedan vacíos
a propósito, para cargar la siguiente posición del mismo SolPed sin repetir
los datos que no cambian. Es un dialog de **alta** (no edición): no tiene
botón Eliminar y al guardar crea una OC nueva, no modifica la original.
Implementado con un campo `copyFrom?: Oc | null` en `OcFormDialogData`
(`oc: null` sigue significando "no es edición"; `copyFrom` es solo una
fuente de precarga) — ver el gotcha de qué campos usan qué fuente en
CLAUDE.md antes de agregar un campo nuevo al formulario.

**Estado de la posición: Pendiente/Completada.** Cada OC tiene un campo
`completada: boolean` (default `false` = Pendiente) que **no** se pide en el
dialog de alta/edición — se togglea directo desde un `mat-slide-toggle` en
la columna "Estado" de la tabla (y en las cards de mobile). Pega contra un
endpoint dedicado, `PATCH /master-data/ocs/:id/completada` con body
`{ completada: boolean }`, en vez de reusar el `PATCH /master-data/ocs/:id`
genérico (que espera el DTO completo de create/update) — así togglear el
estado no obliga a reenviar SolPed/PEP/Consultor/meses solo para cambiar un
booleano. Si falla la request, el slide-toggle vuelve a su estado anterior
(`event.source.checked = !completada` en el `error` del subscribe) para que
la UI no quede mostrando un estado que no se guardó.

**Ajustar los enums/campos a futuro**: los enums de Consultores, Perfiles SAP,
PEPs y el array
`MESES` de PEPs se definen dos veces a propósito (backend y frontend, sin
paquete compartido en este monorepo) — ver detalle en CLAUDE.md.

## Recepciones

Página propia (`/order_recepcions`), **fuera** del acordeón de Datos
Maestros (es un registro operativo de lo ya recepcionado contra una OC
cargada, no un catálogo maestro) — mismo motivo por el que su backend vive en
`backend/src/recepciones/` en vez de bajo `master-data/`. ABM completo: cada
recepción registra `oc` (ref a una posición de OC ya cargada), `mes`
(`"YYYY-MM"`, debe caer dentro de `mesDesde`/`mesHasta` de esa OC),
`horasRecepcionadas` (número positivo) y `documento103` (texto libre, el comprobante del proceso
SAP) — los cuatro obligatorios.

- **Alta**: el botón "Nueva recepción" abre un dialog con un campo de OC tipo
  **autocomplete** (`<input matInput [matAutocomplete]>`, no un
  `<mat-select>`) — se escribe el número de OC y la lista de opciones se va
  filtrando en vivo. Solo ofrece OC **pendientes** (`!oc.completada`; carga
  `GET /master-data/ocs`, reusando `OcsService` del módulo de Datos Maestros
  — sin duplicar el fetch), salvo que se esté editando una recepción cuya OC
  ya se haya marcado como completada después de creada, en cuyo caso esa OC
  se sigue ofreciendo para no dejar el campo sin poder mostrar el valor
  actual. Cada opción — y el valor una vez elegido — se muestra como **NRO
  OC / POSICIÓN / CONSULTOR / PROVEEDOR**. Al elegir una OC, el dialog
  muestra además, de solo lectura, **OC, Posición, Consultor, Proveedor,
  Tarifa hora, Cant. de horas OC e ID PEP** (derivados del Consultor/Perfil
  SAP ya poblados, igual criterio "sin snapshot" que `oc-form-dialog`), y
  puebla un `<mat-select>` de "Mes a recepcionar" con **todos** los meses
  entre `mesDesde` y `mesHasta` de esa OC (inclusive) — ej. una OC de julio a
  septiembre ofrece Julio/Agosto/Septiembre, no solo los extremos. Por
  último, dos inputs obligatorios: horas a recepcionar y Documento 103.
- **Backend**: `backend/src/recepciones/` — `Recepcion.oc` es un `ref` a
  `Oc` (`master-data/ocs/schemas/oc.schema.ts`); `RecepcionesService`
  valida con `estaMesEnRango()` (exportada desde
  `master-data/ocs/oc-presupuesto-mensual.util.ts`, reusada de la misma
  lógica que reparte `presupuestoMensual`) que el `mes` recibido esté
  realmente dentro de la validez de la OC antes de guardar — el `<mat-select>`
  del frontend ya restringe las opciones, pero el backend no confía en eso.
  `RecepcionesModule` importa `OcsModule` (que ahora exporta `MongooseModule`,
  igual que `ConsultoresModule`/`PepsModule`) para poder inyectar el modelo
  `Oc` sin re-registrar su `forFeature()`. `findAll()` puebla `oc` con
  `pep` y `consultor.perfilSap` anidados (mismo doble-populate que
  `OcsService.findAll()`, un nivel más profundo) — el `toJSON.transform` de
  `Recepcion` normaliza `_id → id` en los tres niveles a mano (`oc`, `oc.pep`,
  `oc.consultor`, `oc.consultor.perfilSap`), reusando
  `normalizePopulatedRef()`. CRUD REST en `/recepciones` (no
  `/master-data/recepciones` — está fuera del namespace de Datos Maestros).
- **Frontend**: `frontend/src/app/pages/order-recepcions/` — listado con
  tabla desktop (`<table mat-table>`, igual patrón simple que
  Consultores/PEPs/Perfiles SAP) / cards en mobile, ambos leyendo `oc.solped`,
  `oc.posicion`, `oc.numeroOc`, `oc.consultor.nombre` y `oc.pep.pepId` con
  fallback `—` si la OC referenciada fue borrada (sin integridad
  referencial, mismo criterio que el resto del dominio). `oc.model.ts` suma
  `enumerarMeses(mesDesde, mesHasta)` — espejo en TypeScript de la función
  homónima interna de `oc-presupuesto-mensual.util.ts` en el backend, pero
  devolviendo `"YYYY-MM"` completos (no solo nombres de mes) porque acá sí
  importa distinguir el año al elegir qué mes recepcionar.

## Identidad visual

Colores y tipografía tomados del logo de Easy Cencosud
(`frontend/public/images/logo-easy.png`, muestreado por píxel):

| Token                       | Valor      | Uso                                            |
| ---------------------------- | ---------- | ------------------------------------------------ |
| `--mat-sys-primary`          | `#cc212d` (rojo) | botones primarios, toolbar, acentos       |
| `--mat-sys-tertiary`         | `#eae325` (amarillo) | reservado para acentos secundarios    |
| Tipografía de marca (`brand-family`) | Poppins | títulos/headlines                        |
| Tipografía de texto (`plain-family`) | Nunito  | cuerpo, labels, body                     |

Configurado en `frontend/src/styles.scss` (`mat.theme()` + overrides de
`--mat-sys-*`) y `frontend/src/index.html` (Google Fonts). El logo se usa en
`/login` (badge circular) y en el toolbar del shell (dentro de un chip
circular blanco — el PNG no tiene transparencia real, así que necesita un
fondo propio para verse bien sobre el toolbar rojo). Ver el gotcha de
`mat-toolbar` + M3 en CLAUDE.md antes de tocar estos estilos.

## Convenciones de desarrollo

- TypeScript estricto (`strict: true`) en ambos paquetes.
- Componentes Angular standalone, sin NgModules.
- ESLint + Prettier + Husky (`pre-commit`) + Commitlint (`commit-msg`,
  Conventional Commits) — los hooks se activan al ejecutar `npm run prepare`
  **dentro de un repositorio git inicializado** (ver nota abajo).
- Módulos backend independientes y con responsabilidad única (`auth`,
  `users`, `common`, `config`, `database`, `logger`, `health`).

## Nota sobre git / hooks

Este proyecto se generó dentro de una carpeta que todavía no es su propio
repositorio git (o vive dentro de un repo más grande compartido con otros
proyectos). Los archivos de Husky/commitlint ya están configurados, pero los
hooks no quedan activos hasta que exista un `.git` en esta carpeta (o en la
carpeta que decidas usar como raíz del repo) y corras:

```bash
git init   # si esta carpeta va a ser su propio repo
npm run prepare
```

## Pendiente

- Definir alcance de "Olvidé mi contraseña" (excluido a pedido).
- Evaluar migrar los Consultores/PEPs existentes que quedaron sin
  `perfilSap`/`pais` (creados antes de agregar esos campos) para que dejen de
  mostrar `—` en la tabla.
- OC: evaluar si conviene snapshotear Perfil SAP/Tarifa/Proveedor/Responsable
  al crear la OC en vez de leerlos siempre en vivo desde el Consultor (ver
  nota de diseño en la sección "OC" de este README).
- OC: no hay validación de que `pep`/`consultor` sigan existiendo al momento
  de borrarlos desde sus propios ABM — borrar un Consultor o PEP referenciado
  por una OC no está bloqueado, la OC queda con esa referencia en `null`
  (mismo comportamiento defensivo que ya existe para datos legacy sin
  `perfilSap`/`pais`). No se implementó integridad referencial porque
  generaría una dependencia circular de módulos (`ConsultoresModule` /
  `PepsModule` tendrían que importar `OcsModule`, que ya los importa a
  ellos) y no fue pedido explícitamente.
- OC: no se agregaron fechas de validez, reparto en hasta 3 PEPs con
  porcentaje, ni el flag "Activo p/elegir?" que sí tiene el Excel — quedó
  fuera de alcance a pedido explícito del usuario.
- PEPs: ahora que Recepciones y `Oc.presupuestoMensual` ya están cargados,
  evaluar agregar TTL IMPUTADO / TTL DISPONIBLE (hoy solo existe el
  presupuesto planificado; lo imputado/recepcionado no se refleja todavía en
  el PEP, solo se registra por separado en cada `Recepcion`).
- Recepciones: no hay validación de que la suma de horas recepcionadas para
  una OC no supere `Oc.cantidadHoras` (el total contratado) — no fue pedido
  explícitamente, y agregarlo implica decidir qué hacer con recepciones ya
  cargadas si se llegara a superar. Tampoco hay integridad referencial al
  borrar una OC que ya tiene recepciones (mismo criterio que el resto del
  dominio): la recepción queda con `oc: null` y se renderiza como `—`.
- Evaluar si el CRUD de Datos Maestros debería restringirse a rol ADMIN
  (`RolesGuard` + `@Roles()` ya están armados en el backend, solo falta
  aplicarlos si se decide restringir).
