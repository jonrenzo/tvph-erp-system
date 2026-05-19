export const PO_CSS = `
@page {
  size: 918px 1188px;
  margin: 0;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  color: #000;
}

.page {
  width: 918px;
  height: 1188px;
  position: relative;
  overflow: hidden;
}

.page-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.page .content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
}

.page img {
  z-index: 1;
}

.overlay {
  position: absolute;
  white-space: nowrap;
  overflow: hidden;
}

.table-whiteout {
  position: absolute;
  background: #fff;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table td {
  border: 1px solid #000;
  padding: 2px 4px;
  font-size: 11.5pt;
  vertical-align: top;
}
`
