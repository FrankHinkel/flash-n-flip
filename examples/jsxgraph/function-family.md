# Funktionsschar

```jsxgraph{w=100% h=70% bg=#fff0}
title "Quadratische Funktionsschar"
describe "Der Schieberegler a verändert die Öffnung und Richtung der Parabel y gleich a mal x zum Quadrat."
board x=-5..5 y=-5..7 axes grid
a = slider(-2, 2, value=1, step=0.1)
f(x) = a*x^2
plot(f, from=-5, to=5, color=blue, width=3)
```
