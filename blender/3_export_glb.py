# Select the objects of ONE level, set OUT, run. Repeat for the 3 levels.
#   level 1 -> divisions.glb  (8 objects)
#   level 2 -> districts.glb  (64 objects)
#   level 3 -> areas.glb      (all upazila / thana objects)
import bpy

OUT = "/Users/amir/Downloads/bangladesh-3d-web/public/models/divisions.glb"   # <-- change per level

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=True,        # only selected objects
    export_apply=False,        # do NOT change the mesh
    export_yup=True,           # Blender Z-up -> web Y-up
    export_materials='EXPORT', # keep your green colours
    export_cameras=False,
    export_lights=False,
)
print("saved", OUT)
