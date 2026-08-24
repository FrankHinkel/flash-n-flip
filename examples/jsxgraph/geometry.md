# Interaktive Geometrie

```jsxgraph{w=90% h=500px bg=#18212f18}
title "Dreieck und Umkreis"
describe "Drei bewegliche Punkte bilden ein Dreieck. Sein Umkreis und der Mittelpunkt der Seite A B werden automatisch nachgeführt."
board x=-6..6 y=-4..5 axes grid aspect=1
A = point(-3, -1, drag=true, color=blue)
B = point(3, -1, drag=true, color=yellow)
C = point(0, 3, drag=true, color=red)
polygon(A, B, C, color=blue, alpha=0.18)
M = midpoint(A, B, color=green)
c = circumcircle(A, B, C, color=purple, width=2)
```
