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
  Maestros: ABM de Perfiles SAP (catálogo interno, no viene de una solapa del
  Excel), de Consultores (solapa "1- Consultores", con Perfil SAP asociado
  obligatorio), de PEPs (solapa "2- PEPs", simplificado — ver sección de
  PEPs abajo — con campo País agregado) y de OC (solapa "3- OC",
  significativamente simplificado — ver sección de OC abajo) de
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
- **`ProveedorConsultor` es un único enum compartido entre Consultor y
  PerfilSap** (no hay un enum "Proveedor" separado por entidad): un Perfil
  SAP y un Consultor son provistos por el mismo universo de proveedores
  (ADVANCED, BRIGHTSIDE, FRICE, MAGNO, NEORIS, RRHH Y SOL. TEC), así que
  `perfil-sap.schema.ts` importa el enum directo de
  `consultores/schemas/consultor.schema.ts` en vez de duplicarlo. Si agregás
  un proveedor nuevo, tocalo una sola vez ahí (y su espejo en
  `frontend/src/app/models/consultor.model.ts`, que `perfil-sap.model.ts`
  también reimporta).
- **`Consultor.perfilSap` es un `ref` de Mongoose a `PerfilSap`, no un dato
  embebido/desnormalizado.** `ConsultoresService.findAll()` usa
  `.populate('perfilSap')` para siempre traer el perfil completo actualizado
  (código, descripción, tarifa) sin duplicar esos datos en cada Consultor. El
  `toJSON.transform` de `consultor.schema.ts` tiene que renombrar `_id → id`
  **dos veces**: una para el propio Consultor y otra, a mano, para el
  subdocumento `perfilSap` ya populado (Mongoose no aplica el `toJSON`
  transform del schema referenciado automáticamente sobre un path populado).
  `ConsultoresModule` importa `PerfilesSapModule` (que exporta
  `MongooseModule`) en vez de registrar el schema de `PerfilSap` por su
  cuenta, para no duplicar el `forFeature()`.
- **Al hacer `create`/`update` de un Consultor, el backend valida que el
  `perfilSapId` recibido exista de verdad** (`Types.ObjectId.isValid` +
  `perfilSapModel.exists()`) antes de guardar, devolviendo 404 genérico
  "Perfil SAP no encontrado" si no — mismo criterio que usa PEPs para
  validar `pepId` duplicado, pero acá es una FK, no una unicidad.
- **Los Consultores/PEPs que ya existían en Mongo antes de agregar
  `perfilSap`/`pais` (esta misma etapa) no tienen esos campos** — no se negoció
  ni corrió ninguna migración de datos. El backend los serializa tal cual
  (`perfilSap: null`, `pais` ausente/`undefined`); el frontend nunca asume que
  están presentes: `Consultor.perfilSap` está tipado `PerfilSap | null` (no
  solo `PerfilSap`) y las tablas/cards muestran `—` cuando falta, replicando
  el patrón que ya existía para `pep.descripcion || '—'`. Si alguna vez se
  migra ese dato viejo, se puede volver a tipar como no-nulo.
- **`Oc` (solapa "3- OC") es la simplificación más agresiva de las cuatro
  entidades de Datos Maestros**, a pedido explícito del usuario: el Excel real
  tiene hasta 3 PEPs por posición con reparto porcentual y una columna
  auxiliar `Activo p/elegir?` que alimenta un dropdown de "Recurso"
  concatenado (Proveedor - Nombre - Equipo). Nada de eso está en `Oc` — solo
  `solped`, `posicion`, `numeroOc` (único campo opcional), `pep` (ref, un
  solo PEP), `consultor` (ref) y `mesDesde`/`mesHasta` (validez, agregado en
  un pedido posterior, pero con granularidad de **mes** — el Excel real
  guarda `F. Desde`/`F. Hasta` con día completo). Revisar la solapa "3- OC"
  del Excel real antes de agregar campos nuevos acá, no asumir la estructura
  desde el nombre de las columnas.
