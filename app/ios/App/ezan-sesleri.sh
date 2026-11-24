#!/bin/sh
# Ezan kayıtları (Android: app/android/app/src/main/res/raw/ezan_N.mp3) → iPhone bildirim sesi (ezan_N.caf,
# uygulama paketinin kökünde; CamiPlugin.ezanDosyasi). Xcode'un "Ezan sesleri" derleme adımı çalıştırır (24-11-2026).
# iPhone bildirim sesi 30 sn'den kısa olmalı (yoksa telefonun sesi çalar): 29,5 sn'de kesilir, son 0,8 sn kısılır.
# afconvert macOS'te hazır; python3 yoksa kesilmez (o zaman 30 sn'den uzun kayıtta telefonun sesi çalar).
set -e
KAYNAK="$SRCROOT/../../android/app/src/main/res/raw"
HEDEF="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
GECICI="$DERIVED_FILE_DIR/ezan"
mkdir -p "$HEDEF" "$GECICI"
for f in "$KAYNAK"/ezan_*.mp3; do
  [ -e "$f" ] || continue
  ad=$(basename "$f" .mp3)
  afconvert -f WAVE -d LEI16@22050 -c 1 "$f" "$GECICI/$ad.wav"
  /usr/bin/python3 - "$GECICI/$ad.wav" <<'PY' || echo "uyarı: $ad kesilemedi"
import array, sys, wave
yol = sys.argv[1]
w = wave.open(yol, 'rb')
par, n, hz = w.getparams(), w.getnframes(), w.getframerate()
veri = w.readframes(n)
w.close()
son = int(hz * 29.5)
if n > son:
    s = array.array('h', veri[:son * 2])
    kis = int(hz * 0.8)
    for i in range(kis):
        s[son - kis + i] = int(s[son - kis + i] * (1 - (i + 1) / kis))
    o = wave.open(yol, 'wb')
    o.setparams(par)
    o.writeframes(s.tobytes())
    o.close()
PY
  afconvert -f caff -d ima4 "$GECICI/$ad.wav" "$HEDEF/$ad.caf"
  echo "ezan sesi: $ad.caf"
done
