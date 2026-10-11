# Blender > Scripting tab > New > paste > Run Script
# Prints every mesh object name so you can check the naming rule.
import bpy
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        print(o.name, '| collection:', [c.name for c in o.users_collection])
