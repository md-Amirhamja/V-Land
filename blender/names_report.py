import bpy
out = "/Users/amir/Downloads/bangladesh-3d-web/blender/names_report.txt"
lines = []
def walk(c, d=0):
    objs = [o for o in c.objects if o.type == 'MESH']
    lines.append("  " * d + "[" + c.name + "] meshes=" + str(len(objs)))
    for o in objs[:6]:
        lines.append("  " * d + "    - " + o.name)
    for ch in c.children:
        walk(ch, d + 1)
walk(bpy.context.scene.collection)
open(out, "w").write("\n".join(lines))
print("saved", out)
