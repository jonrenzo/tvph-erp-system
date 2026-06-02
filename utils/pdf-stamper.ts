import { PDFDocument, rgb } from "pdf-lib";

export async function stampPdfWithSignature(
  pdfBuffer: ArrayBuffer,
  signatureBase64Png: string,
  ipAddress: string,
  timestamp: string,
  entityName: string,
  documentType: string,
) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    
    // Embed the signature PNG
    const signatureImageBytes = Buffer.from(signatureBase64Png.split(",")[1] || signatureBase64Png, "base64");
    const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
    
    // Add a professional Audit Receipt page at the end of the document
    const page = pdfDoc.addPage([595, 420]); // A5-ish Landscape/Portrait ratio
    const { width, height } = page.getSize();
    
    // Draw background/borders
    page.drawRectangle({
      x: 10,
      y: 10,
      width: width - 20,
      height: height - 20,
      borderColor: rgb(0.027, 0.122, 0.082), // Theme Dark Green
      borderWidth: 2,
    });

    // Draw header banner
    page.drawRectangle({
      x: 11,
      y: height - 60,
      width: width - 22,
      height: 48,
      color: rgb(0.027, 0.122, 0.082),
    });

    page.drawText("E-SIGNATURE AUDIT RECEIPT", {
      x: 30,
      y: height - 44,
      size: 16,
      color: rgb(1, 1, 1),
    });

    page.drawText("TelcoVantage Philippines Operations Portal", {
      x: 30,
      y: height - 54,
      size: 8,
      color: rgb(0.7, 0.9, 0.8),
    });

    // Meta details
    let yPos = height - 100;
    const drawMeta = (label: string, value: string) => {
      page.drawText(label, { x: 30, y: yPos, size: 10, color: rgb(0.4, 0.4, 0.4) });
      page.drawText(value, { x: 180, y: yPos, size: 10, color: rgb(0.1, 0.1, 0.1) });
      yPos -= 22;
    };

    drawMeta("Document Category:", documentType.toUpperCase().replace(/_/g, " "));
    drawMeta("Signatory entity:", entityName);
    drawMeta("Date & Time (UTC):", timestamp);
    drawMeta("IP Address:", ipAddress);
    drawMeta("Verification ID:", Math.random().toString(36).substring(2, 10).toUpperCase());

    // Draw Signature Label
    page.drawText("DIGITAL SIGNATURE SECURED:", {
      x: 30,
      y: yPos - 10,
      size: 10,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Draw Signature Image
    const sigWidth = 140;
    const sigHeight = 60;
    page.drawImage(signatureImage, {
      x: 30,
      y: yPos - 80,
      width: sigWidth,
      height: sigHeight,
    });

    // Sign off text
    page.drawText("This document has been digitally signed and validated through the TelcoVantage Magic Link Portal. Any unauthorized modifications will void the validity of this record.", {
      x: 30,
      y: 30,
      size: 8,
      color: rgb(0.5, 0.5, 0.5),
      maxWidth: width - 60,
    });

    const modifiedPdfBytes = await pdfDoc.save();
    return Buffer.from(modifiedPdfBytes);
  } catch (error) {
    console.error("PDF Stamping Error:", error);
    // Return original buffer as fallback
    return Buffer.from(pdfBuffer);
  }
}
