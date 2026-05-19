import puppeteer from 'puppeteer'
import fs from 'fs'
import { renderPOHtml } from './po.template'
import type { PoTemplateData, PoData, VendorData, ProjectData, PoLineItemData, PoSiteDetailData } from './po.types'

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
]

function findChromePath(): string | undefined {
  return CHROME_PATHS.find(p => fs.existsSync(p))
}

export async function generatePoDocument(
  po: PoData,
  vendor: VendorData | null,
  project: ProjectData | null,
  lineItems: PoLineItemData[],
  siteDetails: PoSiteDetailData[],
  options?: { editable?: boolean },
): Promise<Uint8Array> {
  const templateData: PoTemplateData = {
    po: {
      ...po,
      vendors: vendor || undefined,
      projects: project || undefined,
    },
    lineItems,
    siteDetails,
  }

  const html = renderPOHtml(templateData)

  const executablePath = findChromePath()
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdfBuffer = await page.pdf({
      width: '918px',
      height: '1188px',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    })

    return new Uint8Array(pdfBuffer)
  } finally {
    await browser.close()
  }
}