- **`mesDesde`/`mesHasta` se guardan como string `"YYYY-MM"`, no `Date`** —
  decisión deliberada para no arrastrar bugs de timezone (un `Date` a
  medianoche UTC del día 1 puede mostrarse como el mes anterior en un
  `toLocaleDateString()` corrido en un huso horario negativo). El regex
  `MES_ANIO_REGEX` vive en `oc.schema.ts` y se reexporta al DTO para no
  duplicarlo. El frontend sí usa `Date` para el `FormControl` del datepicker
  (`oc-form-dialog.ts`), pero convierte a/desde `"YYYY-MM"` en los bordes:
  `parseMesAnio`/`formatDateAsMesAnio`/`formatMesAnio` en `oc.model.ts` — el
  dominio (modelo, payload, backend) nunca ve un `Date`, solo el widget de UI.
- **Datepicker de "solo mes" sin custom header**: Angular Material expone
  `(yearSelected)`/`(monthSelected)` directo en `<mat-datepicker>` (no hace
  falta el custom-header component que sugieren algunos tutoriales viejos).
  El recipe usado en `oc-form-dialog.html`: `startView="multi-year"` +
  `(monthSelected)="chosenMonthHandlerDesde($event, picker)"` donde el
  handler llama `picker.close()` inmediatamente — como el picker se cierra
  ni bien se elige el mes, la vista de día nunca llega a renderizarse, sin
  necesidad de ocultarla por CSS. Ojo con el valor del atributo: es
  `startView="multi-year"` (con guion), **no** `"multiyear"` — este último
  compila pero tira `TS2820` en build (no en el editor, en el build real).
  Requiere `provideNativeDateAdapter()` en el array `providers` del
  `@Component` (o global en `app.config.ts` si más componentes lo llegan a
  necesitar; hoy solo lo usa `OcFormDialog`, así que quedó scoped ahí).
- **`Oc.pep` y `Oc.consultor` son refs de Mongoose, con el mismo patrón
  ref-vivo (no snapshot) que `Consultor.perfilSap`**: `OcsService.findAll()`
  hace `.populate('pep')` + `.populate({ path: 'consultor', populate: {
  path: 'perfilSap' } })` (doble populate, porque Perfil SAP/Tarifa/
  Proveedor/Responsable de una OC se leen siempre desde el Consultor
  poblado, nunca se guardan en el documento `Oc`). Esto significa que si
  después se edita la tarifa de un Perfil SAP, las OC ya cargadas que
  apuntan a un Consultor con ese perfil van a mostrar la tarifa **nueva**,
  no la vigente al momento de crear la OC — es una decisión consciente de
  simplicidad para esta etapa, no un bug. Si el negocio pide que la OC
  "congele" esos valores, hay que migrar a un modelo de snapshot (copiar los
  valores al crear la OC en vez de poblar en cada lectura).
- **`Oc.presupuestoMensual` reusa el mismo shape que `Pep.presupuestoMensual`**
  (`PresupuestoMensual`/`PresupuestoMensualSchema`, importados directo desde
  `peps/schemas/pep.schema.ts` en vez de duplicarlos — mismo criterio que
  `ProveedorConsultor` compartido entre Consultor y PerfilSap) pero, a
  diferencia de Pep, **nunca se carga a mano**: `OcsService.create`/`update`
  lo recalculan por completo en cada guardado vía
  `calcularPresupuestoMensual()` (`ocs/oc-presupuesto-mensual.util.ts`), que
  reparte `tarifaHora × cantidadHoras` en partes iguales entre los meses del
  rango `mesDesde`–`mesHasta` (inclusive), dejando `0` en el resto. Para leer
  `tarifaHora` hay una consulta separada a `Consultor` con
  `.populate('perfilSap')` (`OcsService.getTarifaHora()`) — a propósito
  distinta de la que ya hace `assertConsultorExists()` con `.exists()` (esa
  solo valida que el ID exista, no trae el documento). Si el Consultor no
  tiene `perfilSap` (dato legacy), `tarifaHora` es `0` y el reparto entero
  queda en `0`, igual criterio que `totalPosicion()` en el frontend
  mostrando `—`. **Sin dimensión de año**, igual limitación consciente que
  `Pep.presupuestoMensual`: un rango que cruza fin de año no distingue el
  año del monto, solo repite el nombre del mes (un rango de más de 12 meses
  sumaría dos veces sobre el mismo mes — no validado, no es un caso de uso
  esperado hoy). `calcularPresupuestoMensual()` convierte cada `"YYYY-MM"` a
  una cuenta absoluta de meses (`año*12 + (mes-1)`) para poder iterar el
  rango sin manejar `Date` — mismo espíritu que el resto del dominio de OC,
  que evita `Date` a propósito (ver bullet de `mesDesde`/`mesHasta` arriba).
