# Juego plataforma - Cubo rojo

Juego 2D minimalista con una plataforma blanca y un personaje (cubo rojo) que se mueve con A/D y salta con W.

Archivos principales:

- [index.html](index.html)
- [style.css](style.css)
- [game.js](game.js)
- [server.js](server.js)
- [package.json](package.json)

Ejecución local:

```bash
npm install
npm start
# Abrir http://localhost:3000 en el navegador
```

Despliegue en Render (opciones):

- Static Site: sube el repo a GitHub y crea un "Static Site" en Render apuntando al repositorio; Render servirá los archivos estáticos.
- Web Service: crea un nuevo "Web Service" en Render, selecciona el repo y usa el comando `npm start` para ejecutar `server.js`.
