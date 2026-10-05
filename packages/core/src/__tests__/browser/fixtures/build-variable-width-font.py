"""Builds variable-width.ttf: a font whose glyph advances grow with its weight axis.

Every lowercase letter is a box, 500 units wide at the default weight (400) and 1000 units
wide at the heaviest (900), so text set with font-variation-settings is measurably wider than
the same text without it. Run with fontTools installed: python3 build-variable-width-font.py
"""

from pathlib import Path

from fontTools.designspaceLib import AxisDescriptor, DesignSpaceDocument, SourceDescriptor
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.varLib import build

FAMILY = "TSI Variable Width"
LETTERS = [chr(c) for c in range(ord("a"), ord("z") + 1)]
GLYPHS = [".notdef", "space", *LETTERS]


def box(advance):
    pen = TTGlyphPen(None)
    pen.moveTo((50, 0))
    pen.lineTo((50, 500))
    pen.lineTo((advance - 50, 500))
    pen.lineTo((advance - 50, 0))
    pen.closePath()
    return pen.glyph()


def master(advance):
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(GLYPHS)
    builder.setupCharacterMap({32: "space", **{ord(c): c for c in LETTERS}})
    glyphs = {name: box(advance) for name in GLYPHS}
    glyphs["space"] = TTGlyphPen(None).glyph()
    builder.setupGlyf(glyphs)
    metrics = {name: (advance, 50) for name in GLYPHS}
    metrics["space"] = (advance // 2, 0)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": FAMILY, "styleName": "Regular"})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    builder.setupPost()
    return builder.font


def main():
    doc = DesignSpaceDocument()
    axis = AxisDescriptor()
    axis.tag, axis.name, axis.minimum, axis.default, axis.maximum = "wght", "Weight", 400, 400, 900
    doc.addAxis(axis)
    for weight, advance in ((400, 500), (900, 1000)):
        source = SourceDescriptor()
        source.font = master(advance)
        source.location = {"Weight": weight}
        doc.addSource(source)
    font, _, _ = build(doc)
    font.save(Path(__file__).with_name("variable-width.ttf"))


if __name__ == "__main__":
    main()