- **Nomenclatura ambigua a propósito documentada**: `CreateOcDto.pepId` es
  el **ObjectId de Mongo** del documento `Pep` (para poder crear la ref),
  *no* el valor de negocio `Pep.pepId` (el código tipo
  `"AG.MH.1164.HP.AEB.100"` que viene del Excel). Mismo patrón que
  `CreateConsultorDto.perfilSapId` (ObjectId de `PerfilSap`). La colisión de
  nombre entre `Oc.pepId` (DTO) y `Pep.pepId` (schema) es real y confusa la
  primera vez — el comentario en `create-oc.dto.ts` lo aclara, no lo saques
  al refactorizar.
- **La tabla desktop de OC (`ocs-panel.html`) es una tabla HTML nativa, no un
  `<table mat-table>`** como el resto de los paneles — es la única excepción
  deliberada al patrón. Motivo: necesita intercalar filas de "encabezado de
  grupo" (una por SolPed) con filas de datos en el mismo `@for`, y el
  mecanismo de Angular Material para eso (múltiples `*matRowDef` con `when`
  predicate) no permite que el type-checker de templates estricto infiera el
  tipo correcto de fila dentro de cada `matCellDef` sin casts feos.
  **El sorting no usa `matSort`/columnas clickeables** (versión anterior,
  reemplazada a pedido explícito del usuario) sino un `mat-radio-group`
  (`OcsPanel.sortKey`, tipo `SortKey = 'solped' | 'numeroOc' | 'consultor' |
  'proveedor' | 'responsable'`, exactamente esas 5 opciones, ni más ni
  menos) arriba de la tabla. `displayRows` agrupa **siempre**, según el
  campo que corresponda al `sortKey` activo (ya no es exclusivo de SolPed):
  la función `groupValue(oc, key)` centraliza qué campo lee cada criterio
  (mismo valor que usa `compareOcs()` para ordenar/desempatar), y
  `GROUP_LABELS: Record<SortKey, string>` mapea cada criterio a su prefijo
  de etiqueta ("SolPed", "Número OC", "Consultor", "Proveedor",
  "Responsable") — la fila separadora se arma como `` `${GROUP_LABELS[key]}
  ${value}` `` (ej. "Proveedor BRIGHTSIDE"). Si se pide agregar más criterios
  de sort en el futuro, extender el union type `SortKey` + el `switch` de
  `groupValue()` + `GROUP_LABELS` + `SORT_OPTIONS`, los cuatro deben quedar
  en sync (no hay una fuente única de verdad para esto, a propósito, para que
  el compilador fuerce a tocar los cuatro si se agrega un caso).
  `compareOcs()` desempata siempre por SolPed+Posición para que el orden no
  "salte" entre recargas cuando hay valores repetidos (ej. dos OC del mismo
  Proveedor).
- **Checkbox "Solo pendientes" al final de `.oc-sort-bar`**
  (`OcsPanel.onlyPending`, signal `boolean`, arranca en `true`) filtra la
  tabla y las cards de mobile a solo posiciones con `completada: false`. Se
  aplica **antes** del sorting/agrupado en la cadena de computeds:
  `filteredOcs` (filtra `ocs()` según `onlyPending()`) → `sortedOcs` (ordena
  `filteredOcs()`) → `displayRows` (agrupa `sortedOcs()`). El `summary()`
  leído por el acordeón de `master-data.html` sigue contando
  `this.ocs().length` (total sin filtrar), no `filteredOcs()` — el checkbox
  es solo un filtro visual de la tabla, no debe afectar el contador del
  header. Hay un mensaje de estado dedicado
  (`filteredOcs().length === 0 && ocs().length > 0`) distinto del de lista
  vacía de verdad (`ocs().length === 0`), para no confundir "no hay OC
  pendientes" con "no hay OC cargadas".
