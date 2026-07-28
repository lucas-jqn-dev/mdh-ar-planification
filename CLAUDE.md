# CLAUDE.md

Guía para Claude Code (y cualquier colaborador) al trabajar en este
repositorio. Complementa a [README.md](README.md) — el README explica cómo
correr el proyecto, este archivo explica **por qué** está armado así y qué
convenciones respetar al extenderlo.

## Qué es esto

Aplicación empresarial Angular + NestJS + MongoDB, construida en etapas
chicas y verificables.

- **Etapa 1**: Login seguro (JWT + Refresh Token, cookies HttpOnly, lockout,
  CSRF, rate limiting).
- **Etapa 2**: navegación autenticada (`layout/shell` con sidenav) + Datos
  Maestros: ABM de Consultores (solapa "1- Consultores") y de PEPs (solapa
  "2- PEPs", simplificado — ver sección de PEPs abajo) de
  `PLanificador MDH.xlsm` (Escritorio del usuario), + identidad visual de
  marca (Easy Cencosud: rojo/amarillo, Poppins/Nunito, logo real). El nombre
  de la app es **"MDH AR • Planificador"** (lo cambió el usuario editando
  `login.html`/`index.html` directamente mientras se trabajaba — mantené ese
  nombre en cualquier lugar nuevo que muestre el nombre de la app). Las
  páginas `Home` y `Recepciones`, y el panel "OCs" de Datos Maestros, siguen
  siendo placeholders a propósito — no están "a medio hacer", es el alcance
  pedido hasta ahora.

## Decisiones de arquitectura (y por qué)

- **Monorepo con npm workspaces** (`frontend/`, `backend/`), sin Nx/Turborepo.
  Es un repo chico con dos paquetes; una herramienta de monorepo dedicada
  sería sobre-ingeniería en esta etapa. `npm install` en la raíz hoistea todo
  a un único `node_modules/` — **no correr `npm install` dentro de
  `backend/` o `frontend/` por separado** salvo que quieras agregar una
  dependencia puntual a ese workspace (`npm install <pkg> --workspace
  backend`).
- **MongoDB Atlas, no Docker Compose.** Decisión explícita del usuario. No
  agregar un `docker-compose.yml` para Mongo sin que lo pidan.
- **Sin "Olvidé mi contraseña" todavía.** Excluido a pedido explícito en esta
  etapa. Si se agrega después, definir primero proveedor de email (SMTP
  propio / SendGrid / Resend) antes de implementar.
- **Angular CLI/Material fijados en v21, no v22.** `@angular/cli@22.x`
  requiere Node `>=22.22.3`; la máquina de desarrollo tiene Node `22.13.0`.
  Si en el futuro se actualiza Node, se puede migrar a Angular 22+ sin
  problema (`ng update`), pero no asumas que el `ng` global de la máquina
  sirve — usá siempre los binarios del workspace (`npm run` o `npx ng` parado
  en `frontend/`).
- **Standalone components, sin NgModules.** No agregar `NgModule`s nuevos.
- **Access token en memoria (Signal), refresh token en cookie HttpOnly.**
  Nunca guardar ningún token en `localStorage`/`sessionStorage` — es la
  superficie de ataque XSS que este diseño evita a propósito.
- **CSRF de doble-submit** (`XSRF-TOKEN` cookie no-HttpOnly + header
  `X-XSRF-TOKEN`) solo en `/auth/refresh` y `/auth/logout`, porque son los
  únicos endpoints que dependen de una cookie para autenticar (el resto usa
  `Authorization: Bearer`, que no es vulnerable a CSRF).
- **Guard global `JwtAuthGuard` + `@Public()`**: por defecto **toda** ruta
  nueva del backend requiere JWT válido. Si un endpoint debe ser público,
  marcarlo explícitamente con `@Public()` — no lo dejes desprotegido "porque
  sí".
- **`RolesGuard` + `@Roles()` ya están armados** para ADMIN/USER/SUPER_ADMIN
  aunque hoy solo se usa ADMIN (el seed). Al agregar features con permisos,
  usar `@Roles(UserRole.ADMIN)` en vez de chequear el rol a mano en el
  controller.
