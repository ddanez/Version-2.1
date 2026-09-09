
export const TECHNICAL_DESCRIPTION = `
# GESTOR PRO - ESPECIFICACIONES TÉCNICAS

## 1. ARQUITECTURA DEL SISTEMA
Gestor Pro es una aplicación web full-stack diseñada con una arquitectura moderna que prioriza la velocidad, la seguridad y la capacidad de funcionamiento offline.

### 1.1 Frontend (Interfaz de Usuario)
- **Framework:** React 18 con TypeScript para un desarrollo robusto y tipado.
- **Estilizado:** Tailwind CSS para un diseño responsivo, moderno y altamente personalizado.
- **Iconografía:** Lucide React para una interfaz visual clara y profesional.
- **Animaciones:** Framer Motion para transiciones fluidas y una experiencia de usuario premium.
- **Estado Global:** Hooks de React (useState, useEffect, useMemo) para una gestión de estado eficiente.

### 1.2 Backend (Servidor y API)
- **Entorno:** Node.js con Express.
- **Base de Datos:** SQLite3 para persistencia de datos en el servidor, ideal para entornos locales y despliegues rápidos.
- **Autenticación:** JSON Web Tokens (JWT) para sesiones seguras.
- **Seguridad:** Encriptación de contraseñas con bcryptjs y protección de rutas mediante middleware de autenticación.

### 1.3 Almacenamiento y Sincronización
- **IndexedDB:** Implementación de persistencia en el lado del cliente para permitir el funcionamiento en condiciones de red inestable.
- **DBService:** Capa de abstracción personalizada que gestiona la sincronización automática entre el navegador (IndexedDB) y el servidor (SQLite).

## 2. FUNCIONALIDADES PRINCIPALES
- **Gestión de Inventario:** Control de stock en tiempo real, alertas de bajo inventario y categorización.
- **Punto de Venta (POS):** Módulos optimizados para Ventas y Compras con búsqueda rápida de productos.
- **Gestión de Contactos:** Directorios detallados de Clientes, Proveedores y Vendedores.
- **Finanzas:** Control de Cuentas por Cobrar (CxC), Cuentas por Pagar (CxP) y registro de Gastos.
- **Inteligencia Artificial:** Integración con Google Gemini API para análisis predictivo y reportes inteligentes de negocio.
- **Seguridad Granular:** Sistema de roles (Admin/User) con permisos específicos por módulo.

## 3. REQUISITOS DE DESPLIEGUE
- Compatible con entornos Android mediante Termux o AWebServer.
- Soporte para despliegue en la nube (Google Cloud, Heroku, etc.).
- Optimizado para visualización en dispositivos móviles y de escritorio.
`;

export const PROMOTIONAL_DESCRIPTION = `
# GESTOR PRO - TU NEGOCIO AL SIGUIENTE NIVEL

## ¿QUÉ ES GESTOR PRO?
Gestor Pro es la herramienta definitiva de gestión empresarial diseñada para emprendedores y dueños de negocios que buscan eficiencia, control y crecimiento. Olvida las hojas de cálculo complicadas y toma el control total de tu empresa desde la palma de tu mano.

## BENEFICIOS CLAVE

### 🚀 Control Total en Tiempo Real
Monitorea tus ventas, compras e inventario al instante. Sabe exactamente qué tienes en stock y cuánto estás ganando cada día.

### 🧠 Inteligencia Artificial a tu Servicio
¿No estás seguro de qué productos pedir? Nuestro asistente de IA analiza tus datos y te brinda recomendaciones estratégicas para optimizar tus ganancias.

### 🔒 Seguridad de Nivel Profesional
Tus datos son tu activo más valioso. Gestor Pro cuenta con sistemas de seguridad avanzados y gestión de permisos para que cada empleado acceda solo a lo que necesita.

### 📱 Movilidad Sin Límites
Lleva tu oficina contigo. Gestor Pro está optimizado para funcionar perfectamente en tu teléfono Android, tablet o computadora, incluso si la conexión a internet falla.

### 📊 Finanzas Claras y Transparentes
Gestiona tus deudas y cobros sin errores. El módulo de Cuentas por Cobrar y Pagar te asegura que nunca pierdas el rastro de tu dinero.

## ¿POR QUÉ ELEGIR GESTOR PRO?
Porque no es solo un software de ventas; es un aliado estratégico. Hemos diseñado una interfaz intuitiva que no requiere conocimientos técnicos avanzados, permitiéndote enfocarte en lo que realmente importa: **Hacer crecer tu negocio.**

**Gestor Pro: Empodera tu negocio con tecnología de vanguardia.**
`;
