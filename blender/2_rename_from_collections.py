# OPTIONAL. Use only if your objects are inside nested collections like
#   Dhaka (collection) > Gazipur (collection) > Kaliakair (object)
# It renames objects to  Dhaka__Gazipur__Kaliakair  (geometry is NOT touched).
# SAVE A COPY OF YOUR .blend FIRST.
import bpy

def coll_path(coll, root):
    path = []
    def find(c, trail):
        if c == coll: return trail
        for ch in c.children:
            r = find(ch, trail + [ch.name])
            if r is not None: return r
        return None
    return find(root, []) or []

root = bpy.context.scene.collection
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH': continue
    base = o.name.split('__')[-1].split('.')[0]          # remove .001 etc.
    path = [p.split('.')[0] for p in coll_path(o.users_collection[0], root)]
    o.name = '__'.join(path + [base])
    print(o.name)