- **Enums de Datos Maestros (Proveedor/Equipo/Responsable, etc.) se definen
  dos veces a propósito**: en el schema del backend y en el modelo del
  frontend (`frontend/src/app/models/*.model.ts`). No hay paquete compartido
  entre `frontend`/`backend` en este monorepo — es deuda técnica aceptada
  conscientemente por simplicidad, no un olvido. Al agregar o editar un
  valor, tocar **ambos** archivos en el mismo cambio.
- **Patrón de módulo Datos Maestros** (ver `master-data/consultores/` y
  `master-data/peps/` como referencia para OC): schema con `toJSON.transform`
  que renombra `_id → id` y quita `__v` (así el frontend consume `id` directo,
  igual que `AuthService.sanitize()` hace a mano para `User`); un único DTO
  reusado para create y update (PATCH espera el objeto completo, no parcial);
  un único dialog Angular Material para alta/edición/baja con un signal
  `confirmingDelete` que reemplaza el footer normal por una confirmación
  inline en vez de abrir un segundo modal.
- **PEPs guarda el presupuesto mensual como subdocumento embebido**
  (`PresupuestoMensual`, `@Schema({ _id: false })`) con 12 props numéricas
  fijas (`enero`...`diciembre`), no un array — así el documento en Mongo es
  auto-descriptivo. El total (`presupuestoTotal`) es un **virtual** de
  Mongoose (`PepSchema.virtual(...).get(...)`), nunca se persiste, para que no
  pueda desincronizarse de la suma real de los meses. Si se agrega un campo
  calculado similar en OC, seguir el mismo patrón (virtual, no campo
  guardado).
- **`pages/master-data` es un shell delgado, PERO los `<mat-expansion-panel>`
  viven en `master-data.html`, no en los componentes hijos.** Cada sub-módulo
  (`ConsultoresPanel`, `PepsPanel`) es un componente aparte que renderiza
  *solo el contenido interno* del panel (toolbar + tabla/cards, sin wrapper);
  `master-data.html` arma `<mat-accordion #accordion="matAccordion" multi>`
  con un `<mat-expansion-panel>` por sub-módulo, poniendo el ícono/título
  ahí y `<app-consultores-panel />` / `<app-peps-panel />` como contenido.
  Para la descripción del header ("N registrados") cada panel expone un
  `computed() summary()` público, leído desde el shell vía
  `viewChild(ConsultoresPanel)` (`readonly consultoresPanel =
  viewChild(ConsultoresPanel)`, template: `{{ consultoresPanel()?.summary()
  }}`).

  **Por qué no al revés** (cada componente con su propio
  `<mat-expansion-panel>` interno, como se hizo en un primer intento): se ve
  bien visualmente, pero `MatAccordion` descubre sus paneles vía
  `@ContentChildren`, que solo ve **content-children del template donde se
  autoró `<mat-accordion>`** — un `<mat-expansion-panel>` dentro del
  template de OTRO componente nunca se registra, aunque termine en el mismo
  DOM renderizado. Con ese patrón `accordion.openAll()`/`closeAll()` no
  hacían nada y cada panel actuaba como un acordeón de un solo panel sin
  coordinación con los demás (parecía "andar" en modo `multi` porque, sin
  accordion real, cada panel simplemente abre/cierra de forma independiente
  por defecto). Al agregar OC, seguir el patrón actual: contenido puro en
  `oc-panel.ts`, `<mat-expansion-panel>` en `master-data.html`.
- **`mat-toolbar[color="primary"]` no pinta nada en Material 3.** Los tokens
  M3 de `mat-toolbar` (`toolbar-container-background-color`) están fijados a
  `surface`/`on-surface` sin variante de color — es diseño intencional de
  M3 (top app bars neutros), no un bug. Para un toolbar de marca, pisar
  `background-color`/`color` a mano en el `.scss` del componente con
  `var(--mat-sys-primary)`/`var(--mat-sys-on-primary)` (ver
  `layout/shell/shell.scss`). Los botones (`mat-flat-button
  color="primary"`) sí toman el color del tema correctamente — el problema es
  específico de `mat-toolbar`.
- **Layout con guard en la ruta padre, no en cada hija**: `authGuard` se
  aplica una sola vez en la ruta `''` que carga `Shell`; `home`,
  `master_data`, `order_recepcions` son hijas sin guard propio. No dupliques
  `canActivate` en las rutas hijas.