- **"Copiar" una OC no es lo mismo que editar una OC con datos precargados
  distintos** — es un modo de alta. `OcFormDialogData` tiene dos campos:
  `oc: Oc | null` (no-null = edición real, con botón Eliminar y
  `PATCH`/update) y `copyFrom?: Oc | null` (precarga de solo lectura, el
  dialog sigue en modo alta con `POST`/create). `OcFormDialog` arma un
  `prefillSource = this.data.oc ?? this.data.copyFrom ?? null` y lo usa
  para los campos que se copian en ambos modos (`solped`, `numeroOc`,
  `consultorId`, `mesDesde`, `mesHasta`) — pero `posicion`, `pepId` y
  `cantidadHoras` leen **directo de `this.data.oc`** (no de
  `prefillSource`), a propósito, para que copiar deje esos tres vacíos
  aunque editar los siga precargando. Si agregás un campo nuevo al
  formulario de OC, decidí explícitamente si debe copiarse (usar
  `prefillSource`) o limpiarse en modo copia (usar `this.data.oc` directo)
  — no asumas que todos los campos se comportan igual.
- **`Oc.completada` tiene su propio endpoint, `PATCH
  /master-data/ocs/:id/completada` con `UpdateOcCompletadaDto` (`{
  completada: boolean }`), en vez de reusar `PATCH /master-data/ocs/:id`
  (que espera `CreateOcDto` completo)** — decisión deliberada para que el
  `mat-slide-toggle` de la tabla no tenga que reenviar SolPed/PEP/Consultor/
  meses de validez solo para togglear un booleano. En `ocs.controller.ts` la
  ruta `:id/completada` está declarada **antes** que `:id` a propósito (no
  es estrictamente necesario para que Nest la matchee bien, ya que son
  paths distintos, pero es la convención más legible: rutas específicas
  antes que las genéricas). El campo no se pide nunca en
  `oc-form-dialog` — Mongoose lo default-ea a `false` al crear, y
  `OcsPanel.toggleCompletada()` es el único lugar que lo cambia. Si la
  request falla, el slide-toggle se revierte a mano
  (`event.source.checked = !completada` en el `error` del subscribe) para
  que la UI no quede mostrando un estado que no llegó a guardarse en Mongo.
- **El ícono-rail del sidenav (`collapsed()` en `Shell`) necesita `::ng-deep`
  para centrar los íconos** — gotcha no obvio de Angular Material. Sacar el
  `<span matListItemTitle>` del DOM con `@if` no alcanza: `MatListItem`
  sigue renderizando internamente un `<span class="mdc-list-item__content">`
  vacío con `flex: 1` (CSS propio de MDC), que se come todo el espacio
  sobrante del item y empuja el ícono al borde izquierdo — `justify-content:
  center` en `.mat-mdc-list-item` no tiene efecto porque ya no queda espacio
  libre para distribuir. Ese span lo renderiza el template *interno* de
  `MatListItem` (un componente de Angular Material), no el de `Shell`, así
  que el encapsulamiento de estilos emulado de Angular no deja que el CSS
  scoped de `shell.scss` lo alcance sin perforarlo con `::ng-deep
  .mdc-list-item__content { display: none; }`. Verificado en el navegador
  midiendo el offset del centro del ícono contra el centro del sidenav
  (`getBoundingClientRect()`): sin este fix quedaba ~24px descentrado hacia
  la izquierda; con el fix, <1px de diferencia. Si en el futuro se actualiza
  Angular Material y esto dejara de hacer falta (o rompiera), no lo
  asumas — volvé a medir.
