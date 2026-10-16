#!/bin/sh
echo "git history:"; git log -p --all -S"service_role" --oneline | grep -c "eyJ" || true
echo "dist:"; grep -rIlE "eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}" dist | head
grep -rIo '"role":"service_role"' dist && echo "FOUND service key" || echo "OK: no service key in dist"