- **Responsive de listados**: `injectIsHandset()` (en
  `frontend/src/app/core/utils/breakpoint.util.ts`) es la forma estándar de
  alternar tabla (desktop) vs. cards apiladas (mobile) — reusarlo en vez de
  volver a instanciar `BreakpointObserver` a mano.

## Gotchas ya resueltos (no los reintroduzcas)

- `@nestjs/throttler` v6 usa `ttl` en **milisegundos** en `ThrottlerModule` y
  en `@Throttle({ default: { limit, ttl } })` — no segundos como en v4/v5.
- El tsconfig de Nest tiene `isolatedModules: true`, así que cualquier tipo
  usado *solo* en la firma de un parámetro decorado (`@Body() dto: X`,
  `@Req() req: Request`) debe importarse con `import type { ... }` o falla el
  build (`TS1272`).
- `Request.cookies` (de `@types/cookie-parser`) está tipado como `any` —
  castealo a `string | undefined` al leerlo (ver `csrf.guard.ts`,
  `jwt-refresh.strategy.ts`) para no romper `@typescript-eslint/no-unsafe-*`.
- Comparar un `HttpStatus`/`ConnectionStates` (enums numéricos de Nest y
  Mongoose respectivamente) contra un literal numérico dispara
  `no-unsafe-enum-comparison`. Forzar el tipo a `number` explícitamente antes
  de comparar.
- `JwtService.signAsync(payload, { expiresIn })` espera `expiresIn` tipado
  como `StringValue | number`, no `string` genérico — castear con `as
  JwtSignOptions['expiresIn']` si el valor viene de `ConfigService`.
- Angular Material 21 con `provideAnimationsAsync()` requiere
  `@angular/animations` como dependencia explícita (no se agrega solo con `ng
  add @angular/material`).
- **Al testear en el Browser pane**: el tool `resize_window` cambia el
  viewport pero no siempre dispara los listeners `change` de
  `matchMedia`/`BreakpointObserver` de Angular CDK (parece una limitación del
  override de viewport vía CDP, no un bug de la app). Si necesitás verificar
  un breakpoint responsive, navegá/recargá la página **después** de
  redimensionar, no antes — así el componente evalúa `isHandset()` ya en el
  viewport correcto desde el arranque.
- Un botón con `[disabled]="form.invalid || saving()"` (patrón usado en Login
  y en los dialogs) nunca dispara su `(click)` mientras el form es inválido —
  ni con click real ni con `.click()` por JS, es comportamiento estándar del
  DOM. Para ver los mensajes de "campo obligatorio" en un form vacío hay que
  tocar/blurear cada campo (o completarlo y volver a vaciarlo), no clickear el
  botón deshabilitado esperando que dispare la validación.
- **Si el `ng serve` del Browser pane queda "pegado"** sirviendo contenido
  viejo después de mover/borrar/renombrar varios archivos a la vez (Vite HMR a
  veces no se recupera bien de reestructuraciones grandes) — señal: el
  viewport reportado por `read_page` queda en `0x0` y el contenido no cambia
  ni con reload forzado. Solución: matar el proceso de Node en el puerto 4200
  (`netstat -ano | grep :4200` → `taskkill //F //PID <pid>`) y volver a
  levantarlo con `preview_start`. No es un bug de la app, es el dev server.
- El click sintético del tool `computer` (`left_click`/`double_click`) a veces
  no dispara el handler `(click)` de un botón de Angular Material aunque las
  coordenadas caigan dentro de su `getBoundingClientRect()` — pasó tanto en
  viewport mobile como desktop en esta sesión. `.click()` nativo vía
  `javascript_tool` sí funciona siempre. Si un click con `computer` no parece
  tener efecto, no asumas que el botón está roto: confirmá con
  `element.click()` por JS antes de reportar un bug.
- **Al verificar animaciones/transiciones de Angular Material por JS** (p.ej.
  clases `mat-expanded` de `mat-expansion-panel` tras `openAll()`/un click):
  chequear el estado del DOM **inmediatamente** después de `.click()` en el
  mismo script da falsos negativos — Angular necesita uno o más ticks para
  correr change detection y aplicar la clase. Esperar con `await new
  Promise(r => setTimeout(r, 300))` antes de leer el DOM. Esto generó una
  falsa alarma en esta sesión (parecía que `accordion.openAll()` no hacía
  nada; en realidad sí funcionaba, solo que se leía el DOM demasiado rápido).