- **`Breakpoints.Handset` de Angular CDK (usado por `injectIsHandset()`) NO
  es solo "pantallas angostas en portrait"** — también matchea **landscape
  hasta 959.98px de ancho**. Un viewport de prueba tipo 800x718 (ancho <
  height sería portrait, pero 800 > 718 es landscape) cae dentro de esa
  franja y `isHandset()` da `true`, aunque 800px "se sienta" como desktop.
  Esto generó una falsa alarma al investigar un reporte de "el sidenav
  colapsado no achica" — el toggle de colapso funcionaba perfectamente
  (240px → 72px, verificado con `getBoundingClientRect()`), el problema era
  que el viewport de prueba (heredado de una resolución anterior del
  Browser pane) caía en la franja handset-landscape, donde `mode="over"` +
  sin clase `--collapsed` es el comportamiento *correcto*, no un bug. Antes
  de reportar o investigar cualquier bug de layout condicionado por
  `isHandset()`, confirmar primero con JS (`window.innerWidth +
  'x' + window.innerHeight`) que el viewport realmente cae del lado
  esperado de la franja — no asumir por el ancho solo.
- **`ConfirmDialog` (`frontend/src/app/shared/confirm-dialog/`) es el primer
  componente en `shared/`** — genérico, recibe `title`/`message`/
  `confirmText?`/`cancelText?` por `MAT_DIALOG_DATA` y devuelve `boolean`
  (`true` = confirmado) por `MatDialogRef.close()`. `Shell.logout()` es el
  primer consumidor: abre el dialog, y solo si `afterClosed()` emite `true`
  sigue con `AuthService.logout()` + redirect. Si aparece otro flujo
  destructivo/irreversible en la app (eliminar algo sin la confirmación
  inline que ya tienen los ABM, cancelar un proceso largo, etc.), reusar
  este componente en vez de escribir un dialog de confirmación nuevo desde
  cero.
- **`normalizePopulatedRef()` (`backend/src/master-data/shared/normalize-populated-ref.util.ts`)**
  centraliza el `_id -> id` + `delete __v` que necesita cualquier
  `toJSON.transform` con un path poblado (Mongoose no aplica el `toJSON` del
  schema referenciado automáticamente sobre un populate). Se usa en
  `consultor.schema.ts` (`perfilSap`) y en `oc.schema.ts` (`pep`,
  `consultor`, y el `perfilSap` anidado dentro de `consultor`). Si agregás
  un nuevo campo `ref`, reusalo en vez de reescribir el `if (record._id
  instanceof Types.ObjectId)` a mano.
