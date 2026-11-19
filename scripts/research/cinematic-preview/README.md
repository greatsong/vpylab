# 빛과 소리 렌더링 비교

같은 학생 코드에서 생성한 명령으로 태양·지구·달과 다섯 음 건반을 비교하는 독립 시연입니다. WebGL 2를 우선 사용하며, 사용할 수 없는 환경에서는 같은 좌표를 Canvas 2D로 투영합니다. 기본 모드는 기존 재질 설정을 재현합니다. 두 모드 모두 시연 전용 카메라와 입력 처리를 사용합니다.

저장소 루트에서 실행합니다.

```sh
npm ci --prefix client
python3 scripts/research/cinematic-preview/build-scenes.py
python3 -m http.server 8000 --bind 127.0.0.1
```

브라우저로 http://localhost:8000/scripts/research/cinematic-preview/ 를 엽니다. 태양계에서 시간을 멈추고 기본과 시네마틱을 전환하면 동일 시점의 표면과 빛을 비교할 수 있습니다. 악기는 숫자 키 1~5 또는 터치로 연주합니다. 다운로드한 파이썬 예제는 VPyLab에서 실행할 수 있습니다. 브라우저 시연은 생성된 명령을 재생하므로 코드를 수정하면 위의 Python 명령을 다시 실행해야 합니다.

지구와 달 이미지는 [Three.js r170 지구](https://github.com/mrdoob/three.js/blob/r170/examples/textures/planets/earth_atmos_2048.jpg)와 [달](https://github.com/mrdoob/three.js/blob/r170/examples/textures/planets/moon_1024.jpg)에서 가져왔습니다. 태양 이미지는 이 시연을 위해 절차적으로 생성했습니다.

여덟 행성, 혜성의 두 꼬리, 피아노·마림바·유리종 음색은 후속 검토 대상입니다.
