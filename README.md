# Ranking Nacional de Bádminton — Chile 2026

Plataforma oficial de la Federación Chilena de Badminton (FEDEBADCHILE) para
la clasificación individual por categoría y modalidad, el ranking de clubes,
los perfiles de deportistas y el calendario del Torneo Nacional 2026 (Sub15,
Sub17, Sub19 y Adulto, 3 fechas).

Sitio estático — HTML/CSS/JS sin frameworks ni dependencias externas. Se
puede abrir `index.html` directamente o servirlo con cualquier servidor
estático.

## Cómo correrlo localmente

```bash
python -m http.server 8791
# abrir http://localhost:8791/
```

## Estructura

```
index.html          Estructura de la página (todas las secciones + vista de perfil)
css/styles.css       Sistema de diseño (tokens, componentes, modo oscuro, responsive)
js/meta.js           Datos "estáticos": categorías, modalidades, calendario, reglamento
js/data.js           Datos generados: PLAYERS y CLUBS (NO editar a mano — ver abajo)
js/ranking.js        Motor de ranking puro (sin DOM) — agregación y orden. Testeado en tests/
js/charts.js         Gráficos de barra horizontales, sin dependencias
js/animate.js        Scroll-reveal, contadores animados, carrusel del podio
js/app.js            Renderizado + rutas + manejo de errores
assets/              Logo oficial, íconos decorativos, favicons

scripts/build_data.py        Pipeline: resultados de torneo -> js/data.js
scripts/fecha1_results.py    Resultados reales de la Fecha 1, cuadro por cuadro
scripts/test_build_data.py   Tests del pipeline (unittest)

tests/ranking.test.js        Tests del motor de ranking (node:test)
```

## Tests

```bash
node --test                        # motor de ranking (js/ranking.js)
python -m unittest discover scripts  # pipeline de datos (scripts/build_data.py)
```

Ambos corren en cada push/PR vía GitHub Actions (`.github/workflows/tests.yml`).
Antes de tocar `js/ranking.js` o `scripts/build_data.py`, corre los tests —
son lo único que protege contra un puntaje mal calculado en un ranking real.

## Cómo funciona el ranking (resumen)

Ver la sección "Reglamento" del sitio para el detalle completo. En corto:

- Puntos por posición: 1°=100, 2°=80, 3°=60, 4°=50 (solo cuadros Round Robin),
  5°-8°=30, participación=10.
- En dobles, **ambos** integrantes de la pareja suman el puntaje completo a
  su ranking individual.
- El ranking **nunca mezcla categorías de edad** (Sub15/Sub17/Sub19/Adulto):
  un deportista que juega dos categorías no debe rankear más alto solo por
  tener más resultados para sumar. Todo lo que agrega fechas o modalidades
  lo hace *dentro* de una sola categoría a la vez.
- El puntaje de clubes es: 50 base + 1 por deportista inscrito en la fecha +
  7/5/3 por medalla de oro/plata/bronce + bono de 20 si el club inscribe más
  de 10 deportistas en la fecha.

## Agregar una fecha nueva (Fecha 2, Fecha 3, ...)

1. Lee los cuadros oficiales en Tournamentsoftware.com (perfil de
   FEDEBADCHILE) para la fecha correspondiente: quién salió 1°, 2°, semis
   (3er lugar, empatado si no hay partido por el 3er puesto), cuartos de
   final (5°-8°), y quién jugó pero no pasó de esa instancia (participación).
2. Crea `scripts/fecha2_results.py` con la misma forma que
   `scripts/fecha1_results.py`: un `add_event(...)` por cuadro, usando
   `fecha=2` (revisa que `add_event` en tu nuevo archivo llame a
   `make_event(2, ...)` en vez de `make_event(1, ...)`). Si aparecen
   deportistas nuevos, agrégalos a `NAME_CLUB` con su club.
3. En `scripts/build_data.py`, bajo `if __name__ == "__main__":`, importa
   también `scripts/fecha2_results.py` y concatena su `EVENTS` a los de
   Fecha 1 antes de llamar a `compute_results(...)`.
4. Corre `python -m unittest discover scripts` (nada debería romperse) y
   luego `python scripts/build_data.py` para regenerar `js/data.js`.
5. En `js/meta.js`, cambia el `estado` de esa fecha de `"proxima"` a
   `"completado"` y completa `eventos`/`inscritos`/`fuenteUrl`.
6. Abre el sitio local y revisa: el selector de Fecha en "Ranking Nacional"
   debería mostrar datos reales para la fecha nueva, y "Ranking general (3
   fechas)" debería sumar ambas fechas correctamente.
7. Commitea `js/data.js`, `js/meta.js` y el `scripts/fechaN_results.py`
   nuevo juntos, en un commit describiendo la fecha.

## Privacidad

Los perfiles de deportistas muestran solo datos deportivos públicos (nombre,
club, categoría, resultados). No se publican RUT, teléfono, correo, fecha de
nacimiento ni fotografías.

## Licencia

Ver [LICENSE](LICENSE) — © Federación Chilena de Badminton (FEDEBADCHILE).
Todos los derechos reservados.
