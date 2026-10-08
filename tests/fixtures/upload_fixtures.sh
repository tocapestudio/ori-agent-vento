#!/bin/bash
# Uploads fixtures: common library + profile library. Usage: upload_fixtures.sh <API> <PROFILE_ID>
API=$1; PID=$2; DIR=/app/tests/fixtures
TOKEN=$(curl -s -X POST $API/auth/access -H 'Content-Type: application/json' -d '{"code":"Orion9944+"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -X POST $API/documents/upload -H "Authorization: Bearer $TOKEN" -F library=common -F profile_id=$PID \
  -F files=@$DIR/guia_ambliopia.pdf -F files=@$DIR/informe_escaneado.pdf -F files=@$DIR/protocolo_vergencias.docx \
  -F files=@$DIR/normas_acomodacion.xlsx -F files=@$DIR/vision_deportiva.pptx -F files=@$DIR/tabla_estereopsis.png > /dev/null
curl -s -X POST $API/documents/upload -H "Authorization: Bearer $TOKEN" -F library=mine -F profile_id=$PID \
  -F "notes=El paciente Omega practica tenis de mesa a nivel federado." -F files=@$DIR/caso_omega_perfilA.docx > /dev/null
echo uploaded
