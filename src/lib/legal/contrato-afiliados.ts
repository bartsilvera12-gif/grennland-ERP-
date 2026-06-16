// Contrato de Adhesion al Programa de Afiliados de AlquiloYa.
// Cuando el contenido cambie hay que bumpear CONTRATO_AFILIADOS_VERSION para
// que las aceptaciones nuevas queden ligadas a la version vigente. Las
// solicitudes ya enviadas conservan la version que aceptaron en su momento
// (columna terminos_version en solicitudes_acceso).

export const CONTRATO_AFILIADOS_VERSION = "2026-06-16";

export type ContratoClausula = {
  titulo: string;
  // Bloques: parrafos sueltos o listas (con o sin titulo previo).
  bloques: Array<
    | { tipo: "p"; texto: string }
    | { tipo: "ul"; items: string[] }
  >;
};

export const CONTRATO_AFILIADOS_INTRO: string[] = [
  "Entre ALQUILOYA, plataforma digital operada a traves del sitio web www.alquiloya.com.py, en adelante denominada “LA EMPRESA”, por una parte;",
  "y el usuario que complete su registro y acepte electronicamente las presentes Bases y Condiciones, en adelante denominado “EL AFILIADO”, por la otra;",
  "se celebra el presente Contrato de Adhesion sujeto a las siguientes clausulas:",
];

