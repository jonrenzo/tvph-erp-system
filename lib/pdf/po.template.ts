import fs from 'fs'
import path from 'path'
import { PO_CSS } from './po.styles'
import type { PoTemplateData, PoLineItemData, PoSiteDetailData } from './po.types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtCurrency(n: number, cur: string = 'PHP'): string {
  const sym = cur === 'PHP' ? 'PHP ' : cur + ' '
  return sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDateLong(d: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtDateShort(d: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${m}/${day}/${dt.getFullYear()}`
}

function imageBase64(n: number): string {
  const p = path.join(process.cwd(), 'public', 'ref', `page${n}.png`)
  if (!fs.existsSync(p)) return ''
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
}

const F = {
  fs6: 21,
  fs1: 15,
  fs5: 13.5,
}

function page1Content(data: PoTemplateData): string {
  const po = data.po; const v = po.vendors || {}
  const cur = po.currency; const dp = po.dp_amount ? fmtCurrency(po.dp_amount, cur) : ''

  const itemsHtml = data.lineItems.map((li) => {
    const lno = String(li.line_no).padStart(4, '0')
    return `<tr>
      <td style="text-align:center;padding:1px 2px;border:1px solid #000">${esc(lno)}</td>
      <td style="text-align:center;padding:1px 2px;border:1px solid #000">${esc(li.item_code || '')}</td>
      <td style="padding:1px 2px;border:1px solid #000">${esc(li.description)}</td>
      <td style="text-align:right;padding:1px 2px;border:1px solid #000">${Number(li.qty).toLocaleString()}</td>
      <td style="text-align:center;padding:1px 2px;border:1px solid #000">${esc(li.uom)}</td>
      <td style="text-align:right;padding:1px 2px;border:1px solid #000">${fmtCurrency(li.unit_price, cur)}</td>
      <td style="text-align:right;padding:1px 2px;border:1px solid #000">${fmtCurrency(li.amount, cur)}</td>
    </tr>`
  }).join('')

  const total = data.lineItems.reduce((s, li) => s + Number(li.amount), 0)

  return `<div class="page">
    <img src="${imageBase64(1)}" style="position:absolute;top:0;left:0;width:918px;height:1188px;display:block" alt=""/>
    <div class="content">

      <div style="position:absolute;left:676px;top:125px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(po.po_number)}</div>
      <div style="position:absolute;left:676px;top:144px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${fmtDateLong(po.issued_date)}</div>

      <div style="position:absolute;left:63px;top:220px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.name || '')}</div>
      <div style="position:absolute;left:435px;top:220px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.id || '')}</div>
      <div style="position:absolute;left:63px;top:239px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.contact_person || '')}</div>
      <div style="position:absolute;left:435px;top:258px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.contact_phone || '')}</div>
      <div style="position:absolute;left:63px;top:277px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.address || '')}</div>
      <div style="position:absolute;left:616px;top:277px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${dp}</div>

      <div style="position:absolute;left:55px;top:335px;width:870px;height:600px;overflow:hidden;background:#fff">
        <table style="width:100%;border-collapse:collapse;font-size:11pt">
          <tbody>${itemsHtml || '<tr><td colspan="7" style="padding:4px;text-align:center">No items</td></tr>'}</tbody>
        </table>
        <div style="text-align:right;font-weight:700;font-size:11pt;padding:4px 8px;border:1px solid #000;margin-top:2px">
          Total (${esc(cur)}): ${fmtCurrency(total, cur)}
        </div>
      </div>

      <div style="position:absolute;left:63px;top:960px;font-size:${F.fs5}px;background:#fff;padding:0 4px">
        Pls coordinate with the Project Manager at TelcoVantage (PO: ${esc(po.po_number)})
      </div>

      <div style="position:absolute;left:331px;top:1020px;font-size:${F.fs1}px;background:#fff;padding:0 4px">
        ${po.date_prepared ? fmtDateShort(po.date_prepared) : ''}
      </div>

    </div>
  </div>`
}

function page2Content(data: PoTemplateData): string {
  const po = data.po; const v = po.vendors || {}

  return `<div class="page" style="position:relative;overflow:hidden">
    <img src="${imageBase64(2)}" style="position:absolute;top:0;left:0;width:100%;height:100%;display:block" alt=""/>
    <div class="content" style="position:absolute;top:0;left:0;width:100%;height:100%;font-family:Arial,sans-serif;color:#000">

      <div style="position:absolute;left:676px;top:125px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(po.po_number)}</div>
      <div style="position:absolute;left:676px;top:144px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${fmtDateLong(po.issued_date)}</div>

      <div style="position:absolute;left:76px;top:220px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.name || '')}</div>
      <div style="position:absolute;left:449px;top:220px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.id || '')}</div>
      <div style="position:absolute;left:76px;top:239px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.contact_person || '')}</div>
      <div style="position:absolute;left:449px;top:258px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.contact_phone || '')}</div>
      <div style="position:absolute;left:76px;top:277px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.address || '')}</div>
      <div style="position:absolute;left:630px;top:277px;font-size:${F.fs1}px;background:#fff;padding:0 4px">
        ${po.dp_amount ? fmtCurrency(po.dp_amount, po.currency) : ''}
      </div>

      <div style="position:absolute;left:76px;top:960px;font-size:${F.fs5}px;background:#fff;padding:0 4px">
        Pls coordinate with Mae Bacayo mae.bacayo@telcovantage.com
      </div>

      <div style="position:absolute;left:353px;top:1020px;font-size:${F.fs1}px;background:#fff;padding:0 4px">
        ${po.date_prepared ? fmtDateShort(po.date_prepared) : ''}
      </div>

    </div>
  </div>`
}

function page3Content(data: PoTemplateData): string {
  const po = data.po; const v = po.vendors || {}
  const sites = data.siteDetails
  const sitesHtml = sites.length > 0 ? renderSitesTable(sites) : ''

  return `<div class="page" style="position:relative;overflow:hidden">
    <img src="${imageBase64(3)}" style="position:absolute;top:0;left:0;width:100%;height:100%;display:block" alt=""/>
    <div class="content" style="position:absolute;top:0;left:0;width:100%;height:100%;font-family:Arial,sans-serif;color:#000">

      <div style="position:absolute;left:676px;top:125px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(po.po_number)}</div>
      <div style="position:absolute;left:676px;top:144px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${fmtDateLong(po.issued_date)}</div>

      <div style="position:absolute;left:55px;top:236px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.name || '')}</div>
      <div style="position:absolute;left:427px;top:236px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.id || '')}</div>
      <div style="position:absolute;left:55px;top:255px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.contact_person || '')}</div>
      <div style="position:absolute;left:55px;top:277px;font-size:${F.fs1}px;background:#fff;padding:0 4px">${esc(v.address || '')}</div>
      <div style="position:absolute;left:427px;top:277px;font-size:${F.fs1}px;background:#fff;padding:0 4px">
        ${po.dp_amount ? fmtCurrency(po.dp_amount, po.currency) : ''}
      </div>
      <div style="position:absolute;left:55px;top:260px;font-size:${F.fs1}px;background:#fff;padding:0 4px">
        ${esc(v.contact_phone || '')}
      </div>

      ${sitesHtml ? `
      <div style="position:absolute;left:55px;top:400px;width:810px;height:500px;overflow:hidden;background:#fff;border:1px solid #000;padding:4px">
        ${sitesHtml}
      </div>` : ''}

      <div style="position:absolute;left:55px;top:960px;font-size:${F.fs5}px;background:#fff;padding:0 4px">
        Pls coordinate with Mae Bacayo mae.bacayo@telcovantage.com
      </div>

      <div style="position:absolute;left:331px;top:1020px;font-size:${F.fs1}px;background:#fff;padding:0 4px">
        ${po.date_prepared ? fmtDateShort(po.date_prepared) : ''}
      </div>

    </div>
  </div>`
}

function renderSitesTable(sites: PoSiteDetailData[]): string {
  const rows = sites.map(s => `<tr>
    <td style="text-align:center;padding:3px 4px;border:1px solid #000">${s.sn}</td>
    <td style="padding:3px 4px;border:1px solid #000">${esc(s.region)}</td>
    <td style="padding:3px 4px;border:1px solid #000">${esc(s.area_city)}</td>
    <td style="text-align:right;padding:3px 4px;border:1px solid #000">${s.no_of_nodes.toLocaleString()}</td>
    <td style="text-align:right;padding:3px 4px;border:1px solid #000">${Number(s.cable_length_km).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
  </tr>`).join('')

  const totalNodes = sites.reduce((a, s) => a + s.no_of_nodes, 0)
  const totalCable = sites.reduce((a, s) => a + Number(s.cable_length_km), 0)

  return `<table style="width:100%;border-collapse:collapse;font-size:10pt">
    <tr style="font-weight:700;background:#000;color:#fff">
      <td style="padding:4px 6px;border:1px solid #000;text-align:center">S/N</td>
      <td style="padding:4px 6px;border:1px solid #000;text-align:center">REGION</td>
      <td style="padding:4px 6px;border:1px solid #000;text-align:center">AREA/CITY</td>
      <td style="padding:4px 6px;border:1px solid #000;text-align:center">NO OF NODES</td>
      <td style="padding:4px 6px;border:1px solid #000;text-align:center">ESTIMATED STRAND<br/>CABLE LENGTH (KM)</td>
    </tr>
    ${rows}
    <tr style="font-weight:700">
      <td colspan="3" style="text-align:right;padding:4px 6px;border:1px solid #000">TOTAL</td>
      <td style="text-align:right;padding:4px 6px;border:1px solid #000">${totalNodes.toLocaleString()}</td>
      <td style="text-align:right;padding:4px 6px;border:1px solid #000">${totalCable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  </table>`
}

export function renderPOHtml(data: PoTemplateData): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<style>${PO_CSS}</style>
</head>
<body>
  ${page1Content(data)}
  ${page2Content(data)}
  ${page3Content(data)}
</body></html>`
}