- **Un `computed()` de Angular NO trackea lecturas de `FormControl.value`**
  porque `.value` no es una signal — solo dispara re-cómputo cuando una
  *signal* que sí leyó cambia. `oc-form-dialog.ts` necesita mostrar los
  datos derivados del Consultor seleccionado (`selectedConsultor`) cada vez
  que cambia el select; la primera versión leía
  `this.form.controls.consultorId.value` directo dentro de un `computed()`
  y quedaba pegada con el valor del primer cómputo (normalmente `null`), sin
  actualizarse nunca al elegir un consultor — verificado en el navegador:
  el select mostraba la selección correcta pero el bloque "Datos del
  consultor" no aparecía. Fix: envolver el control con `toSignal(control
  .valueChanges, { initialValue: control.value })` (mismo patrón que
  `pep-form-dialog.ts` ya usa para el total en vivo del presupuesto) y que
  el `computed()` lea esa signal en vez del `FormControl` directo. Si un
  `computed()` en un dialog no refleja un cambio de `mat-select`/`input`,
  sospechar primero de esto antes de asumir un bug de Angular Material.
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

- Login, refresh, logout, lockout, y el ABM completo de Perfiles SAP,
  Consultores (con select de Perfil SAP obligatorio), PEPs (con select de
  País obligatorio) y OC (con selects de PEP/Consultor obligatorios, el
  bloque de datos derivados del consultor con Total de la posición en vivo,
  datepickers de mes desde/hasta con validación cruzada, y la tabla
  agrupada por SolPed + sorting por columna) — crear, editar, eliminar,
  validación de duplicados/FK, total en vivo, vista mobile en cards — ya se
  verificaron en el navegador contra el MongoDB Atlas real del usuario
  (`mdh-planification` cluster), incluyendo que los Consultores/PEPs viejos
  sin `perfilSap`/`pais` se renderizan sin romper (`—` en la celda). El
  toggle expandir/colapsar todo del acordeón de Datos Maestros también se
  verificó (con el fix de arquitectura de `MatAccordion` descripto arriba).
- El botón "Copiar" de cada posición de OC, el radio-group de sorting
  (SolPed/Número OC/Consultor/Proveedor/Responsable, con agrupado por el
  criterio activo en los 5 casos — ver `groupValue()`/`GROUP_LABELS` en la
  sección de arquitectura arriba), el slide-toggle Pendiente/Completada (con
  persistencia confirmada recargando el panel), el checkbox "Solo pendientes"
  (marcado por defecto, filtra antes de agrupar/ordenar y no afecta el
  contador del acordeón), el popup de confirmación de logout (cancelar vs.
  confirmar), y el toggle de contraer/expandir del sidenav en desktop (con
  el fix de centrado de íconos vía `::ng-deep`, reverificado con un restart
  limpio del dev server tras un reporte de que "no achicaba") — todo esto se
  verificó en el navegador contra el MongoDB Atlas real del usuario, sin
  errores de consola (agrupado multi-criterio y checkbox "Solo pendientes"
  verificados toggleando un slide-toggle a Completada y confirmando que
  desaparece de la tabla con el checkbox tildado, y que reaparece al
  destildarlo). El comportamiento del sidenav en mobile (siempre a ancho
  completo, ignora `collapsed()`) se validó leyendo el template, no en el
  navegador — `resize_window` no dispara el listener de `BreakpointObserver`
  vía CDP sin un reload completo (gotcha ya documentado más abajo), y forzar
  ese reload hubiera cortado la sesión activa sin necesidad real.
- Activar los git hooks: esta carpeta no es su propio repo git (vive dentro
  de un repo compartido en `mexs.cencosud.ar` junto a otros proyectos SAP no
  relacionados). No se corrió `git init` acá para no asumir esa decisión por
  el usuario — definir si este proyecto va a tener su propio repo o se integra
  al existente antes de correr `npm run prepare`.
- "Olvidé mi contraseña": explícitamente fuera de alcance.
- PEPs quedó deliberadamente simplificado respecto al Excel: no tiene
  TTL IMPUTADO / TTL DISPONIBLE ni la fila REAL (eso depende de datos que
  todavía no existen en la app — Recepciones). Ahora que OC ya está cargado,
  revisar si conviene agregarlos.
- OC quedó deliberadamente simplificado respecto al Excel: `mesDesde`/
  `mesHasta` tienen granularidad de mes (no día completo como `F. Desde`/
  `F. Hasta`), sin reparto en hasta 3 PEPs con porcentaje, sin el flag
  "Activo p/elegir?". Ver detalle en la sección de arquitectura arriba.
- OC: sin integridad referencial. Borrar un Consultor o un PEP referenciado
  por una OC no está bloqueado (generaría import circular entre
  `ConsultoresModule`/`PepsModule` y `OcsModule`); la OC queda con esa
  referencia en `null` y se renderiza como `—`, igual que el caso de datos
  legacy sin `perfilSap`/`pais`.
- OC: evaluar si conviene pasar de ref-vivo a snapshot para Perfil SAP/
  Tarifa/Proveedor/Responsable (ver bullet de arquitectura arriba) — depende
  de si el negocio necesita que una OC ya cargada "congele" esos valores.
- Migración de datos: los Consultores/PEPs cargados antes de esta etapa no
  tienen `perfilSap`/`pais`. Si se quiere que dejen de mostrar `—`, hay que
  decidir con el usuario un valor a asignarles (no se puede inferir solo).
- Página "Recepciones" (`/order_recepcions`): placeholder en blanco, sin
  analizar todavía la solapa "( Recepciones )" del Excel.
- Tests: la estructura está preparada (Jest en backend, Vitest en frontend
  vía Angular CLI 21) pero no hay tests escritos todavía.
