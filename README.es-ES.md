<p align="center">
  <img src="docs/logo.svg" alt="SP Invoicer logo" width="128" height="128">
</p>

# Plugin creador de facturas para Super Productivity

[![Latest release](https://img.shields.io/github/v/release/1jamesthompson1/sp-invoicer)](https://github.com/1jamesthompson1/sp-invoicer/releases/latest)
[![Docs](https://img.shields.io/badge/docs-user%20guide-blue)](https://1jamesthompson1.github.io/sp-invoicer)

> **⚠️ Desarrollo Temprano** — El funcionamiento básico de la facturación está activo, pero algunas características y detalles finales aún están en progreso.

Genera facturas profesionales para clientes a partir del tiempo rastreado en [Super Productivity](https://super-productivity.com/).

## Características

- Genera facturas de clientes a partir del tiempo rastreado
- Asigna proyectos a clientes con tarifas horarias personalizadas y configuración de impuestos
- Periodos de facturación flexibles: semana, mes, año, rango de fechas personalizado
- Tres niveles de desglose: totales por proyecto, desglose de tareas principales, jerarquía de subtareas anidadas
- Las tareas con nombres idénticos se fusionan automáticamente
- Exporta facturas como PDF
- Almacena metadatos de la factura (número, fecha, total, periodo) para referencia
- Sincroniza los detalles de la factura, los datos del cliente y las asignaciones de proyectos entre dispositivos

## Enlaces rápidos

- [📖 Documentación completa](https://sp-invoicer.sjhl.nz) — guía de instalación, configuración y uso
- [⬇️ Última versión](https://github.com/1jamesthompson1/sp-invoicer/releases/latest) — descarga el ZIP del plugin
- [🐛 Problemas](https://github.com/1jamesthompson1/sp-invoicer/issues) — reporta errores o solicita funciones

## Configuración del proyecto

```bash
git clone https://github.com/1jamesthompson1/sp-invoicer.git
cd sp-invoicer
npm install
npm run build
```

## Lanzamiento (Releasing)

```bash
npm version patch  # o minor / major
git push origin main --follow-tags
```

Esto crea un commit de versión + etiqueta, luego GitHub Actions construye y publica el lanzamiento.

## Licencia

MIT
