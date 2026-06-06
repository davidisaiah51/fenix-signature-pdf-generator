import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const TEMPLATE_IMAGE_URL =
  "https://static1.squarespace.com/static/6666bee3dcac9f7f976dd54a/t/6a12387f9422b530f55f1593/1779579008165/FreeSignatureWorksheet_Blank.png";

const FONT_URLS = {
  regular:
    "https://static1.squarespace.com/static/6666bee3dcac9f7f976dd54a/t/6a122111c82e650ac31f2b12/1779573010068/Abc+Cursive.ttf",
  dotted:
    "https://static1.squarespace.com/static/6666bee3dcac9f7f976dd54a/t/6a1221114be6a2244ce44060/1779573010165/Abc+Cursive+Dotted.ttf",
};

const PDF_PLACEMENT = {
  mainName: {
    centerX: 306,
    y: 636.48,
    fontSize: 36,
    maxWidth: 490,
  },
  traceNames: {
    x: 64,
    yPositions: [531, 424.8, 318.24, 211.68],
    fontSize: 36,
    maxWidth: 475,
    opacity: 0.5,
  },
};

export default async function handler(req, res) {
  try {
    let childName = "";

    if (req.method === "GET") {
      childName = cleanName(req.query?.childName || req.query?.name || "");

      if (!childName) {
        res.status(200).send("Fenix Linn signature PDF endpoint is running. Add ?childName=Your%20Name to generate a PDF.");
        return;
      }
    } else if (req.method === "POST") {
      const body = await parseRequestBody(req);
      childName = cleanName(body.childName || body.name || "");
    } else {
      res.setHeader("Allow", "GET, POST");
      res.status(405).send("Method not allowed");
      return;
    }

    if (!childName) {
      res.status(400).json({ error: "Missing childName" });
      return;
    }

    const pdfBytes = await generateWorksheetPdf(childName);
    const fileName = `${safeFileName(childName)}-cursive-signature-practice.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Could not generate worksheet PDF",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function parseRequestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  if (typeof req.body === "string") {
    return Object.fromEntries(new URLSearchParams(req.body));
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    return raw ? JSON.parse(raw) : {};
  }

  return Object.fromEntries(new URLSearchParams(raw));
}

function cleanName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
}

function safeFileName(value) {
  return (
    cleanName(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "cursive-signature"
  );
}

async function generateWorksheetPdf(childName) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([612, 792]);

  const [templateBytes, regularFontBytes, dottedFontBytes] = await Promise.all([
    fetchArrayBuffer(TEMPLATE_IMAGE_URL),
    fetchArrayBuffer(FONT_URLS.regular),
    fetchArrayBuffer(FONT_URLS.dotted),
  ]);

  const templateImage = await pdfDoc.embedPng(templateBytes);
  const scriptFont = await pdfDoc.embedFont(regularFontBytes, { subset: true });
  const dottedFont = await pdfDoc.embedFont(dottedFontBytes, { subset: true });

  page.drawImage(templateImage, {
    x: 0,
    y: 0,
    width: 612,
    height: 792,
  });

  const mainFontSize = fitFontSize(
    scriptFont,
    childName,
    PDF_PLACEMENT.mainName.maxWidth,
    PDF_PLACEMENT.mainName.fontSize,
    24
  );

  drawCenteredText(page, childName, {
    centerX: PDF_PLACEMENT.mainName.centerX,
    y: PDF_PLACEMENT.mainName.y,
    size: mainFontSize,
    font: scriptFont,
    color: rgb(0, 0, 0),
  });

  const traceFontSize = fitFontSize(
    dottedFont,
    childName,
    PDF_PLACEMENT.traceNames.maxWidth,
    PDF_PLACEMENT.traceNames.fontSize,
    24
  );

  PDF_PLACEMENT.traceNames.yPositions.forEach((y) => {
    page.drawText(childName, {
      x: PDF_PLACEMENT.traceNames.x,
      y,
      size: traceFontSize,
      font: dottedFont,
      color: rgb(0, 0, 0),
      opacity: PDF_PLACEMENT.traceNames.opacity,
    });
  });

  return await pdfDoc.save();
}

async function fetchArrayBuffer(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not fetch asset: ${url}`);
  }

  return await response.arrayBuffer();
}

function fitFontSize(font, text, maxWidth, startSize, minSize) {
  let size = startSize;

  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }

  return size;
}

function drawCenteredText(page, text, options) {
  const textWidth = options.font.widthOfTextAtSize(text, options.size);
  const x = options.centerX - textWidth / 2;

  page.drawText(text, {
    x,
    y: options.y,
    size: options.size,
    font: options.font,
    color: options.color,
  });
}
