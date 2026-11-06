from vpython import *
scene.range=3
scene.center=vec(4,2,1)
a=scene.camera.axis
scene.camera.pos=vec(8,3,2)
assert mag(scene.center-(scene.camera.pos+a))<1e-8
scene.camera.axis=vec(0,-2,-4)
assert mag(scene.center-vec(8,1,-2))<1e-8
parts=[sphere(pos=vec(8,1,-2),radius=0.6),box(pos=vec(9,1,-2))]
c=compound(parts)
c.color=vec(1,0.2,0.1)
c.opacity=0.3
c.shininess=0.9
c.emissive=True
print('STANDALONE_CAMERA_COMPOUND_OK')
