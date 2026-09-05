# Ranking Nacional de Bádminton — Chile 2026

Plataforma oficial de la Federación Chilena de Badminton (FEDEBADCHILE) para
la clasificación individual por categoría y modalidad, el ranking de clubes,
los perfiles de deportistas y el calendario del Torneo Nacional 2026 (Sub15,
Sub17, Sub19 y Adulto, 3 fechas).

Estado: Fechas 1 (Santiago) y 2 (Victoria) cargadas; la 3ª queda pendiente.

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
scripts/clubs.py             Catálogo de clubes (nombre, sigla, color), compartido
scripts/fecha1_results.py    Resultados reales de la Fecha 1, cuadro por cuadro
scripts/fecha2_results.py    Ídem Fecha 2
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
- Ese puntaje de clubes se calcula **fecha a fecha y después se suma**: la base
  de 50, el conteo de inscritos y el bono se pagan una vez por fecha. Un club
  que no viaja a una fecha suma 0 esa fecha (no arrastra su base). En la tabla
  del sitio se muestra como "—" para distinguirlo de un 0 obtenido jugando.
- Un deportista puede cambiar de club entre fechas: cada `fechaN_results.py`
  guarda el club con el que compitió esa fecha, y el puntaje de esa fecha se le
  acredita a ese club. El perfil muestra su club actual (el más reciente).

## Agregar una fecha nueva (Fecha 3, ...)

1. Lee los cuadros oficiales en Tournamentsoftware.com (perfil de
   FEDEBADCHILE) para la fecha correspondiente: quién salió 1°, 2°, semis
   (3er lugar, empatado si no hay partido por el 3er puesto), cuartos de
   final (5°-8°), y quién jugó pero no pasó de esa instancia (participación).
   Ojo: un evento inscrito no siempre llega a jugarse — si no tiene cuadro,
   no reparte puntos, ni siquiera de participación.
2. Crea `scripts/fecha3_results.py` copiando la forma de
   `scripts/fecha2_results.py`: un `add_event(...)` por cuadro, y `add_event`
   debe llamar a `make_event(3, ...)`. Incluye el `NAME_CLUB` de *esa* fecha
   (el plantel completo que compitió, con el club de esa fecha). Si aparece un
   club nuevo, agrégalo a los tres diccionarios de `scripts/clubs.py`.
3. En `scripts/build_data.py`, bajo `if __name__ == "__main__":`, agrega el
   módulo a la lista `FECHAS` y su número a `FECHA_NUMS`. Nada más: el resto
   del pipeline (puntaje por fecha, tabla de clubes, totales) ya es genérico.
4. Corre `python -m unittest discover scripts` (nada debería romperse) y
   luego `python scripts/build_data.py` para regenerar `js/data.js`. El script
   imprime los cambios de club entre fechas y la tabla de clubes por fecha:
   revísalos, son la señal más rápida de una transcripción torcida.
5. En `js/meta.js`, cambia el `estado` de esa fecha de `"proxima"` a
   `"completado"` y completa `sedeCorta`/`eventos`/`inscritos`/`fuenteUrl`.
   `eventos` son **cuadros disputados**, no eventos inscritos.
6. Abre el sitio local y revisa: el selector de Fecha en "Ranking Nacional"
   debería mostrar datos reales para la fecha nueva, "Ranking general (3
   fechas)" debería sumar todas, y la tabla de clubes debería ganar su columna
   F3 automáticamente.
7. Commitea `js/data.js`, `js/meta.js` y el `scripts/fechaN_results.py`
   nuevo juntos, en un commit describiendo la fecha.

### Verificar una transcripción

La forma más barata de pillar un error es contrastar, cuadro por cuadro, la
cantidad de inscritos que declara la página de *Events* del torneo contra la
suma de `placements` + `participation` de cada `add_event`. Si un cuadro
cuadra en el total pero alguien está en el escalón equivocado, el número
igual coincide — por eso conviene además revisar quién ganó cada partido de
cuartos, que es la frontera entre 30 y 10 puntos.

## Privacidad

Los perfiles de deportistas muestran solo datos deportivos públicos (nombre,
club, categoría, resultados). No se publican RUT, teléfono, correo, fecha de
nacimiento ni fotografías.

## Licencia

Ver [LICENSE](LICENSE) — © Federación Chilena de Badminton (FEDEBADCHILE).
Todos los derechos reservados.
