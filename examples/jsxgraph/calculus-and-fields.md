# Analysis und Felder

```jsxgraph{w=100% h=620px bg=#18212f10}
title "Sinus, Integral und Richtungsfeld"
describe "Der Sinusgraph, seine Fläche zwischen null und Pi sowie ein Richtungsfeld werden gemeinsam dargestellt."
board x=-1..7 y=-3..3 axes grid
f(x) = sin(x)
plot(f, from=0, to=2*pi, color=blue, width=3)
integralArea(f, from=0, to=pi, color=yellow, alpha=0.28)
slopefield(x, y, cos(x)-y, density=12, color=green, alpha=0.5)
```
