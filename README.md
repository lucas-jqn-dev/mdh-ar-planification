# planification-mdh-team

**MDH AR • Planificador** — aplicación full stack (Angular + NestJS + MongoDB)
con autenticación JWT + Refresh Tokens, para el equipo MDH de Cencosud
Argentina (marca Easy). Etapa 1 entregó una pantalla de Login segura,
responsive y accesible como único punto de entrada. Etapa 2 agrega la
navegación autenticada (shell con menú lateral), Datos Maestros (ABM de
Consultores y de PEPs con presupuesto planificado mensual) y la identidad
visual de marca (colores/tipografía/logo Easy Cencosud).

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
        consultores/      # ABM Consultores (schema, dto, service, controller)
        peps/              # ABM PEPs (schema con presupuesto mensual, dto, service, controller)
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
      layout/shell/         # shell autenticado: sidenav + toolbar + router-outlet
      pages/
        home/                # placeholder protegido
        master-data/
          master-data.ts       # shell: acordeón con un panel por sub-módulo
          consultores/           # panel + service + dialog de Consultores
          peps/                   # panel + service + dialog de PEPs
      models/               # User, Auth, Consultor, Pep (+ enums en espejo con el backend)
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

Tras el login, `layout/shell` provee un menú lateral (persistente en desktop,
colapsable en mobile) con tres rutas hijas de `''`, todas protegidas por
`authGuard` en la ruta padre:

| Ruta               | Página          | Estado                          |
| ------------------- | ---------------- | -------------------------------- |
| `/home`             | Home            | Placeholder                      |
| `/master_data`      | Datos Maestros  | ABM de Consultores implementado  |
| `/order_recepcions` | Recepciones     | Placeholder                      |

## Datos Maestros

La página `/master_data` organiza sus sub-módulos en un `mat-accordion`
(`multi`, cada panel se expande/colapsa independiente), con un ícono por
panel y botones "Expandir todo" / "Colapsar todo" en el header
(`accordion.openAll()` / `.closeAll()` vía template reference `#accordion`).
Los `<mat-expansion-panel>` viven en `master-data.ts/html` (el shell); cada
sub-módulo (Consultores, PEPs) es un componente aparte que solo aporta el
*contenido* de su panel — ver el gotcha sobre esto en CLAUDE.md, es
importante si agregás un sub-módulo nuevo. Estado actual: **Consultores**
(implementado, expandido por defecto), **PEPs** (implementado, colapsado) y
**OCs** (placeholder "Todavía no implementado.", a la espera de analizar esa
solapa del Excel).

Ambos sub-módulos siguen el mismo patrón CRUD (ver "Patrón de módulo Datos
Maestros" en [CLAUDE.md](CLAUDE.md)): dialog único para alta/edición/baja con
confirmación inline al eliminar, validación reactiva con botón de submit
deshabilitado mientras el form es inválido, y snackbar de feedback en cada
acción.

### Consultores

Basado en la solapa "1- Consultores" del planificador Excel
(`PLanificador MDH.xlsm`). Campos: `nombre` (texto libre), `proveedor`,
`equipo` y `responsable` (selects con valores fijos, tomados de los datos
reales del Excel).

- **Backend**: `backend/src/master-data/consultores/` — enums
  `ProveedorConsultor`, `EquipoConsultor`, `ResponsableConsultor`
  (`schemas/consultor.schema.ts`), CRUD REST en `/master-data/consultores`.
- **Frontend**: `frontend/src/app/pages/master-data/consultores/` — listado
  responsive (`mat-table` en desktop, cards apiladas en mobile) y
  `consultor-form-dialog/`.

### PEPs

Basado en la solapa "2- PEPs" del Excel, simplificado para esta etapa (sin
los campos TTL IMPUTADO / TTL DISPONIBLE / fila REAL del Excel — eso queda
para cuando se integren las Recepciones/OC que alimentan lo "imputado").
Campos: `pepId` (ID del PEP, columna A del Excel, único, obligatorio),
`descripcion` (libre, opcional) y `presupuestoMensual` (12 montos, uno por
mes, todos numéricos con default `0`). La tabla principal muestra ID PEP,
Descripción y **Presupuesto planificado** = suma de los 12 meses (virtual
`presupuestoTotal`, no se persiste, se recalcula siempre desde los meses).

- **Backend**: `backend/src/master-data/peps/` — subdocumento
  `PresupuestoMensual` (12 props numéricas `min: 0`) embebido en `Pep`
  (`schemas/pep.schema.ts`), `presupuestoTotal` como virtual Mongoose, `pepId`
  con índice único (409 `ConflictException` si se duplica), CRUD REST en
  `/master-data/peps`.
- **Frontend**: `frontend/src/app/pages/master-data/peps/` —
  `pep-form-dialog/` arma dinámicamente 12 `FormControl` a partir del array
  `MESES` (`models/pep.model.ts`) y muestra un total en vivo (`computed` sobre
  `valueChanges` del grupo de meses) mientras se completa el formulario. Los
  montos se formatean con `formatMonto()` (`core/utils/format.util.ts`,
  `Intl.NumberFormat('es-AR')`) tanto en el dialog como en la tabla/cards.

**Ajustar los enums/campos a futuro**: los enums de Consultores y el array
`MESES` de PEPs se definen dos veces a propósito (backend y frontend, sin
paquete compartido en este monorepo) — ver detalle en CLAUDE.md.

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
- Datos Maestros: agregar el sub-módulo de OC (solapa "3- OC" del Excel),
  siguiendo el mismo patrón que Consultores/PEPs.
- PEPs: cuando se integren Recepciones/OC, evaluar agregar TTL IMPUTADO / TTL
  DISPONIBLE (hoy solo existe el presupuesto planificado).
- Página "Recepciones" (`/order_recepcions`): todavía es un placeholder en
  blanco.
- Evaluar si el CRUD de Datos Maestros debería restringirse a rol ADMIN
  (`RolesGuard` + `@Roles()` ya están armados en el backend, solo falta
  aplicarlos si se decide restringir).
