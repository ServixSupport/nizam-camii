package nl.suleymaniyecamii.namaz;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RectF;
import android.graphics.Typeface;

/**
 * Üst çubuk simgesi: cami (kubbe, gövde, iki minare) ve içinde kalan dakika.
 * Rakamlar simgeden oyulur (saydam): Android çubuk simgesini tek renge boyar, rakamlar zemin renginde görünür.
 */
final class CamiSimgesi {

    private static final int S = 96;

    private CamiSimgesi() {}

    static Bitmap ciz(int dakika) {
        Bitmap bm = Bitmap.createBitmap(S, S, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(bm);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.WHITE);
        // minareler (ince, sivri uçlu, kenarlarda): ortada rakamlara geniş yer kalsın
        Path m = new Path();
        m.moveTo(4, 2); m.lineTo(8, 14); m.lineTo(8, 96); m.lineTo(0, 96); m.lineTo(0, 14); m.close();
        m.moveTo(92, 2); m.lineTo(96, 14); m.lineTo(96, 96); m.lineTo(88, 96); m.lineTo(88, 14); m.close();
        cv.drawPath(m, p);
        // alem, kubbe ve gövde
        cv.drawRect(46, 0, 50, 12, p);
        cv.drawArc(new RectF(24, 10, 72, 58), 180, 180, true, p);
        cv.drawRect(11, 32, 85, 96, p);
        // dakika: oyulmuş rakamlar (gövdeyi doldurur)
        String s = String.valueOf(dakika);
        Paint y = new Paint(Paint.ANTI_ALIAS_FLAG);
        y.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
        y.setTypeface(Typeface.create("sans-serif-condensed", Typeface.BOLD));
        y.setTextAlign(Paint.Align.CENTER);
        y.setTextSize(66);
        while (y.measureText(s) > 68 && y.getTextSize() > 20) y.setTextSize(y.getTextSize() - 2);
        Paint.FontMetrics fm = y.getFontMetrics();
        cv.drawText(s, 48, 66 - (fm.ascent + fm.descent) / 2, y);
        return bm;
    }
}
