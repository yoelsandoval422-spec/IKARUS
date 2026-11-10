# Piezas de marca de IKARU

Hoy IKARU usa un **logotipo provisional de texto** (ver `components/BrandLogo.tsx`) y un isotipo mínimo (la letra I).
Cuando tengas el logotipo definitivo, reemplaza estos archivos **conservando el nombre** y no hace falta tocar código:

| Pieza | Archivo | Tamaño recomendado |
|---|---|---|
| Isotipo / icono de pestaña (vectorial) | `app/icon.svg` | cuadrado, SVG |
| Icono de aplicación | `public/icons/icon-192.png` y `icon-512.png` | 192×192 y 512×512 |
| Icono "maskable" (Android) | `public/icons/icon-maskable-512.png` | 512×512, con 20 % de margen de seguridad |
| Icono de iPhone | `public/icons/apple-touch-icon.png` | 180×180, sin transparencia |

Pendiente para cuando exista el logotipo final: logotipo principal, versión monocromática y versiones para fondo claro y oscuro (guárdalas en esta carpeta).
