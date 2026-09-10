/**
 * Utility to print a specific DOM element cleanly using an isolated invisible iframe.
 * Prevents blank screen issues caused by modal backdrops or main app viewport overflows.
 */
export function printElement(elementId: string, documentTitle: string = 'Four Star Cargo Invoice') {
  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  // Create temporary hidden iframe for isolated printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Collect all active stylesheets and CSS rules
  let stylesHtml = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.cssRules) {
        for (const rule of Array.from(sheet.cssRules)) {
          stylesHtml += rule.cssText + '\n';
        }
      }
    } catch {
      // Ignore cross-origin stylesheet errors
    }
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${documentTitle}</title>
        <style>
          ${stylesHtml}
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          * {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            width: 100% !important;
            height: auto !important;
          }
          .no-print, .print\\:hidden, button {
            display: none !important;
          }
          .printable-document {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            border: none !important;
            box-shadow: none !important;
          }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  // Give images and fonts a moment to settle, then trigger print dialog
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Iframe print error, falling back to window.print():', err);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }
  }, 300);
}