- **Un `navigate` con `force: true` (o cualquier full page reload) pierde la
  sesión** aunque el usuario siga "logueado": el access token vive solo en
  memoria (Signal), se pierde en cualquier recarga dura. El `authGuard`
  debería recuperar sesión vía refresh silencioso (cookie), pero en la
  práctica de testing es más simple click-ear los `<a routerLink>` del nav
  (navegación client-side de Angular, no recarga) para mantener la sesión
  entre pasos de un mismo flujo de prueba.

## Seguridad — qué NO tocar sin pensar dos veces

- No bajar `bcrypt` de 12 rounds.
- No devolver mensajes distintos para "usuario no existe" vs "password
  incorrecta" en `/auth/login` — siempre el mismo genérico. El único mensaje
  distinto permitido es el de cuenta bloqueada (`lockUntil`), que es una
  concesión de UX aceptada conscientemente.
- No loguear passwords ni tokens en texto plano — `nestjs-pino` ya tiene
  `redact` configurado para `authorization`, `cookie`, `body.password`; si
  agregás un campo sensible nuevo, sumalo al `redact.paths` en
  `backend/src/logger/logger.module.ts`.
- No exponer Swagger (`/api/docs`) en `NODE_ENV=production`.
- El refresh token nunca se guarda en texto plano en Mongo, solo su hash
  bcrypt (`refreshTokenHash`, con `select: false` por defecto en el schema).

## Identidad de marca

- Colores/tipografía tomados de `frontend/public/images/logo-easy.png`
  (rojo `#cc212d`, amarillo `#eae325`) — ver "Identidad visual" en README.md
  para el detalle de tokens y dónde están configurados.
- **El PNG del logo no tiene transparencia real** (se aplanó a fondo blanco
  sólido en algún punto antes de llegar al Desktop del usuario — el alpha
  channel del archivo es 100% opaco de punta a punta). Por eso en el toolbar
  se envuelve en `.shell-logo-badge` (chip circular blanco con `overflow:
  hidden` + `object-fit: cover`) en vez de ponerlo directo sobre el fondo
  rojo — si se reemplaza el archivo por una versión con transparencia real,
  ese wrapper se puede simplificar o quitar.
- Si se necesita el logo en más lugares (favicon ya usa
  `images/logo-easy.png` directo, funciona porque el fondo del navegador ahí
  es blanco/neutro), replicar el patrón del chip circular en vez de poner el
  `<img>` suelto sobre cualquier fondo no-blanco.

## Pendiente / roadmap conocido

- Login, refresh, logout, lockout, y el ABM completo de Consultores y de PEPs
  (crear, editar, eliminar, validación de duplicados, total en vivo, vista
  mobile en cards) ya se verificaron en el navegador contra el MongoDB Atlas
  real del usuario (`mdh-planification` cluster). El toggle expandir/colapsar
  todo del acordeón de Datos Maestros también se verificó (con el fix de
  arquitectura de `MatAccordion` descripto arriba).
- Activar los git hooks: esta carpeta no es su propio repo git (vive dentro
  de un repo compartido en `mexs.cencosud.ar` junto a otros proyectos SAP no
  relacionados). No se corrió `git init` acá para no asumir esa decisión por
  el usuario — definir si este proyecto va a tener su propio repo o se integra
  al existente antes de correr `npm run prepare`.
- "Olvidé mi contraseña": explícitamente fuera de alcance.
- Datos Maestros: falta el sub-módulo de OC (solapa "3- OC" de
  `PLanificador MDH.xlsm`), siguiendo el mismo patrón que Consultores/PEPs.
- PEPs quedó deliberadamente simplificado respecto al Excel: no tiene
  TTL IMPUTADO / TTL DISPONIBLE ni la fila REAL (eso depende de datos que
  todavía no existen en la app — Recepciones/OC). Revisar si conviene
  agregarlos cuando se implemente ese flujo.
- Página "Recepciones" (`/order_recepcions`): placeholder en blanco, sin
  analizar todavía la solapa "( Recepciones )" del Excel.
- Tests: la estructura está preparada (Jest en backend, Vitest en frontend
  vía Angular CLI 21) pero no hay tests escritos todavía.
