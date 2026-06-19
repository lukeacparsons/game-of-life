# Game of Life

Interactive Conway's Game of Life visualisation served as a static site.

The visual treatment is inspired by artificial-life work that makes cellular
automata feel more biological:

- SmoothLife: continuous-space generalisation of Conway's Life
- Lenia: continuous space-time-state cellular automata with organism-like forms
- Growing Neural Cellular Automata: persistent and regenerative CA behaviour

This site keeps Conway's discrete rules, then renders age, death trails,
connected neighbours, soft cell bodies, and clustered initial conditions to
make the simulation read more like a living culture.

## Local use

Open `static/index.html` directly, or serve the `static/` directory with any HTTP server.

## Deployment

Coolify static build pack:

- Base directory: `/static`
- Publish directory: `/static`
- Domain: `https://gol.candit.net`
