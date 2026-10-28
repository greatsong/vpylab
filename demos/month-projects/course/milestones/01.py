from vpython import *

scene_background(색상['검정'])

곡 = ["도4", "레4", "미4", "파4", "솔4", "라4", "시4", "도5"]

for i, n in enumerate(곡):
    높이 = 0.3 + i * 0.25
    box(pos=vector(i - 3.5, 높이 / 2, 0),
        size=vector(0.6, 높이, 0.6),
        color=무지개[i % 7])
    음표(n, 0.45)