export const CONTRATO_AFILIADOS_CLAUSULAS: ContratoClausula[] = [
  {
    titulo: "PRIMERA: OBJETO DEL CONTRATO",
    bloques: [
      { tipo: "p", texto: "El presente contrato tiene por objeto regular la participacion de EL AFILIADO en el Programa de Referidos de www.alquiloya.com.py." },
      { tipo: "p", texto: "EL AFILIADO podra promocionar los servicios ofrecidos por LA EMPRESA mediante enlaces, codigos, publicaciones, campanas digitales, redes sociales, medios electronicos o cualquier otro mecanismo autorizado por LA EMPRESA." },
      { tipo: "p", texto: "Como contraprestacion, EL AFILIADO tendra derecho a percibir una comision por los clientes efectivamente referidos que realicen compras validas conforme a las condiciones establecidas en este contrato." },
    ],
  },
  {
    titulo: "SEGUNDA: MODELO DE NEGOCIO Y NATURALEZA DEL CONTRATO",
    bloques: [
      { tipo: "p", texto: "Las partes reconocen expresamente que:" },
      { tipo: "ul", items: [
        "No existe relacion laboral alguna.",
        "No existe relacion de dependencia.",
        "No existe representacion comercial exclusiva.",
        "EL AFILIADO actua de manera independiente y bajo su propio riesgo.",
        "EL AFILIADO es responsable de sus obligaciones tributarias, previsionales y legales.",
      ] },
      { tipo: "p", texto: "En ningun caso podra interpretarse que actua como empleado, agente, mandatario o representante legal de LA EMPRESA." },
    ],
  },
  {
    titulo: "TERCERA: MECANISMO DE REFERIDOS Y ENLACE DE REFERIDOS",
    bloques: [
      { tipo: "p", texto: "Para participar en el programa EL AFILIADO debera:" },
      { tipo: "ul", items: [
        "Registrarse mediante los formularios habilitados.",
        "Proporcionar informacion veraz y actualizada.",
        "Mantener sus datos actualizados.",
        "Aceptar electronicamente las presentes condiciones.",
      ] },
      { tipo: "p", texto: "LA EMPRESA podra solicitar documentacion adicional para verificar la identidad del afiliado." },
      { tipo: "p", texto: "LA EMPRESA proporcionara un enlace unico, codigo de afiliado u otro mecanismo de identificacion." },
      { tipo: "p", texto: "La atribucion de una comision dependera exclusivamente de los sistemas de seguimiento implementados por LA EMPRESA." },
      { tipo: "p", texto: "Las estadisticas generadas por los sistemas de ALQUILOYA constituiran prueba suficiente para determinar las comisiones devengadas." },
    ],
  },
  {
    titulo: "CUARTA: COMISIONES",
    bloques: [
      { tipo: "p", texto: "EL AFILIADO tendra derecho a percibir una comision unicamente cuando:" },
      { tipo: "ul", items: [
        "El cliente haya ingresado mediante su enlace o codigo de referido.",
        "El cliente contrate efectivamente un servicio ofrecido por ALQUILOYA.",
        "El cliente realice el pago total correspondiente.",
        "No exista devolucion, anulacion o fraude.",
      ] },
      { tipo: "p", texto: "La comision sera del 8 % del importe efectivamente percibido por LA EMPRESA y podra ajustarse hasta el monto de 20 % conforme al acuerdo comercial y metas establecidas." },
      { tipo: "p", texto: "La comision podra ser modificada por LA EMPRESA mediante notificacion previa de al menos quince (15) dias." },
    ],
  },
  {
    titulo: "QUINTA: DEVENGAMIENTO Y PAGO",
    bloques: [
      { tipo: "p", texto: "Las comisiones se consideraran devengadas unicamente cuando:" },
      { tipo: "ul", items: [
        "El pago del cliente haya sido acreditado.",
        "Haya transcurrido el periodo de validacion establecido por LA EMPRESA.",
        "No exista reclamo pendiente.",
      ] },
      { tipo: "p", texto: "Los pagos se realizaran:" },
      { tipo: "ul", items: [
        "Mensualmente.",
        "Mediante transferencia bancaria, billetera electronica u otro medio habilitado comunicado por el afiliado.",
        "Contra emision del comprobante tributario correspondiente cuando la legislacion lo exija.",
      ] },
      { tipo: "p", texto: "El monto minimo para solicitar pago sera de Gs. 500.000." },
    ],
  },
  {
    titulo: "SEXTA: ACTIVIDADES PROHIBIDAS",
    bloques: [
      { tipo: "p", texto: "EL AFILIADO se obliga a no:" },
      { tipo: "ul", items: [
        "Realizar publicidad enganosa.",
        "Utilizar marcas, logos o material de ALQUILOYA sin autorizacion.",
        "Generar registros falsos.",
        "Crear trafico artificial.",
        "Utilizar bots o sistemas automatizados.",
        "Publicar informacion falsa o difamatoria.",
        "Utilizar spam, correo masivo no autorizado o practicas prohibidas por ley.",
        "Realizar actos que perjudiquen la imagen de ALQUILOYA.",
        "Ofrecer descuentos o beneficios no autorizados.",
        "Presentarse como propietario o representante oficial de ALQUILOYA.",
      ] },
    ],
  },
  {
    titulo: "SEPTIMA: CONFIDENCIALIDAD",
    bloques: [
      { tipo: "p", texto: "EL AFILIADO se obliga a mantener absoluta reserva sobre toda informacion confidencial obtenida durante la vigencia del presente contrato." },
      { tipo: "p", texto: "Se considera informacion confidencial, entre otras:" },
      { tipo: "ul", items: [
        "Bases de datos.",
        "Informacion de clientes.",
        "Estrategias comerciales.",
        "Sistemas tecnologicos.",
        "Informes de ventas.",
        "Comisiones.",
        "Procesos internos.",
        "Informacion financiera.",
        "Datos personales.",
      ] },
      { tipo: "p", texto: "EL AFILIADO no podra divulgar, reproducir ni utilizar dicha informacion para fines distintos a los previstos en este contrato." },
      { tipo: "p", texto: "La obligacion de confidencialidad permanecera vigente durante la relacion contractual y por un plazo de cinco (5) anos posteriores a su terminacion." },
    ],
  },
  {
    titulo: "OCTAVA: PROTECCION DE DATOS",
    bloques: [
      { tipo: "p", texto: "EL AFILIADO se compromete a cumplir las normas aplicables sobre privacidad y proteccion de datos personales." },
      { tipo: "p", texto: "No podra recopilar, almacenar, vender, transferir o utilizar informacion de usuarios obtenida mediante ALQUILOYA sin autorizacion expresa y escrita." },
    ],
  },
  {
    titulo: "NOVENA: PROPIEDAD INTELECTUAL",
    bloques: [
      { tipo: "p", texto: "Todos los derechos sobre:" },
      { tipo: "ul", items: [
        "Marca ALQUILOYA.",
        "Sitio web.",
        "Software.",
        "Diseno grafico.",
        "Contenido.",
        "Logotipos.",
        "Bases de datos.",
      ] },
      { tipo: "p", texto: "pertenecen exclusivamente a LA EMPRESA." },
      { tipo: "p", texto: "La participacion en el programa no implica cesion alguna de derechos de propiedad intelectual." },
    ],
  },
  {
    titulo: "DECIMA: AUDITORIA Y CONTROL",
    bloques: [
      { tipo: "p", texto: "LA EMPRESA podra verificar en cualquier momento la actividad del afiliado." },
      { tipo: "p", texto: "En caso de detectar irregularidades podra:" },
      { tipo: "ul", items: [
        "Suspender la cuenta.",
        "Retener pagos.",
        "Cancelar comisiones.",
        "Resolver el contrato.",
        "Suspender el acceso a la plataforma.",
      ] },
    ],
  },
  {
    titulo: "DECIMA PRIMERA: SUSPENSION Y TERMINACION",
    bloques: [
      { tipo: "p", texto: "LA EMPRESA podra suspender o finalizar la participacion del afiliado cuando:" },
      { tipo: "ul", items: [
        "Exista incumplimiento contractual.",
        "Existan indicios de fraude.",
        "Se afecte la reputacion de ALQUILOYA.",
        "Se infrinjan disposiciones legales.",
      ] },
      { tipo: "p", texto: "La terminacion podra realizarse sin necesidad de interpelacion judicial previa." },
    ],
  },
  {
    titulo: "DECIMA SEGUNDA: LIMITACION DE RESPONSABILIDAD",
    bloques: [
      { tipo: "p", texto: "LA EMPRESA no garantiza:" },
      { tipo: "ul", items: [
        "Cantidad minima de clientes.",
        "Ingresos minimos.",
        "Ventas determinadas.",
        "Disponibilidad permanente del sistema.",
      ] },
      { tipo: "p", texto: "EL AFILIADO reconoce que participa bajo su propio riesgo comercial." },
    ],
  },
  {
    titulo: "DECIMA TERCERA: INDEMNIDAD",
    bloques: [
      { tipo: "p", texto: "EL AFILIADO mantendra indemne a LA EMPRESA frente a cualquier reclamo, sancion, multa o demanda derivada de:" },
      { tipo: "ul", items: [
        "Publicidad realizada por el afiliado.",
        "Informacion falsa difundida.",
        "Infracciones legales cometidas por el afiliado.",
      ] },
    ],
  },
  {
    titulo: "DECIMA CUARTA: MODIFICACIONES DE LAS CONDICIONES",
    bloques: [
      { tipo: "p", texto: "LA EMPRESA podra modificar las presentes condiciones." },
      { tipo: "p", texto: "Las modificaciones seran comunicadas mediante:" },
      { tipo: "ul", items: [
        "Correo electronico.",
        "Publicacion en el sitio web.",
        "Panel de afiliados.",
      ] },
      { tipo: "p", texto: "La continuidad en el uso del programa implicara aceptacion de las modificaciones." },
    ],
  },
  {
    titulo: "DECIMA QUINTA: CASO FORTUITO O FUERZA MAYOR",
    bloques: [
      { tipo: "p", texto: "Ninguna de las partes sera responsable por incumplimientos derivados de acontecimientos de fuerza mayor o caso fortuito conforme al Codigo Civil Paraguayo." },
    ],
  },
  {
    titulo: "DECIMA SEXTA: LEGISLACION APLICABLE",
    bloques: [
      { tipo: "p", texto: "El presente contrato se regira e interpretara conforme a las leyes de la Republica del Paraguay, especialmente las disposiciones del Codigo Civil Paraguayo y demas normas aplicables." },
    ],
  },
  {
    titulo: "DECIMA SEPTIMA: JURISDICCION",
    bloques: [
      { tipo: "p", texto: "Las partes acuerdan someter cualquier controversia derivada del presente contrato a la competencia de los Juzgados y Tribunales de la Republica del Paraguay, con asiento en la ciudad de Concepcion, renunciando a cualquier otro fuero que pudiera corresponder." },
    ],
  },
  {
    titulo: "DECIMA OCTAVA: ACEPTACION ELECTRONICA",
    bloques: [
      { tipo: "p", texto: "La aceptacion electronica de las presentes Bases y Condiciones tendra la misma validez juridica que la firma manuscrita, conforme a la legislacion paraguaya aplicable." },
    ],
  },
];
